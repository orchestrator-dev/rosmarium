"""Embedding job processor — processes jobs from the embedding-jobs queue."""

import re
import time
from typing import Any, Literal

import structlog
from pydantic import BaseModel

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

    # 2. Chunk the text
    chunks = _simple_chunk(
        text,
        chunk_size=settings.chunking_chunk_size,
        overlap=settings.chunking_chunk_overlap,
    )

    # 3. Embed all chunks in one batch call
    provider = get_provider()
    chunk_texts: list[str] = [str(c["text"]) for c in chunks]
    start = time.monotonic()
    embeddings = await provider.embed(chunk_texts)
    latency_ms = int((time.monotonic() - start) * 1000)

    logger.info(
        "embedding_complete",
        entry_id=payload.contentEntryId,
        content_type=payload.contentType,
        chunk_count=len(chunks),
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
                "chunk_index": i,
                "chunk_text": str(chunks[i]["text"]),
                "embedding": embeddings[i],
                "metadata": {
                    "field_names": [f.fieldName for f in payload.fields],
                    "locale": payload.locale,
                    "triggered_by": payload.triggeredBy,
                },
            }
            for i in range(len(chunks))
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
        chunk_count=len(chunks),
    )


# Sentence boundary pattern for chunking
_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+")


def _simple_chunk(
    text: str,
    chunk_size: int,
    overlap: int,
) -> list[dict[str, str | int]]:
    """Split text into chunks of approximately chunk_size characters.

    Uses sentence boundaries ('. ', '! ', '? ') for splitting.
    Adds overlap from the end of the previous chunk.

    Returns:
        List of dicts with keys: text, char_start, char_end.
    """
    sentences = _SENTENCE_BOUNDARY.split(text)
    chunks: list[dict[str, str | int]] = []

    current_text = ""
    current_start = 0
    char_pos = 0

    for sentence in sentences:
        sentence_with_space = sentence if not current_text else " " + sentence

        if len(current_text) + len(sentence_with_space) > chunk_size and current_text:
            # Emit current chunk
            chunks.append({
                "text": current_text.strip(),
                "char_start": current_start,
                "char_end": char_pos,
            })

            # Start new chunk with overlap from the end of previous
            if overlap > 0 and len(current_text) > overlap:
                overlap_text = current_text[-overlap:]
                current_text = overlap_text + " " + sentence
                current_start = char_pos - overlap
            else:
                current_text = sentence
                current_start = char_pos
        else:
            current_text += sentence_with_space

        char_pos += len(sentence_with_space)

    # Don't forget the last chunk
    if current_text.strip():
        chunks.append({
            "text": current_text.strip(),
            "char_start": current_start,
            "char_end": char_pos,
        })

    return chunks if chunks else [{"text": text.strip(), "char_start": 0, "char_end": len(text)}]
