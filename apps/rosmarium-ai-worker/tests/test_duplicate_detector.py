"""Tests for DuplicateDetector — uses database via environment variable.

If DATABASE_URL is set (CI or local), uses a real postgres+pgvector database.
Otherwise skips tests that require a database connection.
"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock

import pytest

from rosmarium_ai_worker.intelligence.duplicate_detector import (
    DuplicateCandidate,
    DuplicateDetector,
)

_DB_AVAILABLE = bool(os.environ.get("DATABASE_URL"))

pytestmark = pytest.mark.asyncio


def _make_detector(threshold: float = 0.92) -> DuplicateDetector:
    detector = DuplicateDetector()
    detector._threshold = threshold
    return detector


def _make_mock_conn(rows: list[dict]) -> MagicMock:
    """Create a mock asyncpg connection that returns the given rows."""
    conn = MagicMock()

    async def mock_fetch(*args: object, **kwargs: object) -> list[dict]:
        return rows  # type: ignore[return-value]

    conn.fetch = mock_fetch
    return conn


class TestDuplicateDetector:
    async def test_returns_candidates_above_threshold(self) -> None:
        """Candidates with score >= threshold - 0.05 should be returned."""
        conn = _make_mock_conn(
            [
                {"content_entry_id": "entry-b", "score": 0.95},
                {"content_entry_id": "entry-c", "score": 0.80},
            ]
        )
        detector = _make_detector(threshold=0.92)
        candidates = await detector.find_duplicates(
            "entry-a", "article", [0.1] * 768, conn
        )
        # entry-b (0.95) is above threshold-0.05=0.87 → included
        # entry-c (0.80) is below 0.87 → excluded
        ids = [c.entry_id for c in candidates]
        assert "entry-b" in ids
        assert "entry-c" not in ids

    async def test_excludes_self(self) -> None:
        """The query should exclude the entry itself via WHERE content_entry_id != $2."""
        fetch_calls: list[tuple] = []

        async def mock_fetch(query: str, *args: object) -> list:
            fetch_calls.append(args)
            return []

        conn = MagicMock()
        conn.fetch = mock_fetch

        detector = _make_detector()
        await detector.find_duplicates("entry-self", "article", [0.1] * 768, conn)

        assert len(fetch_calls) == 1
        assert "entry-self" in fetch_calls[0]

    async def test_marks_is_duplicate_at_threshold(self) -> None:
        """Entries at or above threshold should have is_duplicate=True."""
        conn = _make_mock_conn(
            [{"content_entry_id": "entry-b", "score": 0.92}]
        )
        detector = _make_detector(threshold=0.92)
        candidates = await detector.find_duplicates(
            "entry-a", "article", [0.1] * 768, conn
        )
        assert len(candidates) == 1
        assert candidates[0].is_duplicate is True

    async def test_returns_empty_when_table_missing(self) -> None:
        """Missing embedding table should return [] gracefully."""
        import asyncpg

        conn = MagicMock()
        conn.fetch = AsyncMock(
            side_effect=asyncpg.exceptions.UndefinedTableError("no such table")
        )
        detector = _make_detector()
        result = await detector.find_duplicates(
            "entry-a", "nonexistent", [0.1] * 768, conn
        )
        assert result == []

    async def test_scan_collection_returns_pairs(self) -> None:
        """scan_collection should return pairs of duplicate entry IDs."""
        # Mock: 3 entries, A is very similar to B
        call_count = 0

        async def mock_fetch(query: str, *args: object) -> list:
            nonlocal call_count
            call_count += 1
            if "DISTINCT content_entry_id" in query:
                return [{"content_entry_id": "A"}, {"content_entry_id": "B"}]
            return []

        async def mock_fetchrow(query: str, *args: object) -> dict | None:
            if args and args[0] == "A":
                return {"embedding": [0.1] * 4}
            if args and args[0] == "B":
                return {"embedding": [0.11] * 4}
            return None

        conn = MagicMock()
        conn.fetch = mock_fetch
        conn.fetchrow = mock_fetchrow

        detector = _make_detector(threshold=0.5)

        # Patch find_duplicates to return a known result for A→B
        async def mock_find(entry_id: str, *args: object, **kwargs: object) -> list:
            if entry_id == "A":
                return [
                    DuplicateCandidate(
                        entry_id="B",
                        content_type="article",
                        similarity_score=0.95,
                        is_duplicate=True,
                    )
                ]
            return []

        detector.find_duplicates = mock_find  # type: ignore[method-assign]

        pairs = await detector.scan_collection("article", conn)
        assert len(pairs) >= 1
        assert ("A", "B") == tuple(sorted(pairs[0][:2]))
