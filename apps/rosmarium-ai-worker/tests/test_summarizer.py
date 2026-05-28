"""Tests for ContentSummarizer — Ollama calls mocked via httpx."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from rosmarium_ai_worker.intelligence.summarizer import ContentSummarizer, _count_words


class TestContentSummarizer:
    @pytest.fixture
    def summarizer(self) -> ContentSummarizer:
        return ContentSummarizer()

    def _long_text(self, words: int = 200) -> str:
        return " ".join([f"word{i}" for i in range(words)])

    @pytest.mark.asyncio
    async def test_calls_ollama_with_brief_prompt(self, summarizer: ContentSummarizer) -> None:
        """Ollama is called with a 'Summarize in N words' prompt for brief style."""
        text = self._long_text(100)
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={"response": "A brief summary."})

        with patch("rosmarium_ai_worker.intelligence.summarizer.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
            mock_client.return_value.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value.post = AsyncMock(return_value=mock_response)

            result = await summarizer.summarize(text, max_words=50, style="brief")

        call_args = mock_client.return_value.post.call_args
        body = call_args[1]["json"] if call_args[1] else call_args[0][1]
        assert "Summarize in 50 words" in body["prompt"]
        assert result.summary == "A brief summary."
        assert result.model != "extractive-fallback"

    @pytest.mark.asyncio
    async def test_calls_ollama_with_bullet_prompt(self, summarizer: ContentSummarizer) -> None:
        """Bullet style uses 'List the 5 key points' prompt."""
        text = self._long_text(100)
        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={"response": "• Point one\n• Point two"})

        with patch("rosmarium_ai_worker.intelligence.summarizer.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
            mock_client.return_value.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value.post = AsyncMock(return_value=mock_response)

            result = await summarizer.summarize(text, style="bullet")

        call_args = mock_client.return_value.post.call_args
        body = call_args[1]["json"] if call_args[1] else call_args[0][1]
        assert "key points" in body["prompt"].lower()

    @pytest.mark.asyncio
    async def test_returns_extractive_fallback_when_ollama_unreachable(
        self, summarizer: ContentSummarizer
    ) -> None:
        """Should fall back to extractive summary when Ollama is down."""
        text = self._long_text(100)
        with patch("rosmarium_ai_worker.intelligence.summarizer.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
            mock_client.return_value.__aexit__ = AsyncMock(return_value=None)
            mock_client.return_value.post = AsyncMock(
                side_effect=httpx.ConnectError("connection refused")
            )

            result = await summarizer.summarize(text)

        assert result.model == "extractive-fallback"
        assert result.summary != ""

    @pytest.mark.asyncio
    async def test_skips_text_under_50_words(self, summarizer: ContentSummarizer) -> None:
        """Text under 50 words should be returned as-is (passthrough)."""
        short_text = "This is a short piece of text with fewer than fifty words."
        result = await summarizer.summarize(short_text)
        assert result.model == "passthrough"
        assert result.summary == short_text.strip()

    @pytest.mark.asyncio
    async def test_truncates_input_over_3000_words(self, summarizer: ContentSummarizer) -> None:
        """Input over 3000 words should be truncated before sending to Ollama."""
        long_text = self._long_text(4000)
        captured_prompts: list[str] = []

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()
        mock_response.json = MagicMock(return_value={"response": "Summary."})

        with patch("rosmarium_ai_worker.intelligence.summarizer.httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__ = AsyncMock(return_value=mock_client.return_value)
            mock_client.return_value.__aexit__ = AsyncMock(return_value=None)

            async def capture_post(url: str, **kwargs: object) -> MagicMock:
                captured_prompts.append(kwargs.get("json", {}).get("prompt", ""))  # type: ignore[arg-type]
                return mock_response

            mock_client.return_value.post = capture_post

            await summarizer.summarize(long_text)

        assert len(captured_prompts) == 1
        # The prompt should contain truncated text, not all 4000 words
        prompt_word_count = _count_words(captured_prompts[0])
        assert prompt_word_count < 3500  # 3000 words + prompt overhead

    def test_extractive_fallback_respects_max_words(self, summarizer: ContentSummarizer) -> None:
        """Extractive fallback should stay under max_words."""
        text = "\n\n".join([f"This is paragraph {i} with some content." for i in range(10)])
        result = summarizer._extractive_fallback(text, max_words=20)
        assert _count_words(result) <= 25  # some tolerance
