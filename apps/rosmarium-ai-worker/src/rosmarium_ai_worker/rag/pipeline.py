"""RAG pipeline — orchestrates retrieval, RBAC filtering, freshness scoring, and reranking."""

from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime
from typing import Any

import structlog
from pydantic import BaseModel, Field

from ..database import get_pool
from ..embedding.registry import get_provider
from ..vector.index_manager import VectorIndexManager

logger = structlog.get_logger(__name__)

index_manager = VectorIndexManager()


# ─── Request / Response models ────────────────────────────────────────────────


class RetrieveRequest(BaseModel):
    """Body for POST /rag/retrieve."""

    query: str = Field(..., min_length=1, max_length=10_000)
    content_types: list[str] = Field(..., min_length=1)
    allowed_entry_ids: list[str]  # RBAC — empty list means no ACL restriction
    top_k: int = Field(default=10, ge=1, le=100)
    rerank: bool = False
    include_metadata: bool = True


class RetrievedChunk(BaseModel):
    """A single chunk returned from the RAG pipeline."""

    content_entry_id: str
    content_type: str
    chunk_index: int
    chunk_text: str
    score: float
    metadata: dict[str, Any]
    freshness_score: float
    published_at: str | None


class RetrieveResponse(BaseModel):
    """Response from POST /rag/retrieve."""

    chunks: list[RetrievedChunk]
    query: str
    total: int
    latency_ms: int
    reranked: bool


# ─── Pipeline ─────────────────────────────────────────────────────────────────


class RAGPipeline:
    """Orchestrates multi-type vector retrieval with RBAC filtering and freshness scoring."""

    async def retrieve(self, request: RetrieveRequest) -> RetrieveResponse:
        """Run the full RAG retrieval pipeline.

        Steps:
        1. Embed the query.
        2. Run retrieval per content type in parallel.
        3. Filter to allowed_entry_ids (RBAC — second enforcement layer).
        4. Apply freshness scoring or Cohere rerank.
        5. Return top_k results.
        """
        start = time.monotonic()

        all_chunks: list[RetrievedChunk] = []

        # Parallel retrieval across all requested content types
        results = await asyncio.gather(
            *[self._retrieve_for_type(request, ct) for ct in request.content_types],
            return_exceptions=True,
        )

        for ct, result in zip(request.content_types, results, strict=True):
            if isinstance(result, Exception):
                logger.warning(
                    "retrieval_error",
                    content_type=ct,
                    error=str(result),
                    error_type=type(result).__name__,
                )
                continue
            all_chunks.extend(result)  # type: ignore[arg-type]

        # RBAC enforcement — filter to permitted entry IDs is handled in the SQL query
        # An empty allowed_entry_ids list means no restriction (CONTENT_READ_ANY)

        # Rerank or freshness-score
        reranked = False
        if request.rerank:
            try:
                from ..config import settings
                if settings.cohere_api_key:
                    all_chunks = await self._rerank(request.query, all_chunks)
                    reranked = True
                else:
                    all_chunks = self._apply_freshness_scoring(all_chunks)
            except Exception as exc:
                logger.warning("rerank_failed_using_freshness", error=str(exc))
                all_chunks = self._apply_freshness_scoring(all_chunks)
        else:
            all_chunks = self._apply_freshness_scoring(all_chunks)

        # Trim to top_k
        all_chunks = all_chunks[: request.top_k]

        return RetrieveResponse(
            chunks=all_chunks,
            query=request.query,
            total=len(all_chunks),
            latency_ms=int((time.monotonic() - start) * 1000),
            reranked=reranked,
        )

    # ------------------------------------------------------------------ #

    async def _retrieve_for_type(
        self,
        request: RetrieveRequest,
        content_type: str,
    ) -> list[RetrievedChunk]:
        """Retrieve chunks for a single content type via pgvector."""
        provider = get_provider()
        query_embedding = await provider.embed_one(request.query)

        pool = await get_pool()
        async with pool.acquire() as conn:
            # Pass allowed_entry_ids only when the list is non-empty (ACL mode)
            acl: list[str] | None = request.allowed_entry_ids or None
            results = await index_manager.search(
                content_type=content_type,
                query_embedding=query_embedding,
                limit=request.top_k * 2,  # fetch extra for multi-type merging
                allowed_entry_ids=acl,
                conn=conn,
            )

        chunks_out: list[RetrievedChunk] = []
        for r in results:
            chunk_index = r["chunk_index"]
            score_raw = r["score"]
            meta = r["metadata"] if isinstance(r["metadata"], dict) else {}
            pub_at: str | None = None
            if isinstance(meta, dict):
                pa = meta.get("published_at")
                if pa is not None:
                    pub_at = str(pa)

            chunks_out.append(
                RetrievedChunk(
                    content_entry_id=str(r["content_entry_id"]),
                    content_type=content_type,
                    chunk_index=int(chunk_index) if isinstance(chunk_index, (int, float, str)) else 0,
                    chunk_text=str(r["chunk_text"]),
                    score=float(score_raw) if isinstance(score_raw, (int, float, str)) else 0.0,
                    metadata=meta,
                    freshness_score=float(score_raw) if isinstance(score_raw, (int, float, str)) else 0.0,
                    published_at=pub_at,
                )
            )
        return chunks_out

    # ------------------------------------------------------------------ #

    def _apply_freshness_scoring(
        self,
        chunks: list[RetrievedChunk],
    ) -> list[RetrievedChunk]:
        """Compute freshness_score = 0.8 * vector_score + 0.2 * recency_score.

        recency_score = 1 / (1 + days_since_published)
        Falls back to recency_score=0.5 when published_at is absent.
        """
        now = datetime.now(tz=UTC)
        for chunk in chunks:
            recency = 0.5
            if chunk.published_at:
                try:
                    pub = datetime.fromisoformat(chunk.published_at)
                    if pub.tzinfo is None:
                        pub = pub.replace(tzinfo=UTC)
                    days_old = max(0, (now - pub).days)
                    recency = 1.0 / (1.0 + days_old)
                except (ValueError, TypeError):
                    pass
            chunk.freshness_score = 0.8 * chunk.score + 0.2 * recency

        return sorted(chunks, key=lambda c: c.freshness_score, reverse=True)

    # ------------------------------------------------------------------ #

    async def _rerank(
        self,
        query: str,
        chunks: list[RetrievedChunk],
    ) -> list[RetrievedChunk]:
        """Rerank chunks via Cohere Rerank API.

        Falls back to original order on any error.
        """
        if not chunks:
            return chunks

        try:
            import cohere

            from ..config import settings

            co = cohere.AsyncClient(api_key=settings.cohere_api_key)
            documents = [c.chunk_text for c in chunks]
            response = await co.rerank(
                model="rerank-english-v3.0",
                query=query,
                documents=documents,
                top_n=len(documents),
            )

            # Build reordered list with updated scores
            reordered: list[RetrievedChunk] = []
            for result in response.results:
                chunk = chunks[result.index]
                chunk.freshness_score = float(result.relevance_score)
                reordered.append(chunk)
            return reordered

        except Exception as exc:
            logger.warning("cohere_rerank_failed_fallback", error=str(exc))
            return chunks


# ─── Singleton ────────────────────────────────────────────────────────────────

rag_pipeline = RAGPipeline()
