"""Search endpoints — called internally by cortex-server.

Routes:
  POST /search/embed        — embed a single query string (sync, not queued)
  POST /search/embed-batch  — embed multiple texts in one call (backfill)
  POST /search              — full semantic search (legacy, kept for compat)
"""

import time
from typing import Any, Literal

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from ...config import settings
from ...database import get_db
from ...embedding.registry import get_provider
from ...vector.index_manager import VectorIndexManager

logger = structlog.get_logger(__name__)

router = APIRouter()

index_manager = VectorIndexManager()

# ─── Auth dependency ───────────────────────────────────────────────────────────

_WORKER_SECRET_HEADER = "x-worker-secret"  # noqa: S105 — header name, not a credential


async def require_worker_secret(
    x_worker_secret: str | None = Header(default=None, alias=_WORKER_SECRET_HEADER),
) -> None:
    """Validate X-Worker-Secret header.  Returns 403 if missing or incorrect."""
    if x_worker_secret is None or x_worker_secret != settings.worker_secret:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Worker-Secret")


# ─── Embed endpoint models ─────────────────────────────────────────────────────


class EmbedRequest(BaseModel):
    """Single-text embed request."""

    text: str = Field(..., min_length=1, max_length=10_000)
    input_type: Literal["search_query", "search_document"] = "search_document"


class EmbedResponse(BaseModel):
    """Single-text embed response."""

    embedding: list[float]
    dimensions: int
    model: str
    latency_ms: int


class EmbedBatchRequest(BaseModel):
    """Multi-text embed request (for backfill operations)."""

    texts: list[str] = Field(..., min_length=1)
    input_type: Literal["search_query", "search_document"] = "search_document"


class EmbedBatchResponse(BaseModel):
    """Multi-text embed response."""

    embeddings: list[list[float]]
    dimensions: int
    model: str
    latency_ms: int


# ─── /search/embed ─────────────────────────────────────────────────────────────


@router.post("/embed", response_model=EmbedResponse, dependencies=[Depends(require_worker_secret)])
async def embed_query(request: EmbedRequest) -> EmbedResponse:
    """Embed a single search query string at request time (sync, not queued).

    Auth: X-Worker-Secret header required.
    Note: query text is intentionally NOT logged (PII concern).
    """
    start = time.monotonic()

    provider = get_provider()
    embedding = await provider.embed_one_with_input_type(
        request.text, input_type=request.input_type
    )

    latency_ms = int((time.monotonic() - start) * 1000)

    logger.info(
        "query_embed_request",
        latency_ms=latency_ms,
        model=provider.model_name,
        input_type=request.input_type,
        # query text intentionally omitted — PII
    )

    return EmbedResponse(
        embedding=embedding,
        dimensions=len(embedding),
        model=provider.model_name,
        latency_ms=latency_ms,
    )


# ─── /search/embed-batch ───────────────────────────────────────────────────────

_MAX_BATCH_SIZE = 500


@router.post(
    "/embed-batch",
    response_model=EmbedBatchResponse,
    dependencies=[Depends(require_worker_secret)],
)
async def embed_batch(request: EmbedBatchRequest) -> EmbedBatchResponse:
    """Embed multiple texts in one call (used for backfill operations).

    Auth: X-Worker-Secret header required.
    Limit: max 500 texts per call.
    """
    if len(request.texts) > _MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=422,
            detail=f"Batch size {len(request.texts)} exceeds maximum of {_MAX_BATCH_SIZE}",
        )

    start = time.monotonic()

    provider = get_provider()
    embeddings = await provider.embed_batch_with_input_type(
        request.texts, input_type=request.input_type
    )

    latency_ms = int((time.monotonic() - start) * 1000)

    logger.info(
        "query_embed_request",
        batch_size=len(request.texts),
        latency_ms=latency_ms,
        model=provider.model_name,
        input_type=request.input_type,
        # texts intentionally omitted — PII
    )

    return EmbedBatchResponse(
        embeddings=embeddings,
        dimensions=len(embeddings[0]) if embeddings else 0,
        model=provider.model_name,
        latency_ms=latency_ms,
    )


# ─── /search (legacy semantic search) ────────────────────────────────────────


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


@router.post("", response_model=SearchResponse, dependencies=[Depends(require_worker_secret)])
async def semantic_search(
    request: SearchRequest,
    conn: Any = Depends(get_db),
) -> SearchResponse:
    """Perform semantic search over a content type's embeddings.

    This endpoint is called internally by cortex-server, never by external clients.
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
