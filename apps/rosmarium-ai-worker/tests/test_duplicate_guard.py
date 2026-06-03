"""Tests for DuplicateGuard — uses async mocks to simulate DB connection."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from rosmarium_ai_worker.ingestor.duplicate_guard import DuplicateGuard


def make_conn(url_match_row: dict | None = None, embedding_rows: list | None = None) -> AsyncMock:
    """Create a mock asyncpg connection."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=url_match_row)
    conn.fetch = AsyncMock(return_value=embedding_rows or [])
    return conn


@pytest.mark.asyncio
async def test_url_match_returns_duplicate() -> None:
    """DuplicateGuard should return True when sourceUrl already exists."""
    guard = DuplicateGuard(similarity_threshold=0.92)
    conn = make_conn(url_match_row={"id": "existing-entry-id"})

    is_dup, entry_id, score = await guard.check(
        source_url="https://example.com/page",
        title="My Page",
        markdown="Content",
        content_type_name="article",
        conn=conn,
    )

    assert is_dup is True
    assert entry_id == "existing-entry-id"
    assert score == 1.0


@pytest.mark.asyncio
async def test_new_url_not_duplicate() -> None:
    """DuplicateGuard should return False for a URL not in the database."""
    guard = DuplicateGuard(similarity_threshold=0.92)
    conn = make_conn(url_match_row=None, embedding_rows=[])

    with patch(
        "rosmarium_ai_worker.ingestor.duplicate_guard.get_provider"
    ) as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.embed_one = AsyncMock(return_value=[0.1, 0.2, 0.3])
        mock_get_provider.return_value = mock_provider

        is_dup, entry_id, score = await guard.check(
            source_url="https://example.com/new-page",
            title="New Page",
            markdown="Totally new content",
            content_type_name="article",
            conn=conn,
        )

    assert is_dup is False
    assert entry_id is None


@pytest.mark.asyncio
async def test_embedding_similarity_above_threshold_is_duplicate() -> None:
    """DuplicateGuard should detect duplicates via embedding similarity."""
    guard = DuplicateGuard(similarity_threshold=0.92)
    conn = make_conn(
        url_match_row=None,
        embedding_rows=[
            {"content_entry_id": "similar-entry", "similarity": 0.97}
        ],
    )

    with patch(
        "rosmarium_ai_worker.ingestor.duplicate_guard.get_provider"
    ) as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.embed_one = AsyncMock(return_value=[0.5, 0.5])
        mock_get_provider.return_value = mock_provider

        is_dup, entry_id, score = await guard.check(
            source_url="https://example.com/slightly-different-url",
            title="Very Similar Article",
            markdown="Almost identical content",
            content_type_name="article",
            conn=conn,
        )

    assert is_dup is True
    assert entry_id == "similar-entry"
    assert score is not None and score > 0.9


@pytest.mark.asyncio
async def test_embedding_similarity_below_threshold_not_duplicate() -> None:
    """DuplicateGuard should return False when similarity is below threshold."""
    guard = DuplicateGuard(similarity_threshold=0.92)
    conn = make_conn(
        url_match_row=None,
        embedding_rows=[
            {"content_entry_id": "different-entry", "similarity": 0.75}
        ],
    )

    with patch(
        "rosmarium_ai_worker.ingestor.duplicate_guard.get_provider"
    ) as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.embed_one = AsyncMock(return_value=[0.1, 0.9])
        mock_get_provider.return_value = mock_provider

        is_dup, entry_id, score = await guard.check(
            source_url="https://example.com/different-page",
            title="Different Topic",
            markdown="Completely different content about another topic",
            content_type_name="article",
            conn=conn,
        )

    assert is_dup is False
