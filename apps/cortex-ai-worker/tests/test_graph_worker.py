"""Tests for the graph analytics job worker."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from rosmarium_ai_worker.graph.analytics import NodeAnalytics
from rosmarium_ai_worker.workers.graph_worker import AnalyticsJobPayload, process_analytics_job


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _node(entry_id: str) -> NodeAnalytics:
    return NodeAnalytics(
        entry_id=entry_id,
        pagerank_score=0.5,
        betweenness_score=0.1,
        community_id=0,
        hub_score=0.3,
        authority_score=0.2,
        degree_in=1,
        degree_out=1,
        degree_total=2,
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_process_analytics_job_happy_path(mock_pool: AsyncMock) -> None:
    """Analytics computed and written for a given content type."""
    mock_engine = AsyncMock()
    mock_engine.compute_analytics.return_value = [_node("A"), _node("B")]

    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value

    with patch("rosmarium_ai_worker.workers.graph_worker.get_pool", return_value=mock_pool), \
         patch("rosmarium_ai_worker.workers.graph_worker.analytics_engine", mock_engine):

        await process_analytics_job({"contentType": "article", "requestedBy": "api"})

    mock_engine.compute_analytics.assert_called_once_with("article", mock_conn)
    mock_engine.write_analytics_results.assert_called_once()
    written = mock_engine.write_analytics_results.call_args[0][0]
    assert len(written) == 2
    assert written[0].entry_id == "A"


@pytest.mark.asyncio
async def test_process_analytics_job_none_content_type(mock_pool: AsyncMock) -> None:
    """None contentType is forwarded to compute_analytics (all types)."""
    mock_engine = AsyncMock()
    mock_engine.compute_analytics.return_value = []
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value

    with patch("rosmarium_ai_worker.workers.graph_worker.get_pool", return_value=mock_pool), \
         patch("rosmarium_ai_worker.workers.graph_worker.analytics_engine", mock_engine):

        await process_analytics_job({"contentType": None, "requestedBy": "scheduler"})

    mock_engine.compute_analytics.assert_called_once_with(None, mock_conn)


@pytest.mark.asyncio
async def test_process_analytics_job_empty_results(mock_pool: AsyncMock) -> None:
    """Empty results still calls write_analytics_results (idempotent)."""
    mock_engine = AsyncMock()
    mock_engine.compute_analytics.return_value = []
    mock_conn = mock_pool.acquire.return_value.__aenter__.return_value

    with patch("rosmarium_ai_worker.workers.graph_worker.get_pool", return_value=mock_pool), \
         patch("rosmarium_ai_worker.workers.graph_worker.analytics_engine", mock_engine):

        await process_analytics_job({"contentType": "article", "requestedBy": "api"})

    mock_engine.write_analytics_results.assert_called_once_with([], mock_conn)


def test_analytics_job_payload_validates() -> None:
    """Pydantic model validates required fields."""
    p = AnalyticsJobPayload.model_validate({"contentType": "article", "requestedBy": "api"})
    assert p.contentType == "article"
    assert p.requestedBy == "api"


def test_analytics_job_payload_requires_requested_by() -> None:
    """requestedBy is required — missing raises ValidationError."""
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        AnalyticsJobPayload.model_validate({"contentType": "article"})
