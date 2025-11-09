from datetime import datetime, timezone
import logging
import os
import re
from typing import Annotated, Any, Dict
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, validator

from db import check_health, insert_memory, vector_search  # type: ignore
from embed import embed_text  # type: ignore
from memory_queue import enqueue_memory  # type: ignore


LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("redix.api")

app = FastAPI(
    title="Redix Memory API",
    description="FastAPI service for OmniBrowser memory ingestion and recall.",
    version="0.1.0",
)

JWT_SECRET = os.getenv("JWT_SECRET", "dev-super-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
ASYNC_EMBED = os.getenv("ASYNC_EMBED", "false").lower() in {"1", "true", "yes"}
ALLOWED_PROJECTS = {
    project.strip()
    for project in os.getenv("ALLOWED_PROJECTS", "omnibrowser,redix").split(",")
    if project.strip()
}

PII_PATTERNS: dict[str, re.Pattern[str]] = {
    "email": re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE),
    "phone": re.compile(r"\+?\d[\d\s().-]{7,}\d"),
}


class AuthContext(BaseModel):
    tenant_id: str = "dev"
    user_id: str = "u42"


def fake_auth(
    x_tenant: Annotated[str | None, Header(alias="x-tenant", default=None)] = None,
    x_user: Annotated[str | None, Header(alias="x-user", default=None)] = None,
) -> AuthContext:
    """
    Lightweight header-based auth shim for local development.
    Production should swap this with JWT-backed verification.
    """
    return AuthContext(
        tenant_id=x_tenant or "dev",
        user_id=x_user or "u42",
    )


class MemoryWriteRequest(BaseModel):
    project: str = Field(..., description="Project or namespace for the memory.")
    type: str = Field(default="tab", description="Memory item type (tab, note, chat, etc).")
    title: str | None = Field(default=None)
    text: str = Field(..., description="Primary text body used for embeddings.")
    mode: str | None = Field(default=None, description="Operational mode (research/trade/threat/etc).")
    tags: list[str] = Field(default_factory=list)
    origin: dict[str, Any] | None = None
    rich: dict[str, Any] | None = None
    acl: dict[str, Any] | None = None
    pii: dict[str, Any] | None = None

    @validator("text")
    def ensure_text_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text field cannot be empty")
        return value


class MemorySearchRequest(BaseModel):
    query: str
    top_k: int | None = Field(default=10, ge=1, le=50)
    filters: dict[str, Any] | None = Field(default_factory=dict)
    with_sources: bool | None = False


def _detect_pii(text: str) -> dict[str, int]:
    matches: dict[str, int] = {}
    for label, pattern in PII_PATTERNS.items():
        found = pattern.findall(text)
        if found:
            matches[label] = len(found)
    return matches


def _merge_pii(original: dict[str, Any] | None, detected: dict[str, int]) -> dict[str, Any] | None:
    if not detected:
        return original
    merged: dict[str, Any]
    if isinstance(original, dict):
        merged = {**original}
    else:
        merged = {}
    auto = merged.get("auto")
    if isinstance(auto, dict):
        auto.update(detected)
    else:
        merged["auto"] = detected
    return merged


@app.post("/v1/memory.write")
def memory_write(
    payload: MemoryWriteRequest,
    auth: AuthContext = Depends(fake_auth),
):
    """
    Ingest a memory item, embed it, and fan out to Postgres + Qdrant.
    """
    memory_id = str(uuid4())
    created_at = datetime.now(timezone.utc)

    if ALLOWED_PROJECTS and payload.project not in ALLOWED_PROJECTS:
        logger.warning(
            "Rejected memory write for disallowed project",
            extra={"project": payload.project, "tenant_id": auth.tenant_id},
        )
        raise HTTPException(status_code=403, detail="Project not permitted")

    pii_summary = _detect_pii(payload.text)

    memory_data = dict(
        id=memory_id,
        tenant_id=auth.tenant_id,
        user_id=auth.user_id,
        project=payload.project,
        type=payload.type,
        title=payload.title,
        text=payload.text,
        tags=payload.tags,
        mode=payload.mode,
        origin=payload.origin,
        rich=payload.rich,
        acl=payload.acl,
        pii=_merge_pii(payload.pii, pii_summary),
        created_at=created_at,
    )

    if ASYNC_EMBED:
        try:
            enqueue_memory(memory_data)
            logger.info(
                "Queued memory for async embedding",
                extra={
                    "id": memory_id,
                    "project": payload.project,
                    "tenant_id": auth.tenant_id,
                    "text_length": len(payload.text),
                    "pii_flags": list(pii_summary.keys()),
                },
            )
            return {"id": memory_id, "queued": True}
        except Exception as exc:  # Redis failure fallback
            logger.exception(
                "Async queue unavailable; falling back to inline embedding",
                extra={"id": memory_id, "error": str(exc)},
            )

    try:
        embedding = embed_text(payload.text)
    except Exception as exc:
        logger.exception(
            "Embedding failed",
            extra={"id": memory_id, "project": payload.project, "error": str(exc)},
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to generate embedding",
        ) from exc

    try:
        insert_memory(**memory_data, embedding=embedding)
    except Exception as exc:
        logger.exception(
            "Failed to persist memory",
            extra={"id": memory_id, "project": payload.project, "error": str(exc)},
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to persist memory",
        ) from exc

    logger.info(
        "Memory persisted",
        extra={
            "id": memory_id,
            "project": payload.project,
            "tenant_id": auth.tenant_id,
            "text_length": len(payload.text),
            "async": False,
            "pii_flags": list(pii_summary.keys()),
        },
    )

    return {"id": memory_id}


@app.post("/v1/memory.search")
def memory_search(
    payload: MemorySearchRequest,
    auth: AuthContext = Depends(fake_auth),
):
    """
    Perform a hybrid vector search scoped by tenant/user filters.
    """
    filters = payload.filters or {}
    filters.setdefault("tenant_id", auth.tenant_id)

    try:
        results = vector_search(
            query=payload.query,
            top_k=payload.top_k or 10,
            filters=filters,
            with_sources=payload.with_sources or False,
        )
    except Exception as exc:
        logger.exception(
            "Vector search failed",
            extra={"tenant_id": auth.tenant_id, "error": str(exc)},
        )
        raise HTTPException(status_code=500, detail="Search failed") from exc

    logger.info(
        "Search completed",
        extra={
            "tenant_id": auth.tenant_id,
            "project_filter": filters.get("project"),
            "result_count": len(results),
            "query_length": len(payload.query),
        },
    )

    return {"results": results}


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    status = check_health()
    if status.get("database") == "error" or status.get("vector") == "error":
        overall = "degraded"
    else:
        overall = "ok"
    return {"status": overall, **status}

