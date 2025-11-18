"""
Response Cache Service - Cache AI responses for repeated queries
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from functools import lru_cache

logger = logging.getLogger(__name__)

# In-memory cache (simple implementation)
# TODO: Replace with Redis or similar for production
_response_cache: Dict[str, Dict[str, Any]] = {}


def cache_key(prompt: str, kind: str, model: Optional[str] = None, context_hash: Optional[str] = None) -> str:
    """
    Generate a cache key for a request.
    
    Args:
        prompt: User prompt
        kind: Task kind (search, agent, etc.)
        model: Model name (optional)
        context_hash: Hash of context data (optional)
    
    Returns:
        Cache key string
    """
    key_parts = [prompt.strip().lower(), kind.lower()]
    if model:
        key_parts.append(model.lower())
    if context_hash:
        key_parts.append(context_hash)
    
    key_str = "|".join(key_parts)
    return hashlib.sha256(key_str.encode("utf-8")).hexdigest()


def hash_context(context: Optional[Dict[str, Any]]) -> str:
    """
    Generate a hash of context data for cache key.
    
    Args:
        context: Context dictionary
    
    Returns:
        Hash string
    """
    if not context:
        return ""
    
    # Normalize context (remove timestamps, IDs that change but don't affect result)
    normalized = {}
    if isinstance(context, dict):
        for key, value in context.items():
            if key in ["memories", "agent_runs"]:
                # Only hash the number of items and first item's content
                if isinstance(value, list) and value:
                    normalized[key] = {
                        "count": len(value),
                        "first_value": str(value[0].get("value", "")[:100]) if isinstance(value[0], dict) else str(value[0])[:100],
                    }
            elif key == "active_tab":
                # Only hash URL, not title (which may change)
                if isinstance(value, dict):
                    normalized[key] = value.get("url", "")
            else:
                normalized[key] = value
    
    context_str = json.dumps(normalized, sort_keys=True)
    return hashlib.sha256(context_str.encode("utf-8")).hexdigest()[:16]


def get_cached_response(cache_key_str: str, max_age_seconds: int = 3600) -> Optional[Dict[str, Any]]:
    """
    Get a cached response if available and not expired.
    
    Args:
        cache_key_str: Cache key
        max_age_seconds: Maximum age of cache entry in seconds
    
    Returns:
        Cached response dict or None
    """
    if cache_key_str not in _response_cache:
        return None
    
    entry = _response_cache[cache_key_str]
    cached_at = entry.get("cached_at")
    
    if not cached_at:
        return None
    
    # Check if expired
    age = (datetime.utcnow() - cached_at).total_seconds()
    if age > max_age_seconds:
        # Remove expired entry
        del _response_cache[cache_key_str]
        logger.debug(f"Cache entry expired: {cache_key_str} (age: {age:.0f}s)")
        return None
    
    logger.debug(f"Cache hit: {cache_key_str} (age: {age:.0f}s)")
    return entry.get("response")


def set_cached_response(cache_key_str: str, response: Dict[str, Any], ttl_seconds: int = 3600) -> None:
    """
    Cache a response.
    
    Args:
        cache_key_str: Cache key
        response: Response dict to cache
        ttl_seconds: Time to live in seconds
    """
    _response_cache[cache_key_str] = {
        "response": response,
        "cached_at": datetime.utcnow(),
        "ttl_seconds": ttl_seconds,
    }
    
    # Limit cache size (simple LRU eviction)
    max_entries = int(os.getenv("AI_CACHE_MAX_ENTRIES", "1000"))
    if len(_response_cache) > max_entries:
        # Remove oldest entries (simple FIFO)
        oldest_key = min(
            _response_cache.keys(),
            key=lambda k: _response_cache[k].get("cached_at", datetime.utcnow()),
        )
        del _response_cache[oldest_key]
        logger.debug(f"Evicted oldest cache entry: {oldest_key}")
    
    logger.debug(f"Cached response: {cache_key_str} (TTL: {ttl_seconds}s)")


def should_cache(kind: str, prompt: str) -> bool:
    """
    Determine if a request should be cached.
    
    Args:
        kind: Task kind
        prompt: User prompt
    
    Returns:
        True if request should be cached
    """
    # Don't cache very short prompts (likely commands)
    if len(prompt.strip()) < 10:
        return False
    
    # Don't cache agent tasks (they're often stateful)
    if kind.lower() in ["agent", "execute"]:
        return False
    
    # Cache search and chat tasks
    if kind.lower() in ["search", "chat", "summary"]:
        return True
    
    # Default: cache if enabled
    cache_enabled = os.getenv("AI_CACHE_ENABLED", "true").lower() == "true"
    return cache_enabled


def get_cache_ttl(kind: str) -> int:
    """
    Get cache TTL for a task kind.
    
    Args:
        kind: Task kind
    
    Returns:
        TTL in seconds
    """
    # Short TTL for search (results may change)
    if kind.lower() == "search":
        return int(os.getenv("AI_CACHE_TTL_SEARCH", "1800"))  # 30 minutes
    
    # Longer TTL for summaries and chat
    if kind.lower() in ["summary", "chat"]:
        return int(os.getenv("AI_CACHE_TTL_CHAT", "7200"))  # 2 hours
    
    # Default TTL
    return int(os.getenv("AI_CACHE_TTL_DEFAULT", "3600"))  # 1 hour


def clear_cache(pattern: Optional[str] = None) -> int:
    """
    Clear cache entries.
    
    Args:
        pattern: Optional pattern to match keys (not implemented in simple cache)
    
    Returns:
        Number of entries cleared
    """
    count = len(_response_cache)
    _response_cache.clear()
    logger.info(f"Cleared {count} cache entries")
    return count


def get_cache_stats() -> Dict[str, Any]:
    """
    Get cache statistics.
    
    Returns:
        Dictionary with cache stats
    """
    now = datetime.utcnow()
    total_entries = len(_response_cache)
    expired_entries = sum(
        1
        for entry in _response_cache.values()
        if (now - entry.get("cached_at", now)).total_seconds() > entry.get("ttl_seconds", 0)
    )
    
    return {
        "total_entries": total_entries,
        "valid_entries": total_entries - expired_entries,
        "expired_entries": expired_entries,
        "max_entries": int(os.getenv("AI_CACHE_MAX_ENTRIES", "1000")),
    }

