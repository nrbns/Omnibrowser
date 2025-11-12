"""
Search Routes
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import json

from apps.api.cache import cache_get, cache_set

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    max_results: Optional[int] = 20

class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str
    source: str

class SearchResponse(BaseModel):
    results: List[SearchResult]

@router.post("", response_model=SearchResponse)
async def search(request: SearchRequest):
    """Perform hybrid search"""
    cache_key = f"search:{request.query}:{request.max_results}"
    cached = await cache_get(cache_key)
    if cached:
        payload = json.loads(cached)
        return SearchResponse(results=[SearchResult(**item) for item in payload])

    # TODO: Replace with real hybrid search service.
    result_count = max(1, min(request.max_results or 20, 5))
    generated = [
        SearchResult(
            title=f"Result {idx + 1} for {request.query}",
            url=f"https://example.com/{request.query.replace(' ', '-')}/{idx}",
            snippet="This is a cached placeholder result while live providers are wiring up.",
            source="cache",
        )
        for idx in range(result_count)
    ]

    await cache_set(cache_key, [result.model_dump() for result in generated], ttl_seconds=45)

    return SearchResponse(results=generated)

