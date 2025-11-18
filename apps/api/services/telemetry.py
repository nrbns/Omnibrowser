from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Lazy import to avoid circular dependencies
_db_session = None


def _get_db_session():
    """Get database session (lazy import)"""
    global _db_session
    if _db_session is None:
        try:
            from apps.api.database import SessionLocal
            _db_session = SessionLocal
        except ImportError:
            logger.warning("Database not available, metrics will only be logged to JSONL")
            return None
    return _db_session


def _resolve_metrics_path() -> Path:
    """
    Determine where telemetry events should be persisted.
    Environment override (AI_TASK_METRICS_PATH) takes priority.
    Otherwise default to <repo>/logs/ai_tasks.jsonl.
    """
    override = os.getenv("AI_TASK_METRICS_PATH")
    if override:
        return Path(override)

    # apps/api/services -> repo root = parents[3]
    repo_root = Path(__file__).resolve().parents[3]
    return repo_root / "logs" / "ai_tasks.jsonl"


async def record_ai_task_metric(payload: Dict[str, Any]) -> None:
    """
    Append a single AI task telemetry payload to the metrics log.
    Persists to both database (if available) and JSONL file.
    """
    # Try database first
    SessionLocal = _get_db_session()
    if SessionLocal:
        def _persist_to_db() -> None:
            try:
                from apps.api.models import AITaskMetric
                db = SessionLocal()
                try:
                    usage = payload.get("usage", {})
                    if isinstance(usage, dict):
                        prompt_tokens = usage.get("prompt_tokens")
                        completion_tokens = usage.get("completion_tokens")
                        total_tokens = usage.get("total_tokens")
                    else:
                        prompt_tokens = completion_tokens = total_tokens = None
                    
                    metric = AITaskMetric(
                        timestamp=datetime.utcnow(),
                        status=payload.get("status", "unknown"),
                        kind=payload.get("kind", "unknown"),
                        mode=payload.get("mode"),
                        provider=payload.get("provider", "unknown"),
                        model=payload.get("model", "unknown"),
                        latency_ms=payload.get("latency_ms", 0),
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        total_tokens=total_tokens,
                        estimated_cost_usd=payload.get("estimated_cost_usd"),
                        cost_tier=payload.get("cost_tier"),
                        prompt_chars=payload.get("prompt_chars"),
                        has_context=payload.get("has_context", False),
                        citations_count=payload.get("citations_count"),
                        client_id=payload.get("client_id"),
                        error=payload.get("error"),
                        metadata_json=payload.get("metadata"),
                    )
                    db.add(metric)
                    db.commit()
                except Exception as exc:
                    db.rollback()
                    logger.warning("Failed to persist ai_task metric to database: %s", exc)
                finally:
                    db.close()
            except Exception as exc:
                logger.warning("Database persistence failed: %s", exc)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _persist_to_db)

    # Also write to JSONL (fallback and backup)
    metrics_path = _resolve_metrics_path()
    enriched = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        **payload,
    }
    line = json.dumps(enriched, ensure_ascii=False)

    def _write_line() -> None:
        try:
            metrics_path.parent.mkdir(parents=True, exist_ok=True)
            with metrics_path.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")
        except Exception as exc:
            logger.warning("Failed to persist ai_task telemetry to JSONL: %s", exc)

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _write_line)

