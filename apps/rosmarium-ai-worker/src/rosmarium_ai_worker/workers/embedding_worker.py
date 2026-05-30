"""Embedding job processor — processes jobs from the embedding-jobs queue."""

import time
from typing import Any, Literal

import structlog
from pydantic import BaseModel

from ..chunking.registry import get_chunker
from ..config import settings
from ..database import get_pool
from ..embedding.registry import get_provider
from ..vector.index_manager import VectorIndexManager

logger = structlog.get_logger(__name__)

index_manager = VectorIndexManager()


class FieldPayload(BaseModel):
    """A single field to embed."""

    fieldName: str
    text: str


class EmbedJobPayload(BaseModel):
    """Validated payload for an embed-content job."""

    contentEntryId: str
    contentType: str
    fields: list[FieldPayload]
    locale: str
    triggeredBy: Literal["create", "update", "manual"]


async def process_embedding_job(raw_payload: dict[str, Any]) -> None:
    """Process an embedding job from the queue.

    Steps:
    1. Validate payload with Pydantic
    2. Concatenate field texts
    3. Chunk the text
    4. Embed all chunks in a single batch call
    5. Upsert embeddings to pgvector
    6. Update content_entries metadata with embeddedAt timestamp
    """
    payload = EmbedJobPayload.model_validate(raw_payload)

    # 1. Concatenate field texts
    text = " ".join(
        f"{f.fieldName}: {f.text}" for f in payload.fields if f.text.strip()
    )
    if not text.strip():
        logger.info(
            "empty_text_skipped",
            entry_id=payload.contentEntryId,
            content_type=payload.contentType,
        )
        return

    from opentelemetry import trace
    tracer = trace.get_tracer(__name__)

    # 2. Chunk the text using the configured strategy
    with tracer.start_as_current_span("chunking.process") as span:
        chunker = get_chunker(settings.chunking_default_strategy)
        raw_chunks = chunker.chunk(
            text,
            metadata={
                "field_names": [f.fieldName for f in payload.fields],
                "locale": payload.locale,
            },
        )
        span.set_attribute("strategy", settings.chunking_default_strategy)
        span.set_attribute("chunk_count", len(raw_chunks))
        span.set_attribute("text_length", len(text))

    # 3. Embed all chunks in one batch call
    with tracer.start_as_current_span("embedding.generate") as span:
        provider = get_provider()
        chunk_texts: list[str] = [c.text for c in raw_chunks]
        start = time.monotonic()
        embeddings = await provider.embed(chunk_texts)
        latency_ms = int((time.monotonic() - start) * 1000)
        
        span.set_attribute("provider", settings.embedding_provider)
        span.set_attribute("model", provider.model_name)
        span.set_attribute("batch_size", len(chunk_texts))
        span.set_attribute("latency_ms", latency_ms)
        span.set_attribute("token_count", sum(len(c) for c in chunk_texts) // 4)

    logger.info(
        "embedding_complete",
        entry_id=payload.contentEntryId,
        content_type=payload.contentType,
        chunk_count=len(raw_chunks),
        latency_ms=latency_ms,
        provider=settings.embedding_provider,
        model=provider.model_name,
    )

    # 4. Ensure pgvector table exists and upsert embeddings
    pool = await get_pool()
    async with pool.acquire() as conn:
        await index_manager.ensure_table(payload.contentType, provider.dimensions, conn)

        # 5. Upsert embeddings
        chunk_records: list[dict[str, object]] = [
            {
                "chunk_index": c.chunk_index,
                "chunk_text": c.text,
                "embedding": embeddings[i],
                "metadata": {
                    **c.metadata,
                    "triggered_by": payload.triggeredBy,
                    "char_start": c.char_start,
                    "char_end": c.char_end,
                },
            }
            for i, c in enumerate(raw_chunks)
        ]
        await index_manager.upsert_embeddings(
            payload.contentType,
            payload.contentEntryId,
            chunk_records,
            conn,
        )

        # 6. Update content_entries metadata with embeddedAt
        await conn.execute(
            """
            UPDATE content_entries
            SET metadata = jsonb_set(
                COALESCE(metadata, '{}'),
                '{embeddedAt}',
                to_jsonb(now()::text)
            )
            WHERE id = $1
            """,
            payload.contentEntryId,
        )

    logger.info(
        "embedding_job_complete",
        entry_id=payload.contentEntryId,
        content_type=payload.contentType,
        chunk_count=len(raw_chunks),
    )
