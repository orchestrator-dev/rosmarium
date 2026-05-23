"""Tests for AutoTagger — zero-shot classification with mocked pipeline."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from cortex_ai_worker.intelligence.tagger import AutoTagger


def _make_pipeline_result(labels: list[str], scores: list[float]) -> dict:
    return {"labels": labels, "scores": scores, "sequence": "test text"}


class MockPipeline:
    """Deterministic mock for the HuggingFace zero-shot pipeline."""

    def __init__(self, results: dict) -> None:
        self._results = results

    def __call__(self, text: str, candidate_labels: list[str], **kwargs: object) -> dict:
        # Return scores in the same order as candidate_labels
        labels = candidate_labels
        scores = [self._results.get(lbl, 0.1) for lbl in labels]
        # Sort descending (as real pipeline does)
        paired = sorted(zip(labels, scores, strict=True), key=lambda x: x[1], reverse=True)
        return {
            "labels": [p[0] for p in paired],
            "scores": [p[1] for p in paired],
            "sequence": text,
        }


class TestAutoTagger:
    def _make_tagger(self, label_scores: dict[str, float]) -> AutoTagger:
        tagger = AutoTagger()
        tagger._pipeline = MockPipeline(label_scores)
        return tagger

    def test_returns_sorted_by_score_descending(self) -> None:
        """Results should be sorted highest score first."""
        tagger = self._make_tagger({"technology": 0.9, "business": 0.5, "health": 0.4})
        results = tagger.tag("some text", ["technology", "business", "health"], threshold=0.0)
        assert len(results) == 3
        assert results[0].label == "technology"
        assert results[0].score == pytest.approx(0.9, abs=1e-3)
        for i in range(len(results) - 1):
            assert results[i].score >= results[i + 1].score

    def test_filters_below_threshold(self) -> None:
        """Labels with score below threshold should be excluded."""
        tagger = self._make_tagger({"technology": 0.8, "health": 0.2, "politics": 0.15})
        results = tagger.tag("some text", ["technology", "health", "politics"], threshold=0.3)
        labels = [r.label for r in results]
        assert "technology" in labels
        assert "health" not in labels
        assert "politics" not in labels

    def test_returns_empty_on_empty_text(self) -> None:
        """Empty text should return [] without error."""
        tagger = self._make_tagger({"technology": 0.9})
        assert tagger.tag("", ["technology"]) == []
        assert tagger.tag("   ", ["technology"]) == []

    def test_returns_empty_on_pipeline_exception(self) -> None:
        """Pipeline raising should return [] gracefully."""
        tagger = AutoTagger()
        bad_pipeline = MagicMock(side_effect=RuntimeError("model error"))
        tagger._pipeline = bad_pipeline
        result = tagger.tag("some content", ["technology"])
        assert result == []

    def test_truncates_long_text(self) -> None:
        """Text longer than 512 tokens (~2048 chars) should be truncated."""
        tagger = AutoTagger()
        call_args: list[str] = []

        def capture_pipeline(text: str, **kwargs: object) -> dict:
            call_args.append(text)
            return {"labels": ["technology"], "scores": [0.9], "sequence": text}

        tagger._pipeline = capture_pipeline
        long_text = "word " * 700  # ~3500 chars
        tagger.tag(long_text, ["technology"])
        assert len(call_args) == 1
        assert len(call_args[0]) <= 512 * 4 + 10  # some tolerance for word boundaries

    def test_multi_label_allows_multiple_above_threshold(self) -> None:
        """With multi_label=True, multiple labels can be above threshold."""
        tagger = self._make_tagger({"technology": 0.85, "business": 0.75, "science": 0.65})
        results = tagger.tag(
            "some text", ["technology", "business", "science"], threshold=0.5, multi_label=True
        )
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_tag_async_returns_same_as_sync(self) -> None:
        """tag_async() should return identical results to tag()."""
        tagger = self._make_tagger({"technology": 0.8, "health": 0.2})
        sync_result = tagger.tag("some text", ["technology", "health"], threshold=0.3)
        async_result = await tagger.tag_async("some text", ["technology", "health"], threshold=0.3)
        assert [r.label for r in sync_result] == [r.label for r in async_result]
