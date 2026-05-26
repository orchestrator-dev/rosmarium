"""Tests for the embedding job processor."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cortex_ai_worker.chunking.base import Chunk
from cortex_ai_worker.workers.embedding_worker import EmbedJobPayload, process_embedding_job


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_payload(fields: list[dict] | None = None) -> dict:
    return {
        "contentEntryId": "entry-123",
        "contentType": "article",
        "fields": fields or [{"fieldName": "title", "text": "Hello world"}],
        "locale": "en",
        "triggeredBy": "create",
    }


def _make_chunk(text: str = "chunk text", idx: int = 0) -> Chunk:
    return Chunk(text=text, chunk_index=idx, char_start=0, char_end=len(text), metadata={})


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_empty_fields_skipped() -> None:
    """No DB calls when all field texts are blank."""
    payload = _make_payload(fields=[{"fieldName": "title", "text": "   "}])

    with patch("cortex_ai_worker.workers.embedding_worker.get_provider") as mock_get_prov, \
         patch("cortex_ai_worker.workers.embedding_worker.get_chunker") as mock_get_chunker, \
         patch("cortex_ai_worker.workers.embedding_worker.get_pool") as mock_get_pool:

        await process_embedding_job(payload)

        mock_get_prov.assert_not_called()
        mock_get_chunker.assert_not_called()
        mock_get_pool.assert_not_called()


@pytest.mark.asyncio
async def test_full_pipeline_happy_path(mock_pool: AsyncMock) -> None:
    """Full embed → chunk → upsert → metadata update flow."""
    chunk = _make_chunk("Some article text", idx=0)

    mock_chunker = MagicMock()
    mock_chunker.chunk.return_value = [chunk]

    mock_provider = AsyncMock()
    mock_provider.embed.return_value = [[0.1, 0.2, 0.3]]
    mock_provider.model_name = "nomic-embed-text"
    mock_provider.dimensions = 768

    mock_index = AsyncMock()

    # Grab the pre-configured conn from the conftest mock_pool
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value

    with patch("cortex_ai_worker.workers.embedding_worker.get_chunker", return_value=mock_chunker), \
         patch("cortex_ai_worker.workers.embedding_worker.get_provider", return_value=mock_provider), \
         patch("cortex_ai_worker.workers.embedding_worker.get_pool", return_value=mock_pool), \
         patch("cortex_ai_worker.workers.embedding_worker.index_manager", mock_index):

        await process_embedding_job(_make_payload())

    # Chunker called with combined text
    mock_chunker.chunk.assert_called_once()
    args, _ = mock_chunker.chunk.call_args
    assert "title" in args[0]

    # Provider embedded the chunk texts
    mock_provider.embed.assert_called_once_with(["Some article text"])

    # Table ensured then embeddings upserted
    mock_index.ensure_table.assert_called_once_with("article", 768, mock_conn)
    mock_index.upsert_embeddings.assert_called_once()
    upsert_args = mock_index.upsert_embeddings.call_args[0]
    assert upsert_args[0] == "article"
    assert upsert_args[1] == "entry-123"
    chunks_arg = upsert_args[2]
    assert len(chunks_arg) == 1
    assert chunks_arg[0]["chunk_index"] == 0
    assert chunks_arg[0]["embedding"] == [0.1, 0.2, 0.3]

    # Metadata update executed
    mock_conn.execute.assert_called_once()
    sql = mock_conn.execute.call_args[0][0]
    assert "embeddedAt" in sql


@pytest.mark.asyncio
async def test_multiple_fields_concatenated(mock_pool: AsyncMock) -> None:
    """Multiple field texts are joined with fieldName prefix."""
    payload = _make_payload(fields=[
        {"fieldName": "title", "text": "My Title"},
        {"fieldName": "body", "text": "My Body"},
    ])

    captured_text: list[str] = []

    def capture_chunk(text: str, metadata: dict | None = None) -> list[Chunk]:
        captured_text.append(text)
        return [_make_chunk(text, idx=0)]

    mock_chunker = MagicMock()
    mock_chunker.chunk.side_effect = capture_chunk

    mock_provider = AsyncMock()
    mock_provider.embed.return_value = [[0.5] * 768]
    mock_provider.model_name = "nomic-embed-text"
    mock_provider.dimensions = 768

    mock_index = AsyncMock()

    with patch("cortex_ai_worker.workers.embedding_worker.get_chunker", return_value=mock_chunker), \
         patch("cortex_ai_worker.workers.embedding_worker.get_provider", return_value=mock_provider), \
         patch("cortex_ai_worker.workers.embedding_worker.get_pool", return_value=mock_pool), \
         patch("cortex_ai_worker.workers.embedding_worker.index_manager", mock_index):

        await process_embedding_job(payload)

    assert len(captured_text) == 1
    combined = captured_text[0]
    assert "title: My Title" in combined
    assert "body: My Body" in combined


@pytest.mark.asyncio
async def test_invalid_payload_raises() -> None:
    """ValidationError raised on malformed payload."""
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        await process_embedding_job({"contentEntryId": "x"})  # missing required fields


def test_embed_job_payload_validation() -> None:
    """Pydantic model validates correctly."""
    p = EmbedJobPayload.model_validate(_make_payload())
    assert p.contentEntryId == "entry-123"
    assert p.contentType == "article"
    assert p.triggeredBy == "create"
    assert len(p.fields) == 1
    assert p.fields[0].fieldName == "title"
