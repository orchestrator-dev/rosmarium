"""Unit tests for the graph inference orchestrator (mocked strategies)."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cortex_ai_worker.graph.inference import GraphInferenceEngine


@pytest.fixture
def engine() -> GraphInferenceEngine:
    return GraphInferenceEngine()


@pytest.fixture
def mock_conn() -> MagicMock:
    return MagicMock()


@pytest.mark.asyncio
async def test_runs_ner_strategy_when_enabled(
    engine: GraphInferenceEngine, mock_conn: MagicMock
) -> None:
    graph_settings: dict[str, Any] = {
        "enabled": True,
        "inferenceStrategies": ["ner"],
        "similarityThreshold": 0.85,
        "maxSimilarityEdges": 5,
    }
    ner_results = {"PERSON": ["Alice"]}

    with patch(
        "cortex_ai_worker.graph.inference.infer_from_ner", new_callable=AsyncMock
    ) as mock_ner:
        mock_ner.return_value = 2
        totals = await engine.run_all(
            entry_id="entry-1",
            content_type="article",
            ner_results=ner_results,
            text_content="Alice is great.",
            graph_settings=graph_settings,
            conn=mock_conn,
        )

    assert totals["ner"] == 2
    mock_ner.assert_called_once()


@pytest.mark.asyncio
async def test_skips_ner_when_ner_results_none(
    engine: GraphInferenceEngine, mock_conn: MagicMock
) -> None:
    graph_settings: dict[str, Any] = {
        "inferenceStrategies": ["ner"],
        "similarityThreshold": 0.85,
        "maxSimilarityEdges": 5,
    }

    with patch(
        "cortex_ai_worker.graph.inference.infer_from_ner", new_callable=AsyncMock
    ) as mock_ner:
        totals = await engine.run_all(
            entry_id="entry-1",
            content_type="article",
            ner_results=None,
            text_content="",
            graph_settings=graph_settings,
            conn=mock_conn,
        )

    mock_ner.assert_not_called()
    assert "ner" not in totals


@pytest.mark.asyncio
async def test_isolates_strategy_failures(
    engine: GraphInferenceEngine, mock_conn: MagicMock
) -> None:
    """A failure in NER should not block similarity from running."""
    graph_settings: dict[str, Any] = {
        "inferenceStrategies": ["ner", "similarity"],
        "similarityThreshold": 0.85,
        "maxSimilarityEdges": 5,
    }

    with (
        patch(
            "cortex_ai_worker.graph.inference.infer_from_ner",
            new_callable=AsyncMock,
            side_effect=RuntimeError("NER boom"),
        ),
        patch(
            "cortex_ai_worker.graph.inference.infer_from_similarity",
            new_callable=AsyncMock,
            return_value=3,
        ) as mock_sim,
    ):
        totals = await engine.run_all(
            entry_id="entry-1",
            content_type="article",
            ner_results={"ORG": ["ACME"]},
            text_content="ACME is a company.",
            graph_settings=graph_settings,
            conn=mock_conn,
        )

    assert totals["ner"] == 0
    assert totals["similarity"] == 3
    mock_sim.assert_called_once()


@pytest.mark.asyncio
async def test_runs_all_three_strategies(
    engine: GraphInferenceEngine, mock_conn: MagicMock
) -> None:
    graph_settings: dict[str, Any] = {
        "inferenceStrategies": ["ner", "similarity", "references"],
        "similarityThreshold": 0.85,
        "maxSimilarityEdges": 5,
    }

    with (
        patch(
            "cortex_ai_worker.graph.inference.infer_from_ner",
            new_callable=AsyncMock,
            return_value=1,
        ),
        patch(
            "cortex_ai_worker.graph.inference.infer_from_similarity",
            new_callable=AsyncMock,
            return_value=2,
        ),
        patch(
            "cortex_ai_worker.graph.inference.infer_from_references",
            new_callable=AsyncMock,
            return_value=1,
        ),
    ):
        totals = await engine.run_all(
            entry_id="entry-1",
            content_type="article",
            ner_results={"PERSON": ["Bob"]},
            text_content="[[ref-article]]",
            graph_settings=graph_settings,
            conn=mock_conn,
        )

    assert totals == {"ner": 1, "similarity": 2, "references": 1}
