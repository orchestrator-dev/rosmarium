"""Content summarization — Ollama LLM with extractive fallback.

Calls Ollama /api/generate for abstractive summarization.
Falls back gracefully to extractive summary (first sentence per paragraph)
when Ollama is unavailable or returns an error.
"""

from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Literal

import httpx
import structlog
from pydantic import BaseModel

from ..config import settings

logger = structlog.get_logger(__name__)

_OLLAMA_TIMEOUT_S = 30.0
_MIN_WORDS_TO_SUMMARIZE = 50
_MAX_INPUT_WORDS = 3000


class SummaryResult(BaseModel):
    """Result of a summarization request."""

    summary: str
    word_count: int
    original_word_count: int
    compression_ratio: float  # word_count / original_word_count
    model: str
    generated_at: str  # ISO 8601 datetime


def _count_words(text: str) -> int:
    return len(text.split())


def _truncate_to_words(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words])


class ContentSummarizer:
    """LLM-based content summarizer with extractive fallback."""

    async def summarize(
        self,
        text: str,
        max_words: int = 100,
        style: Literal["brief", "detailed", "bullet"] = "brief",
    ) -> SummaryResult:
        """Summarize content using Ollama or extractive fallback.

        Args:
            text: Content to summarize.
            max_words: Target summary length in words.
            style: 'brief' | 'detailed' | 'bullet'

        Returns:
            SummaryResult with summary text and metadata.
        """
        original_word_count = _count_words(text)

        # Skip if too short to be worth summarizing
        if original_word_count < _MIN_WORDS_TO_SUMMARIZE:
            return SummaryResult(
                summary=text.strip(),
                word_count=original_word_count,
                original_word_count=original_word_count,
                compression_ratio=1.0,
                model="passthrough",
                generated_at=datetime.now(tz=UTC).isoformat(),
            )

        # Truncate very long inputs
        truncated = _truncate_to_words(text, _MAX_INPUT_WORDS)

        # Build prompt based on style
        prompts: dict[str, str] = {
            "brief": f"Summarize in {max_words} words or fewer:\n\n{truncated}",
            "detailed": f"Write a detailed summary covering key points:\n\n{truncated}",
            "bullet": f"List the 5 key points as bullet points:\n\n{truncated}",
        }
        prompt = prompts[style]
        model = settings.summarization_model

        start = time.monotonic()
        summary_text: str | None = None
        used_model = model

        try:
            async with httpx.AsyncClient(timeout=_OLLAMA_TIMEOUT_S) as client:
                resp = await client.post(
                    f"{settings.ollama_base_url}/api/generate",
                    json={"model": model, "prompt": prompt, "stream": False},
                )
                resp.raise_for_status()
                data = resp.json()
                summary_text = (data.get("response") or "").strip()

        except Exception as e:
            logger.warning(
                "summarizer_ollama_unavailable",
                error=str(e),
                model=model,
                falling_back="extractive",
            )

        latency_ms = int((time.monotonic() - start) * 1000)

        if not summary_text:
            summary_text = self._extractive_fallback(text, max_words)
            used_model = "extractive-fallback"

        word_count = _count_words(summary_text)
        compression = round(word_count / max(original_word_count, 1), 3)

        logger.info(
            "summarization_complete",
            model=used_model,
            input_words=original_word_count,
            output_words=word_count,
            latency_ms=latency_ms,
            style=style,
        )

        return SummaryResult(
            summary=summary_text,
            word_count=word_count,
            original_word_count=original_word_count,
            compression_ratio=compression,
            model=used_model,
            generated_at=datetime.now(tz=UTC).isoformat(),
        )

    def _extractive_fallback(self, text: str, max_words: int) -> str:
        """Extractive fallback: first sentence of each paragraph up to max_words."""
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        sentences: list[str] = []

        for para in paragraphs:
            # Split on period/exclamation/question followed by space or end
            import re

            parts = re.split(r"(?<=[.!?])\s+", para, maxsplit=1)
            if parts:
                sentences.append(parts[0].strip())

        result_words: list[str] = []
        for sentence in sentences:
            words = sentence.split()
            if len(result_words) + len(words) > max_words:
                remaining = max_words - len(result_words)
                if remaining > 5:
                    result_words.extend(words[:remaining])
                break
            result_words.extend(words)

        return " ".join(result_words) if result_words else text[:max_words * 5]


# Singleton
content_summarizer = ContentSummarizer()
