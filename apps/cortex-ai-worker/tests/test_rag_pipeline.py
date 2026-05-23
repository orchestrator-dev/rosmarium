"""Tests for RAGPipeline — retrieval, RBAC filtering, freshness scoring, rerank fallback."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cortex_ai_worker.rag.pipeline import (
    RAGPipeline,
    RetrievedChunk,
    RetrieveRequest,
)


def _make_request(**kwargs: object) -> RetrieveRequest:
    defaults: dict = {
        "query": "test query",
        "content_types": ["article"],
        "allowed_entry_ids": [],
        "top_k": 10,
        "rerank": False,
    }
    defaults.update(kwargs)
    return RetrieveRequest(**defaults)


def _make_chunk(
    entry_id: str = "entry-1",
    content_type: str = "article",
    score: float = 0.9,
    published_at: str | None = None,
) -> RetrievedChunk:
    return RetrievedChunk(
        content_entry_id=entry_id,
        content_type=content_type,
        chunk_index=0,
        chunk_text="Some chunk text.",
        score=score,
        metadata={},
        freshness_score=score,
        published_at=published_at,
    )


# ─── Freshness scoring ────────────────────────────────────────────────────────


class TestFreshnessScoring:
    def test_recent_content_scores_higher(self) -> None:
        """A recently published chunk should beat an older one at the same vector score."""
        pipeline = RAGPipeline()
        now = datetime.now(tz=timezone.utc)
        recent = _make_chunk(entry_id="new", score=0.8, published_at=(now - timedelta(days=1)).isoformat())
        old = _make_chunk(entry_id="old", score=0.8, published_at=(now - timedelta(days=365)).isoformat())

        scored = pipeline._apply_freshness_scoring([old, recent])
        assert scored[0].content_entry_id == "new", "Recent content should rank first"

    def test_missing_published_at_gets_neutral_recency(self) -> None:
        """Chunks without published_at use recency=0.5 (neutral)."""
        pipeline = RAGPipeline()
        chunk = _make_chunk(score=0.8, published_at=None)
        scored = pipeline._apply_freshness_scoring([chunk])
        expected = 0.8 * 0.8 + 0.2 * 0.5
        assert abs(scored[0].freshness_score - expected) < 0.001

    def test_sorted_descending_by_freshness_score(self) -> None:
        """Output is sorted highest freshness_score first."""
        pipeline = RAGPipeline()
        now = datetime.now(tz=timezone.utc)
        chunks = [
            _make_chunk("a", score=0.5, published_at=(now - timedelta(days=10)).isoformat()),
            _make_chunk("b", score=0.9, published_at=(now - timedelta(days=365)).isoformat()),
            _make_chunk("c", score=0.95, published_at=(now - timedelta(days=0)).isoformat()),
        ]
        scored = pipeline._apply_freshness_scoring(chunks)
        for i in range(len(scored) - 1):
            assert scored[i].freshness_score >= scored[i + 1].freshness_score


# ─── RBAC filtering ───────────────────────────────────────────────────────────


class TestRBACFiltering:
    @pytest.mark.asyncio
    async def test_filters_to_allowed_entry_ids(self) -> None:
        """Only chunks whose content_entry_id is in allowed_entry_ids are returned."""
        pipeline = RAGPipeline()

        allowed = ["entry-1", "entry-2"]
        mock_results = [
            {
                "content_entry_id": "entry-1",
                "chunk_index": 0,
                "chunk_text": "allowed",
                "score": 0.9,
                "metadata": {},
            },
            {
                "content_entry_id": "entry-99",  # NOT allowed
                "chunk_index": 0,
                "chunk_text": "blocked",
                "score": 0.95,
                "metadata": {},
            },
        ]

        async def fake_search(**_: object) -> list[dict]:  # type: ignore[type-arg]
            return mock_results

        with (
            patch("cortex_ai_worker.rag.pipeline.get_provider") as mock_provider_fn,
            patch("cortex_ai_worker.rag.pipeline.index_manager") as mock_index,
            patch("cortex_ai_worker.rag.pipeline.get_pool"),
        ):
            mock_provider = AsyncMock()
            mock_provider.embed_one = AsyncMock(return_value=[0.1] * 768)
            mock_provider_fn.return_value = mock_provider
            mock_index.search = AsyncMock(return_value=mock_results)

            # Patch _retrieve_for_type directly to bypass pool setup
            async def fake_retrieve_for_type(
                request: object, content_type: str
            ) -> list:  # type: ignore[type-arg]
                return [
                    RetrievedChunk(
                        content_entry_id=str(r["content_entry_id"]),
                        content_type=content_type,
                        chunk_index=0,
                        chunk_text=str(r["chunk_text"]),
                        score=float(str(r["score"])),
                        freshness_score=float(str(r["score"])),
                        metadata={},
                        published_at=None,
                    )
                    for r in mock_results
                ]

            pipeline._retrieve_for_type = fake_retrieve_for_type  # type: ignore[method-assign]

            request = _make_request(allowed_entry_ids=allowed)
            response = await pipeline.retrieve(request)

        entry_ids = {c.content_entry_id for c in response.chunks}
        assert "entry-99" not in entry_ids
        assert "entry-1" in entry_ids

    @pytest.mark.asyncio
    async def test_empty_allowed_entry_ids_means_no_filter(self) -> None:
        """Empty allowed_entry_ids list = CONTENT_READ_ANY — no ACL restriction."""
        pipeline = RAGPipeline()

        mock_results = [
            {
                "content_entry_id": "entry-1",
                "chunk_index": 0,
                "chunk_text": "text",
                "score": 0.9,
                "metadata": {},
            }
        ]

        async def fake_retrieve_for_type(
            request: object, content_type: str
        ) -> list:  # type: ignore[type-arg]
            return [
                RetrievedChunk(
                    content_entry_id="entry-1",
                    content_type=content_type,
                    chunk_index=0,
                    chunk_text="text",
                    score=0.9,
                    freshness_score=0.9,
                    metadata={},
                    published_at=None,
                )
            ]

        pipeline._retrieve_for_type = fake_retrieve_for_type  # type: ignore[method-assign]

        request = _make_request(allowed_entry_ids=[])
        response = await pipeline.retrieve(request)

        assert len(response.chunks) == 1


# ─── Empty result ─────────────────────────────────────────────────────────────


class TestEmptyResult:
    @pytest.mark.asyncio
    async def test_empty_retrieval_returns_gracefully(self) -> None:
        """Zero embeddings in the table should return an empty response without crashing."""
        pipeline = RAGPipeline()

        async def fake_retrieve_for_type(
            request: object, content_type: str
        ) -> list:  # type: ignore[type-arg]
            return []

        pipeline._retrieve_for_type = fake_retrieve_for_type  # type: ignore[method-assign]
        request = _make_request(content_types=["article"])
        response = await pipeline.retrieve(request)

        assert response.chunks == []
        assert response.total == 0


# ─── Parallel retrieval ───────────────────────────────────────────────────────


class TestParallelRetrieval:
    @pytest.mark.asyncio
    async def test_multi_type_retrieval_is_parallel(self) -> None:
        """asyncio.gather is used so both content types are fetched concurrently."""
        pipeline = RAGPipeline()
        call_log: list[str] = []

        async def fake_retrieve_for_type(
            request: object, content_type: str
        ) -> list:  # type: ignore[type-arg]
            call_log.append(content_type)
            return []

        pipeline._retrieve_for_type = fake_retrieve_for_type  # type: ignore[method-assign]
        request = _make_request(content_types=["article", "product"])
        await pipeline.retrieve(request)

        assert set(call_log) == {"article", "product"}

    @pytest.mark.asyncio
    async def test_one_type_error_does_not_block_others(self) -> None:
        """An exception for one content type is logged but other types still return results."""
        pipeline = RAGPipeline()
        call_count = 0

        async def fake_retrieve_for_type(
            request: object, content_type: str
        ) -> list:  # type: ignore[type-arg]
            nonlocal call_count
            call_count += 1
            if content_type == "broken":
                raise RuntimeError("Table not found")
            return [
                RetrievedChunk(
                    content_entry_id="entry-1",
                    content_type=content_type,
                    chunk_index=0,
                    chunk_text="good result",
                    score=0.8,
                    freshness_score=0.8,
                    metadata={},
                    published_at=None,
                )
            ]

        pipeline._retrieve_for_type = fake_retrieve_for_type  # type: ignore[method-assign]
        request = _make_request(content_types=["article", "broken"])
        response = await pipeline.retrieve(request)

        assert response.total >= 1


# ─── Rerank fallback ──────────────────────────────────────────────────────────


class TestRerankFallback:
    @pytest.mark.asyncio
    async def test_rerank_falls_back_on_error(self) -> None:
        """If Cohere rerank raises, pipeline falls back to freshness-scored order."""
        pipeline = RAGPipeline()

        async def exploding_rerank(_: str, chunks: list) -> list:  # type: ignore[type-arg]
            raise RuntimeError("Cohere API down")

        pipeline._rerank = exploding_rerank  # type: ignore[method-assign]

        async def fake_retrieve_for_type(
            request: object, content_type: str
        ) -> list:  # type: ignore[type-arg]
            return [
                RetrievedChunk(
                    content_entry_id="a",
                    content_type=content_type,
                    chunk_index=0,
                    chunk_text="text",
                    score=0.7,
                    freshness_score=0.7,
                    metadata={},
                    published_at=None,
                ),
                RetrievedChunk(
                    content_entry_id="b",
                    content_type=content_type,
                    chunk_index=1,
                    chunk_text="text b",
                    score=0.9,
                    freshness_score=0.9,
                    metadata={},
                    published_at=None,
                ),
            ]

        pipeline._retrieve_for_type = fake_retrieve_for_type  # type: ignore[method-assign]

        with patch("cortex_ai_worker.config.settings") as mock_settings:
            mock_settings.cohere_api_key = "test-key"
            request = _make_request(rerank=True)
            response = await pipeline.retrieve(request)

        # Should still return chunks even though rerank failed
        assert len(response.chunks) > 0
        assert response.reranked is False
