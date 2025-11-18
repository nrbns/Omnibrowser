"""
LLM Search Endpoint
Performs web search + LLM synthesis and returns answer with citations.
"""

from __future__ import annotations

import logging
import os
import time
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from apps.api.services.search_aggregator import aggregate_search
from apps.api.openai_client import get_openai_client

logger = logging.getLogger(__name__)

router = APIRouter()


class Citation(BaseModel):
    title: str
    url: str
    snippet: Optional[str] = None
    source: Optional[str] = None


class SearchLLMRequest(BaseModel):
    query: str
    max_results: Optional[int] = 8
    temperature: Optional[float] = 0.2


class SearchLLMResponse(BaseModel):
    query: str
    answer: str
    citations: List[Citation]
    raw_results: List[Citation]
    timestamp: float
    latency_ms: int


def _fallback_answer(query: str, results: List[dict]) -> str:
    if not results:
        return f"I couldn't find any web results for “{query}”. Try refining the question."
    top_titles = ", ".join(r.get("title", "")[:40] for r in results[:3])
    domains = ", ".join({r.get("source", "") or r.get("domain", "") for r in results[:3]})
    return (
        f"Found {len(results)} sources for “{query}”. Leading coverage includes {top_titles} "
        f"from {domains or 'major sites'}. Click the sources for details."
    )


async def _synthesize_answer(
    query: str,
    results: List[dict],
    temperature: float,
) -> str:
    openai = get_openai_client()
    if not openai.api_key:
        return _fallback_answer(query, results)

    context_lines: List[str] = []
    for idx, result in enumerate(results[:8], start=1):
        snippet = (result.get("snippet") or "")[:500]
        context_lines.append(
            f"[{idx}] {result.get('title', 'Untitled')} — {result.get('url', '')}\n{snippet}"
        )

    if not context_lines:
        return _fallback_answer(query, results)

    user_content = (
        "You are Regen's AI research copilot. Answer the query using ONLY the context below. "
        "Cite sources inline using [n] that correspond to the numbered context items.\n\n"
        f"Query: {query}\n\nContext:\n" + "\n\n".join(context_lines)
    )

    answer_chunks: List[str] = []
    try:
        async for chunk in openai.stream_chat(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Provide concise, factual answers with at most three short paragraphs. "
                        "Use markdown bullets when helpful. Always cite sources as [n]."
                    ),
                },
                {"role": "user", "content": user_content},
            ],
            model=os.getenv("OPENAI_SEARCH_MODEL", "gpt-4o-mini"),
            temperature=temperature,
            max_tokens=700,
        ):
            if chunk.get("error"):
                raise RuntimeError(chunk["error"])
            if chunk.get("text"):
                answer_chunks.append(chunk["text"])
    except Exception as exc:
        logger.warning("LLM synthesis failed: %s", exc)
        return _fallback_answer(query, results)

    answer = "".join(answer_chunks).strip()
    return answer or _fallback_answer(query, results)


@router.post("/search_llm", response_model=SearchLLMResponse)
async def search_llm(request: SearchLLMRequest):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    logger.info("search_llm received query='%s'", query)
    start = time.perf_counter()

    try:
        search_payload = await aggregate_search(
            query=query,
            sources=['duckduckgo', 'bing'],
            max_results=min(max(request.max_results or 8, 3), 12),
            bing_api_key=os.getenv('BING_API_KEY'),
            include_summary=False,
        )
    except Exception as exc:
        logger.error("Search aggregation failed: %s", exc)
        raise HTTPException(status_code=502, detail="Search provider unavailable")

    results: List[dict] = search_payload if isinstance(search_payload, list) else search_payload.get('results', [])
    if not results:
        raise HTTPException(status_code=404, detail="No search results found")

    answer = await _synthesize_answer(query, results, request.temperature or 0.2)

    elapsed = int((time.perf_counter() - start) * 1000)

    citations = [
        Citation(
            title=item.get('title', '') or item.get('url', ''),
            url=item.get('url', ''),
            snippet=item.get('snippet'),
            source=item.get('source') or item.get('domain'),
        )
        for item in results[:request.max_results or 8]
    ]

    logger.info(
        "search_llm success query='%s' results=%d latency_ms=%d",
        query,
        len(results),
        elapsed,
    )

    return SearchLLMResponse(
        query=query,
        answer=answer,
        citations=citations,
        raw_results=citations,
        timestamp=time.time(),
        latency_ms=elapsed,
    )

