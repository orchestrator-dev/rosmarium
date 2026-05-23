"""RAG endpoints — called internally by cortex-server.

Routes:
  POST /rag/retrieve         — synchronous JSON retrieval
  POST /rag/retrieve/stream  — Server-Sent Events streaming retrieval
"""

from __future__ import annotations

import json
import time
from collections.abc import AsyncGenerator
from typing import Any

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse

from ...config import settings
from ...rag.pipeline import RAGPipeline, RetrieveRequest, RetrieveResponse

logger = structlog.get_logger(__name__)

router = APIRouter()

# ─── Auth dependency ───────────────────────────────────────────────────────────

_WORKER_SECRET_HEADER = "x-worker-secret"  # noqa: S105 — header name, not a credential


async def require_worker_secret(
    x_worker_secret: str | None = Header(default=None, alias=_WORKER_SECRET_HEADER),
) -> None:
    """Validate X-Worker-Secret header.  Returns 403 if missing or incorrect."""
    if x_worker_secret is None or x_worker_secret != settings.worker_secret:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Worker-Secret")


# ─── Shared pipeline instance ─────────────────────────────────────────────────

_pipeline = RAGPipeline()


# ─── POST /rag/retrieve ───────────────────────────────────────────────────────


@router.post(
    "/retrieve",
    response_model=RetrieveResponse,
    dependencies=[Depends(require_worker_secret)],
    summary="RAG retrieve — synchronous JSON",
)
async def rag_retrieve(request: RetrieveRequest) -> RetrieveResponse:
    """Run RAG retrieval and return results as JSON.

    Auth: X-Worker-Secret header required.
    """
    logger.info(
        "rag_retrieve_request",
        content_types=request.content_types,
        top_k=request.top_k,
        rerank=request.rerank,
        has_acl=bool(request.allowed_entry_ids),
    )

    response = await _pipeline.retrieve(request)

    logger.info(
        "rag_retrieve_complete",
        total=response.total,
        latency_ms=response.latency_ms,
        reranked=response.reranked,
    )

    return response


# ─── POST /rag/retrieve/stream ────────────────────────────────────────────────


@router.post(
    "/retrieve/stream",
    dependencies=[Depends(require_worker_secret)],
    summary="RAG retrieve — SSE streaming",
)
async def rag_retrieve_stream(request: RetrieveRequest) -> StreamingResponse:
    """Run RAG retrieval and stream results as Server-Sent Events.

    SSE event types (in order):
      event: chunk
      data: { chunk_index, content_entry_id, content_type, chunk_text, score, freshness_score }

      event: done
      data: { total, latency_ms, reranked }

    Auth: X-Worker-Secret header required.
    """

    async def _event_stream() -> AsyncGenerator[str, None]:
        start = time.monotonic()
        try:
            response = await _pipeline.retrieve(request)
            for chunk in response.chunks:
                payload: dict[str, Any] = {
                    "chunk_index": chunk.chunk_index,
                    "content_entry_id": chunk.content_entry_id,
                    "content_type": chunk.content_type,
                    "chunk_text": chunk.chunk_text,
                    "score": chunk.score,
                    "freshness_score": chunk.freshness_score,
                    "published_at": chunk.published_at,
                    "metadata": chunk.metadata,
                }
                yield f"event: chunk\ndata: {json.dumps(payload)}\n\n"

            done_payload: dict[str, Any] = {
                "total": response.total,
                "latency_ms": int((time.monotonic() - start) * 1000),
                "reranked": response.reranked,
            }
            yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"

        except Exception as exc:
            error_payload: dict[str, Any] = {"error": str(exc), "type": type(exc).__name__}
            yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"
            logger.error("rag_stream_error", error=str(exc), error_type=type(exc).__name__)

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
