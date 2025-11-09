import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import redis


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
STREAM_KEY = os.getenv("EMBED_STREAM", "memory:queue")

logger = logging.getLogger("redix.queue")
_redis_client = redis.Redis.from_url(REDIS_URL)


def enqueue_memory(data: dict[str, Any]) -> None:
    """
    Push a memory payload onto the Redis stream for async embedding.
    """
    payload = data.copy()
    created_at = payload.get("created_at")
    if isinstance(created_at, datetime):
        payload["created_at"] = created_at.astimezone(timezone.utc).isoformat()
    elif not created_at:
        payload["created_at"] = datetime.now(timezone.utc).isoformat()

    fields = {
        "id": payload["id"],
        "tenant_id": payload["tenant_id"],
        "user_id": payload["user_id"],
        "project": payload["project"],
        "type": payload.get("type", "tab"),
        "title": payload.get("title") or "",
        "text": payload["text"],
        "mode": payload.get("mode") or "",
        "tags": json.dumps(payload.get("tags", [])),
        "origin": json.dumps(payload.get("origin")),
        "rich": json.dumps(payload.get("rich")),
        "acl": json.dumps(payload.get("acl")),
        "pii": json.dumps(payload.get("pii")),
        "created_at": payload["created_at"],
    }

    try:
        _redis_client.xadd(STREAM_KEY, fields)
        logger.info(
            "Enqueued memory",
            extra={
                "id": payload["id"],
                "project": payload["project"],
                "tenant_id": payload["tenant_id"],
            },
        )
    except redis.RedisError as exc:
        logger.exception(
            "Failed to enqueue memory",
            extra={
                "id": payload.get("id"),
                "project": payload.get("project"),
                "error": str(exc),
            },
        )
        raise

