"""Auto-tagger — zero-shot text classification via HuggingFace transformers.

Uses a cross-encoder NLI model for zero-shot classification.
No training required — works against any label taxonomy.
Model is loaded lazily (only on first call) to avoid import-time cost.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable

import structlog
from pydantic import BaseModel

from ..config import settings

logger = structlog.get_logger(__name__)
_stdlib_logger = logging.getLogger("transformers")
_stdlib_logger.setLevel(logging.ERROR)  # silence HF verbosity

# Type alias for the HuggingFace pipeline callable
_PipelineFn = Callable[..., dict[str, Any]]


class TagResult(BaseModel):
    """A single auto-tagging result."""

    label: str
    score: float


class AutoTagger:
    """Zero-shot auto-tagger using HuggingFace transformers pipeline.

    Loaded lazily — no model download at import time.
    All inference is CPU-bound; use tag_async() to avoid blocking the event loop.
    """

    def __init__(self) -> None:
        self._pipeline: _PipelineFn | None = None
        self._model: str = settings.tagging_model

    def _ensure_loaded(self) -> None:
        """Load the pipeline on first use."""
        if self._pipeline is None:
            try:
                from transformers import pipeline

                self._pipeline = pipeline(
                    "zero-shot-classification",
                    model=self._model,
                    device=-1,  # CPU only
                )
                logger.info("tagger_model_loaded", model=self._model)
            except Exception as e:
                logger.error("tagger_model_load_failed", model=self._model, error=str(e))
                raise

    def tag(
        self,
        text: str,
        candidate_labels: list[str],
        threshold: float = 0.3,
        multi_label: bool = True,
    ) -> list[TagResult]:
        """Run zero-shot classification and return labels above threshold.

        Args:
            text: Content to classify (will be truncated to 512 tokens).
            candidate_labels: Labels to classify against.
            threshold: Minimum confidence score (default 0.3).
            multi_label: Allow multiple labels above threshold (default True).

        Returns:
            List of TagResult sorted by score descending. Empty list on error.
        """
        if not text or not text.strip():
            return []
        if not candidate_labels:
            return []

        try:
            self._ensure_loaded()
            assert self._pipeline is not None, "Pipeline failed to load"

            # Truncate to ~512 tokens (approx 4 chars/token)
            max_chars = 512 * 4
            truncated = text[:max_chars] if len(text) > max_chars else text

            result: dict[str, Any] = self._pipeline(
                truncated,
                candidate_labels=candidate_labels,
                multi_label=multi_label,
            )

            # result is dict: {labels: [...], scores: [...], sequence: ...}
            labels: list[str] = result["labels"]
            scores: list[float] = result["scores"]

            tagged = [
                TagResult(label=lbl, score=round(sc, 4))
                for lbl, sc in zip(labels, scores, strict=True)
                if sc >= threshold
            ]
            return sorted(tagged, key=lambda t: t.score, reverse=True)

        except Exception as e:
            logger.warning("tagging_failed", model=self._model, error=str(e))
            return []

    async def tag_async(
        self,
        text: str,
        candidate_labels: list[str],
        threshold: float = 0.3,
    ) -> list[TagResult]:
        """Async wrapper — runs tag() in a thread pool executor."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self.tag, text, candidate_labels, threshold
        )


# Singleton — one instance per worker process
auto_tagger = AutoTagger()
