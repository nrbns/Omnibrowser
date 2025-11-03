"""
Search Routes
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

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
    # TODO: Call hybrid search service
    return SearchResponse(results=[])

