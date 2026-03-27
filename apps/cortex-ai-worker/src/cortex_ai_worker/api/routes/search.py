"""Semantic search endpoint — called internally by rosmarium-server."""

from typing import Any

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ...database import get_db
from ...embedding.registry import get_provider
from ...vector.index_manager import VectorIndexManager

logger = structlog.get_logger(__name__)

router = APIRouter()

index_manager = VectorIndexManager()


class SearchRequest(BaseModel):
    """Semantic search request body."""

    query: str = Field(..., min_length=1, max_length=10000)
    content_type: str = Field(..., min_length=1, max_length=100)
    limit: int = Field(default=10, ge=1, le=100)
    allowed_entry_ids: list[str] | None = None


class SearchResult(BaseModel):
    """A single search result."""

    content_entry_id: str
    chunk_index: int
    chunk_text: str
    score: float
    metadata: dict[str, Any]


class SearchResponse(BaseModel):
    """Semantic search response."""

    results: list[SearchResult]
    query: str
    content_type: str


@router.post("", response_model=SearchResponse)
async def semantic_search(
    request: SearchRequest,
    conn: Any = Depends(get_db),
) -> SearchResponse:
    """Perform semantic search over a content type's embeddings.

    This endpoint is called internally by rosmarium-server, never by external clients.
    """
    # 1. Embed the query
    provider = get_provider()
    query_embedding = await provider.embed_one(request.query)

    # 2. Search pgvector
    results = await index_manager.search(
        content_type=request.content_type,
        query_embedding=query_embedding,
        limit=request.limit,
        allowed_entry_ids=request.allowed_entry_ids,
        conn=conn,
    )

    logger.info(
        "semantic_search_complete",
        content_type=request.content_type,
        result_count=len(results),
        limit=request.limit,
        has_acl=request.allowed_entry_ids is not None,
    )

    return SearchResponse(
        results=[
            SearchResult(
                content_entry_id=str(r["content_entry_id"]),
                chunk_index=r["chunk_index"],  # type: ignore[arg-type]
                chunk_text=str(r["chunk_text"]),
                score=r["score"],  # type: ignore[arg-type]
                metadata=r["metadata"] if isinstance(r["metadata"], dict) else {},
            )
            for r in results
        ],
        query=request.query,
        content_type=request.content_type,
    )
