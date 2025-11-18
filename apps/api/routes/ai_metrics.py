"""
AI Metrics Endpoint - Query cost, usage, and performance metrics
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from apps.api.database import get_db
from apps.api.models import AITaskMetric
from apps.api.services.cache import get_cache_stats, clear_cache

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/ai/metrics/summary")
async def get_metrics_summary(
    hours: int = Query(24, ge=1, le=168, description="Time window in hours"),
    kind: Optional[str] = Query(None, description="Filter by task kind"),
    mode: Optional[str] = Query(None, description="Filter by mode"),
    client_id: Optional[str] = Query(None, description="Filter by client ID"),
    db: Session = Depends(get_db),
):
    """
    Get summary metrics for AI tasks.
    Returns aggregated stats: total requests, success rate, costs, latency, etc.
    """
    try:
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        
        query = db.query(AITaskMetric).filter(AITaskMetric.timestamp >= cutoff)
        
        if kind:
            query = query.filter(AITaskMetric.kind == kind)
        if mode:
            query = query.filter(AITaskMetric.mode == mode)
        if client_id:
            query = query.filter(AITaskMetric.client_id == client_id)
        
        metrics = query.all()
        
        if not metrics:
            return {
                "period_hours": hours,
                "total_requests": 0,
                "success_count": 0,
                "error_count": 0,
                "success_rate": 0.0,
                "total_cost_usd": 0.0,
                "avg_latency_ms": 0,
                "total_tokens": 0,
                "by_kind": {},
                "by_model": {},
            }
        
        success_count = sum(1 for m in metrics if m.status == "success")
        error_count = len(metrics) - success_count
        total_cost = sum(m.estimated_cost_usd or 0.0 for m in metrics)
        total_tokens = sum(m.total_tokens or 0 for m in metrics)
        avg_latency = sum(m.latency_ms for m in metrics) / len(metrics) if metrics else 0
        
        # Group by kind
        by_kind: Dict[str, Dict[str, Any]] = {}
        for m in metrics:
            if m.kind not in by_kind:
                by_kind[m.kind] = {
                    "count": 0,
                    "success": 0,
                    "errors": 0,
                    "cost_usd": 0.0,
                    "tokens": 0,
                }
            by_kind[m.kind]["count"] += 1
            if m.status == "success":
                by_kind[m.kind]["success"] += 1
            else:
                by_kind[m.kind]["errors"] += 1
            by_kind[m.kind]["cost_usd"] += m.estimated_cost_usd or 0.0
            by_kind[m.kind]["tokens"] += m.total_tokens or 0
        
        # Group by model
        by_model: Dict[str, Dict[str, Any]] = {}
        for m in metrics:
            key = f"{m.provider}:{m.model}"
            if key not in by_model:
                by_model[key] = {
                    "count": 0,
                    "cost_usd": 0.0,
                    "tokens": 0,
                    "avg_latency_ms": 0,
                }
            by_model[key]["count"] += 1
            by_model[key]["cost_usd"] += m.estimated_cost_usd or 0.0
            by_model[key]["tokens"] += m.total_tokens or 0
        
        # Calculate average latency per model
        for key in by_model:
            model_metrics = [m for m in metrics if f"{m.provider}:{m.model}" == key]
            if model_metrics:
                by_model[key]["avg_latency_ms"] = int(
                    sum(m.latency_ms for m in model_metrics) / len(model_metrics)
                )
        
        return {
            "period_hours": hours,
            "total_requests": len(metrics),
            "success_count": success_count,
            "error_count": error_count,
            "success_rate": success_count / len(metrics) if metrics else 0.0,
            "total_cost_usd": round(total_cost, 6),
            "avg_latency_ms": int(avg_latency),
            "total_tokens": total_tokens,
            "by_kind": by_kind,
            "by_model": by_model,
        }
    except Exception as exc:
        logger.error("Failed to get metrics summary: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve metrics")


@router.get("/ai/metrics/timeline")
async def get_metrics_timeline(
    hours: int = Query(24, ge=1, le=168),
    interval_minutes: int = Query(60, ge=5, le=1440, description="Bucket size in minutes"),
    kind: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Get time-series metrics for plotting.
    Returns data points grouped by time intervals.
    """
    try:
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        
        query = db.query(AITaskMetric).filter(AITaskMetric.timestamp >= cutoff)
        if kind:
            query = query.filter(AITaskMetric.kind == kind)
        
        metrics = query.order_by(AITaskMetric.timestamp).all()
        
        if not metrics:
            return {"intervals": [], "data": []}
        
        # Group into time buckets
        interval_seconds = interval_minutes * 60
        buckets: Dict[int, List[AITaskMetric]] = {}
        
        for m in metrics:
            bucket_time = int(m.timestamp.timestamp() // interval_seconds) * interval_seconds
            if bucket_time not in buckets:
                buckets[bucket_time] = []
            buckets[bucket_time].append(m)
        
        # Build timeline data
        timeline = []
        for bucket_time in sorted(buckets.keys()):
            bucket_metrics = buckets[bucket_time]
            timeline.append({
                "timestamp": datetime.fromtimestamp(bucket_time).isoformat(),
                "count": len(bucket_metrics),
                "success_count": sum(1 for m in bucket_metrics if m.status == "success"),
                "error_count": sum(1 for m in bucket_metrics if m.status == "error"),
                "cost_usd": round(sum(m.estimated_cost_usd or 0.0 for m in bucket_metrics), 6),
                "avg_latency_ms": int(sum(m.latency_ms for m in bucket_metrics) / len(bucket_metrics)),
                "total_tokens": sum(m.total_tokens or 0 for m in bucket_metrics),
            })
        
        return {
            "interval_minutes": interval_minutes,
            "period_hours": hours,
            "data": timeline,
        }
    except Exception as exc:
        logger.error("Failed to get metrics timeline: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve timeline")


@router.get("/ai/metrics/top-errors")
async def get_top_errors(
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Get most common errors in the time window.
    """
    try:
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        
        error_metrics = (
            db.query(AITaskMetric)
            .filter(
                and_(
                    AITaskMetric.timestamp >= cutoff,
                    AITaskMetric.status == "error",
                    AITaskMetric.error.isnot(None),
                )
            )
            .all()
        )
        
        # Group by error message
        error_counts: Dict[str, int] = {}
        for m in error_metrics:
            error_msg = (m.error or "Unknown error")[:200]  # Truncate long errors
            error_counts[error_msg] = error_counts.get(error_msg, 0) + 1
        
        # Sort and limit
        top_errors = sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
        
        return {
            "period_hours": hours,
            "errors": [{"message": msg, "count": count} for msg, count in top_errors],
        }
    except Exception as exc:
        logger.error("Failed to get top errors: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve errors")


@router.get("/ai/metrics/cache")
async def get_cache_stats_endpoint():
    """
    Get cache statistics.
    """
    try:
        stats = get_cache_stats()
        return stats
    except Exception as exc:
        logger.error("Failed to get cache stats: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve cache stats")


@router.post("/ai/metrics/cache/clear")
async def clear_cache_endpoint():
    """
    Clear all cache entries.
    """
    try:
        count = clear_cache()
        return {"cleared": count, "message": f"Cleared {count} cache entries"}
    except Exception as exc:
        logger.error("Failed to clear cache: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to clear cache")

