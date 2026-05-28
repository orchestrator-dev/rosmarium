"""Tests for ContextFormatter — LLM context string and JSON output."""

from __future__ import annotations

from rosmarium_ai_worker.rag.formatter import ContextFormatter
from rosmarium_ai_worker.rag.pipeline import RetrievedChunk


def _make_chunk(
    entry_id: str = "entry-1",
    content_type: str = "article",
    chunk_text: str = "Sample chunk content.",
    score: float = 0.9,
    freshness_score: float = 0.85,
) -> RetrievedChunk:
    return RetrievedChunk(
        content_entry_id=entry_id,
        content_type=content_type,
        chunk_index=0,
        chunk_text=chunk_text,
        score=score,
        metadata={"locale": "en"},
        freshness_score=freshness_score,
        published_at=None,
    )


class TestFormatForLlm:
    def test_includes_query_at_top(self) -> None:
        """Formatted output must open with 'RETRIEVED CONTEXT' and include the query."""
        formatter = ContextFormatter()
        chunks = [_make_chunk()]
        result = formatter.format_for_llm(chunks, "What is the policy?")
        assert result.startswith("RETRIEVED CONTEXT")
        assert "What is the policy?" in result

    def test_includes_source_attribution_for_each_chunk(self) -> None:
        """Each chunk appears with Source: content_type/entry_id header."""
        formatter = ContextFormatter()
        chunks = [
            _make_chunk(entry_id="abc", content_type="article"),
            _make_chunk(entry_id="xyz", content_type="product"),
        ]
        result = formatter.format_for_llm(chunks, "query")
        assert "article/abc" in result
        assert "product/xyz" in result

    def test_includes_score_for_each_chunk(self) -> None:
        """Freshness score is displayed for each source block."""
        formatter = ContextFormatter()
        chunks = [_make_chunk(freshness_score=0.7654)]
        result = formatter.format_for_llm(chunks, "query")
        assert "0.7654" in result

    def test_truncates_to_max_tokens(self) -> None:
        """Output should not exceed max_tokens * 4 chars (rough token estimate)."""
        formatter = ContextFormatter()
        long_text = "A" * 2000
        chunks = [_make_chunk(chunk_text=long_text)] * 5
        max_tokens = 200
        result = formatter.format_for_llm(chunks, "query", max_tokens=max_tokens)
        # Allow 10% tolerance for headers/footers
        assert len(result) <= max_tokens * 4 * 1.1 + 500

    def test_includes_closing_instruction(self) -> None:
        """Footer always includes the usage instruction."""
        formatter = ContextFormatter()
        result = formatter.format_for_llm([_make_chunk()], "query")
        assert "Use this context to answer the query" in result

    def test_empty_chunks_returns_header_footer_only(self) -> None:
        """Empty chunk list still returns a valid (header+footer) string."""
        formatter = ContextFormatter()
        result = formatter.format_for_llm([], "query")
        assert "RETRIEVED CONTEXT" in result
        assert "Use this context" in result


class TestFormatAsJson:
    def test_returns_expected_structure(self) -> None:
        """JSON output contains all expected keys for each chunk."""
        formatter = ContextFormatter()
        chunks = [_make_chunk(entry_id="e1", content_type="article")]
        result = formatter.format_as_json(chunks)
        assert isinstance(result, list)
        assert len(result) == 1
        item = result[0]
        assert item["content_entry_id"] == "e1"
        assert item["content_type"] == "article"
        assert "chunk_text" in item
        assert "freshness_score" in item
        assert "score" in item
        assert "metadata" in item

    def test_index_starts_at_one(self) -> None:
        """The 'index' field should be 1-based."""
        formatter = ContextFormatter()
        chunks = [_make_chunk(), _make_chunk(entry_id="e2")]
        result = formatter.format_as_json(chunks)
        assert result[0]["index"] == 1
        assert result[1]["index"] == 2

    def test_source_field_is_formatted(self) -> None:
        """'source' field combines content_type and content_entry_id."""
        formatter = ContextFormatter()
        chunks = [_make_chunk(content_type="blog", entry_id="post-99")]
        result = formatter.format_as_json(chunks)
        assert result[0]["source"] == "blog/post-99"

    def test_estimate_tokens(self) -> None:
        """estimate_tokens returns roughly text_length / 4."""
        formatter = ContextFormatter()
        chunks = [_make_chunk(chunk_text="A" * 400)]
        tokens = formatter.estimate_tokens(chunks)
        assert tokens == 100
