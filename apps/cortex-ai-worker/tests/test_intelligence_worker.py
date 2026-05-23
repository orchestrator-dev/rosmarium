"""Tests for process_intelligence_job — all intelligence singletons mocked."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cortex_ai_worker.intelligence.tagger import TagResult
from cortex_ai_worker.workers.intelligence_worker import (
    process_intelligence_job,
)


def _make_payload(**overrides: object) -> dict:
    base: dict = {
        "contentEntryId": "entry-123",
        "contentType": "article",
        "fields": [{"fieldName": "title", "text": "Test title about technology"}],
        "locale": "en",
        "candidateLabels": ["technology", "business"],
        "operations": ["tag", "ner", "deduplicate"],
    }
    base.update(overrides)
    return base


def _make_mock_conn() -> MagicMock:
    """Create a mock asyncpg Connection that behaves as an async context manager."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=None)
    conn.execute = AsyncMock()
    return conn


def _make_get_pool_mock(conn: MagicMock | None = None) -> AsyncMock:
    """Create a mock for get_pool() that returns a pool with an acquire() context manager.

    Key detail: pool itself must be a MagicMock (not AsyncMock) so that
    pool.acquire() returns a synchronous object that supports __aenter__/__aexit__,
    not a coroutine.
    """
    if conn is None:
        conn = _make_mock_conn()

    # The acquire() call returns a context manager object (not a coroutine)
    ctx_manager = MagicMock()
    ctx_manager.__aenter__ = AsyncMock(return_value=conn)
    ctx_manager.__aexit__ = AsyncMock(return_value=None)

    pool = MagicMock()  # NOT AsyncMock — pool itself is sync
    pool.acquire = MagicMock(return_value=ctx_manager)

    get_pool_mock = AsyncMock(return_value=pool)
    return get_pool_mock


class TestIntelligenceWorker:
    @pytest.mark.asyncio
    async def test_runs_all_requested_operations(self) -> None:
        """All operations in the 'operations' list should be executed."""
        executed: list[str] = []

        async def fake_tag_async(text: str, labels: list, threshold: float = 0.3) -> list:
            executed.append("tag")
            return [TagResult(label="technology", score=0.9)]

        async def fake_extract_async(text: str) -> list:
            executed.append("ner")
            return []

        get_pool = _make_get_pool_mock()

        with (
            patch("cortex_ai_worker.workers.intelligence_worker.auto_tagger") as mock_tagger,
            patch("cortex_ai_worker.workers.intelligence_worker.ner_extractor") as mock_ner,
            patch("cortex_ai_worker.workers.intelligence_worker.get_pool", new=get_pool),
        ):
            mock_tagger.tag_async = fake_tag_async
            mock_ner.extract_async = fake_extract_async
            mock_ner.to_dict = MagicMock(return_value={})

            await process_intelligence_job(_make_payload(operations=["tag", "ner"]))

        assert "tag" in executed
        assert "ner" in executed

    @pytest.mark.asyncio
    async def test_skips_tag_when_candidate_labels_empty(self) -> None:
        """Tag operation should be skipped when candidateLabels is empty."""
        tag_called = False

        async def fake_tag_async(*args: object, **kwargs: object) -> list:
            nonlocal tag_called
            tag_called = True
            return []

        conn = _make_mock_conn()
        get_pool = _make_get_pool_mock(conn)

        with (
            patch("cortex_ai_worker.workers.intelligence_worker.auto_tagger") as mock_tagger,
            patch("cortex_ai_worker.workers.intelligence_worker.ner_extractor") as mock_ner,
            patch("cortex_ai_worker.workers.intelligence_worker.get_pool", new=get_pool),
        ):
            mock_tagger.tag_async = fake_tag_async
            mock_ner.extract_async = AsyncMock(return_value=[])
            mock_ner.to_dict = MagicMock(return_value={})

            await process_intelligence_job(
                _make_payload(candidateLabels=[], operations=["tag"])
            )

        assert not tag_called

    @pytest.mark.asyncio
    async def test_continues_if_one_operation_fails(self) -> None:
        """A failure in tagging should not prevent NER from running."""
        ner_called = False

        async def failing_tag(*args: object, **kwargs: object) -> list:
            raise RuntimeError("tag model crashed")

        async def fake_ner(text: str) -> list:
            nonlocal ner_called
            ner_called = True
            return []

        get_pool = _make_get_pool_mock()

        with (
            patch("cortex_ai_worker.workers.intelligence_worker.auto_tagger") as mock_tagger,
            patch("cortex_ai_worker.workers.intelligence_worker.ner_extractor") as mock_ner,
            patch("cortex_ai_worker.workers.intelligence_worker.get_pool", new=get_pool),
        ):
            mock_tagger.tag_async = failing_tag
            mock_ner.extract_async = fake_ner
            mock_ner.to_dict = MagicMock(return_value={"ORG": ["OpenAI"]})

            # Should not raise
            await process_intelligence_job(_make_payload(operations=["tag", "ner"]))

        assert ner_called

    @pytest.mark.asyncio
    async def test_skips_empty_text_gracefully(self) -> None:
        """Jobs with empty text fields should return without calling any operation."""
        tag_called = False

        async def spy_tag(*args: object, **kwargs: object) -> list:
            nonlocal tag_called
            tag_called = True
            return []

        with patch("cortex_ai_worker.workers.intelligence_worker.auto_tagger") as mock_tagger:
            mock_tagger.tag_async = spy_tag
            await process_intelligence_job(
                _make_payload(fields=[{"fieldName": "title", "text": ""}])
            )

        assert not tag_called

    @pytest.mark.asyncio
    async def test_writes_results_to_metadata(self) -> None:
        """Results should be written to content_entries via UPDATE statement."""
        execute_calls: list[str] = []

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(return_value=None)

        async def fake_execute(query: str, *args: object) -> None:
            execute_calls.append(query)

        conn.execute = fake_execute
        get_pool = _make_get_pool_mock(conn)

        with (
            patch("cortex_ai_worker.workers.intelligence_worker.auto_tagger") as mock_tagger,
            patch("cortex_ai_worker.workers.intelligence_worker.ner_extractor") as mock_ner,
            patch("cortex_ai_worker.workers.intelligence_worker.get_pool", new=get_pool),
        ):
            mock_tagger.tag_async = AsyncMock(return_value=[TagResult(label="technology", score=0.9)])
            mock_ner.extract_async = AsyncMock(return_value=[])
            mock_ner.to_dict = MagicMock(return_value={})

            await process_intelligence_job(_make_payload(operations=["tag", "ner"]))

        assert any("UPDATE content_entries" in q for q in execute_calls)
