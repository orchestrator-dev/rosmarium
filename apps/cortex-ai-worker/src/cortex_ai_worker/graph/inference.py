"""Graph inference orchestrator — runs all enabled strategies for a content entry.

Each strategy is independent; failures in one do not block others.
The orchestrator reads content type graph settings directly from the DB.
"""

from __future__ import annotations

from typing import Any

import asyncpg
import structlog

from .ner_inference import infer_from_ner
from .reference_inference import infer_from_references
from .similarity_inference import infer_from_similarity

logger = structlog.get_logger(__name__)


class GraphInferenceEngine:
    """Orchestrates all graph inference strategies for a single content entry."""

    async def run_all(
        self,
        *,
        entry_id: str,
        content_type: str,
        ner_results: dict[str, list[str]] | None,
        text_content: str,
        graph_settings: dict[str, Any],
        conn: asyncpg.Connection,
    ) -> dict[str, int]:
        """Run all enabled inference strategies.

        Args:
            entry_id: The content entry ID being processed.
            content_type: The content type slug.
            ner_results: Structured NER output from the intelligence pipeline.
                         None if NER was not run.
            text_content: Concatenated field text for reference extraction.
            graph_settings: The 'graph' sub-key of the content type settings.
            conn: An active asyncpg connection (already in a pool checkout).

        Returns:
            Dict of strategy name → edges created.
        """
        strategies: list[str] = graph_settings.get(
            "inferenceStrategies", ["ner", "similarity"]
        )
        threshold: float = float(graph_settings.get("similarityThreshold", 0.85))
        max_edges: int = int(graph_settings.get("maxSimilarityEdges", 5))

        totals: dict[str, int] = {}

        # ── NER strategy ───────────────────────────────────────────────────────
        if "ner" in strategies and ner_results:
            try:
                totals["ner"] = await infer_from_ner(
                    entry_id=entry_id,
                    content_type=content_type,
                    ner_results=ner_results,
                    conn=conn,
                )
            except Exception as exc:
                logger.warning(
                    "graph_ner_strategy_failed",
                    entry_id=entry_id,
                    error=str(exc),
                )
                totals["ner"] = 0

        # ── Similarity strategy ────────────────────────────────────────────────
        if "similarity" in strategies:
            try:
                totals["similarity"] = await infer_from_similarity(
                    entry_id=entry_id,
                    content_type=content_type,
                    threshold=threshold,
                    max_edges=max_edges,
                    conn=conn,
                )
            except Exception as exc:
                logger.warning(
                    "graph_similarity_strategy_failed",
                    entry_id=entry_id,
                    error=str(exc),
                )
                totals["similarity"] = 0

        # ── Reference strategy ─────────────────────────────────────────────────
        if "references" in strategies:
            try:
                totals["references"] = await infer_from_references(
                    entry_id=entry_id,
                    content_type=content_type,
                    text_content=text_content,
                    conn=conn,
                )
            except Exception as exc:
                logger.warning(
                    "graph_reference_strategy_failed",
                    entry_id=entry_id,
                    error=str(exc),
                )
                totals["references"] = 0

        total_edges = sum(totals.values())
        logger.info(
            "graph_inference_complete",
            entry_id=entry_id,
            content_type=content_type,
            totals=totals,
            total_edges=total_edges,
        )
        return totals


# ─── Singleton ────────────────────────────────────────────────────────────────

inference_engine = GraphInferenceEngine()
