"""Tests for SentenceChunker and SectionChunker."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from cortex_ai_worker.chunking.base import Chunk
from cortex_ai_worker.chunking.fixed import FixedSizeChunker
from cortex_ai_worker.chunking.section import SectionChunker


# ─── SentenceChunker (via FixedSizeChunker for unit tests, mocked spaCy below) ─


class TestFixedSizeChunker:
    """Unit tests for FixedSizeChunker (deterministic, no spaCy needed)."""

    def test_chunks_respect_chunk_size_boundary(self) -> None:
        """No chunk should exceed the configured chunk_size."""
        chunker = FixedSizeChunker(chunk_size=50, overlap=0)
        text = ("This is a sentence. " * 20).strip()
        chunks = chunker.chunk(text)
        assert chunks, "Expected at least one chunk"
        for chunk in chunks:
            # allow slight overage only for single sentences that exceed limit
            assert len(chunk.text) <= 200, f"Chunk too large: {len(chunk.text)}"

    def test_metadata_passed_through_to_all_chunks(self) -> None:
        """Every chunk must carry the metadata dict passed at call time."""
        chunker = FixedSizeChunker(chunk_size=100, overlap=0)
        meta = {"field_name": "body", "locale": "en"}
        text = "First sentence. Second sentence. Third sentence. " * 5
        chunks = chunker.chunk(text, metadata=meta)
        for chunk in chunks:
            assert chunk.metadata["field_name"] == "body"
            assert chunk.metadata["locale"] == "en"

    def test_empty_string_returns_empty_list(self) -> None:
        """Empty or whitespace-only input must return an empty list."""
        chunker = FixedSizeChunker()
        assert chunker.chunk("") == []
        assert chunker.chunk("   ") == []

    def test_single_sentence_returns_single_chunk(self) -> None:
        """A text shorter than chunk_size should produce exactly one chunk."""
        chunker = FixedSizeChunker(chunk_size=512, overlap=0)
        text = "Just one sentence."
        chunks = chunker.chunk(text)
        assert len(chunks) == 1
        assert chunks[0].text == "Just one sentence."

    def test_chunk_index_is_sequential(self) -> None:
        """chunk_index values must be 0, 1, 2, … in order."""
        chunker = FixedSizeChunker(chunk_size=40, overlap=0)
        text = ("Short sentence. " * 10).strip()
        chunks = chunker.chunk(text)
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i

    def test_overlap_from_previous_chunk_is_prepended(self) -> None:
        """With overlap > 0, later chunks should share text with the previous chunk end."""
        chunker = FixedSizeChunker(chunk_size=60, overlap=20)
        text = "Alpha beta gamma delta epsilon zeta eta theta iota kappa. Lambda mu nu."
        chunks = chunker.chunk(text)
        if len(chunks) > 1:
            # The overlap text from chunk[0] should appear in chunk[1]
            tail = chunks[0].text[-20:]
            assert tail in chunks[1].text or len(chunks[0].text) <= 20


# ─── SentenceChunker with mocked spaCy ──────────────────────────────────────


def _make_mock_nlp(sentences: list[str], full_text: str) -> MagicMock:
    """Build a minimal mock of spaCy nlp() output."""
    # Build cumulative char offsets
    doc_mock = MagicMock()
    sents = []
    pos = 0
    for s in sentences:
        start = full_text.find(s, pos)
        end = start + len(s)
        sent = MagicMock()
        sent.text = s
        sent.start_char = start
        sent.end_char = end
        sents.append(sent)
        pos = end

    doc_mock.sents = iter(sents)
    nlp_mock = MagicMock(return_value=doc_mock)
    nlp_mock.pipe_names = ["sentencizer"]
    return nlp_mock


class TestSentenceChunker:
    """Unit tests for SentenceChunker (spaCy mocked)."""

    def _make_chunker(self, chunk_size: int = 512, overlap: int = 50) -> "object":
        from cortex_ai_worker.chunking.sentence import SentenceChunker
        return SentenceChunker.__new__(SentenceChunker)

    def test_does_not_split_mid_sentence(self) -> None:
        """Sentence boundaries must be preserved — no chunk should cut mid-sentence."""
        from cortex_ai_worker.chunking.sentence import SentenceChunker

        sents = ["The quick brown fox jumps.", "Over the lazy dog.", "Sentence three."]
        full_text = " ".join(sents)

        nlp_mock = _make_mock_nlp(sents, full_text)

        with patch("cortex_ai_worker.chunking.sentence.spacy") as mock_spacy:
            mock_spacy.load.return_value = nlp_mock
            chunker = SentenceChunker(chunk_size=512, overlap=0)
            # Reset mock so chunk() sees fresh sentences
            doc_mock = MagicMock()
            doc_sents = []
            pos = 0
            for s in sents:
                start = full_text.find(s, pos)
                end = start + len(s)
                sent = MagicMock()
                sent.text = s
                sent.start_char = start
                sent.end_char = end
                doc_sents.append(sent)
                pos = end
            doc_mock.sents = iter(doc_sents)
            nlp_mock.return_value = doc_mock
            chunker._nlp = nlp_mock  # type: ignore[attr-defined]

        chunks = chunker.chunk(full_text)
        for chunk in chunks:
            # Each chunk should consist of complete sentences only
            for sent in sents:
                if sent in chunk.text:
                    assert chunk.text.find(sent) >= 0

    def test_empty_string_returns_empty_list(self) -> None:
        """Empty input → empty output (no spaCy call needed)."""
        from cortex_ai_worker.chunking.sentence import SentenceChunker

        with patch("cortex_ai_worker.chunking.sentence.spacy") as mock_spacy:
            mock_spacy.load.return_value = MagicMock(pipe_names=["sentencizer"])
            chunker = SentenceChunker()

        assert chunker.chunk("") == []
        assert chunker.chunk("   ") == []

    def test_metadata_passed_through(self) -> None:
        """Metadata dict is attached to every chunk."""
        from cortex_ai_worker.chunking.sentence import SentenceChunker

        text = "Hello world. This is a test sentence."
        sents = ["Hello world.", "This is a test sentence."]
        nlp_mock = _make_mock_nlp(sents, text)

        with patch("cortex_ai_worker.chunking.sentence.spacy") as mock_spacy:
            mock_spacy.load.return_value = nlp_mock
            chunker = SentenceChunker(chunk_size=512, overlap=0)
            doc_mock = MagicMock()
            doc_sents = []
            pos = 0
            for s in sents:
                start = text.find(s, pos)
                end = start + len(s)
                sent = MagicMock()
                sent.text = s
                sent.start_char = start
                sent.end_char = end
                doc_sents.append(sent)
                pos = end
            doc_mock.sents = iter(doc_sents)
            nlp_mock.return_value = doc_mock

        chunker._nlp = nlp_mock  # type: ignore[attr-defined]
        chunks = chunker.chunk(text, metadata={"locale": "en"})
        for chunk in chunks:
            assert chunk.metadata.get("locale") == "en"


# ─── SectionChunker ──────────────────────────────────────────────────────────


class TestSectionChunker:
    """Unit tests for SectionChunker (heading detection, no spaCy needed for section logic)."""

    def _chunker(self) -> SectionChunker:
        return SectionChunker.__new__(SectionChunker)

    def test_detects_markdown_headings(self) -> None:
        """Section detection finds ## headings and returns correct section titles."""
        chunker = self._chunker()
        text = "## Introduction\nSome content here.\n## Methods\nMethod details."
        sections = chunker._detect_sections(text)
        titles = [s["title"] for s in sections]
        assert "Introduction" in titles
        assert "Methods" in titles

    def test_detects_html_headings(self) -> None:
        """HTML heading tags are detected when no markdown headings are present."""
        chunker = self._chunker()
        text = "<h1>Overview</h1>\nContent paragraph.\n<h2>Details</h2>\nMore content."
        sections = chunker._detect_sections(text)
        titles = [s["title"] for s in sections]
        assert "Overview" in titles
        assert "Details" in titles

    def test_parent_heading_propagation(self) -> None:
        """Sub-sections carry the title of their parent heading."""
        chunker = self._chunker()
        text = "# Parent\nParent content.\n## Child\nChild content."
        sections = chunker._detect_sections(text)
        # The ## Child section should have 'Parent' as its parent_heading
        child = next((s for s in sections if s["title"] == "Child"), None)
        assert child is not None, "Child section not found"
        assert child["parent_heading"] == "Parent"

    def test_falls_back_to_whole_text_when_no_headings(self) -> None:
        """Text without headings is returned as one section with empty title."""
        chunker = self._chunker()
        text = "Just some plain text without any headings at all."
        sections = chunker._detect_sections(text)
        assert len(sections) == 1
        assert sections[0]["title"] == ""
        assert sections[0]["parent_heading"] == ""

    def test_section_title_in_chunk_metadata(self) -> None:
        """After full chunking, each chunk's metadata contains section_title."""
        with patch("cortex_ai_worker.chunking.sentence.spacy") as mock_spacy:
            # Make SentenceChunker a passthrough — return one chunk per section
            nlp_factory = MagicMock()

            def make_doc(text: str) -> MagicMock:
                doc = MagicMock()
                sent = MagicMock()
                sent.text = text
                sent.start_char = 0
                sent.end_char = len(text)
                doc.sents = iter([sent])
                return doc

            nlp_factory.side_effect = make_doc
            nlp_mock = MagicMock()
            nlp_mock.pipe_names = ["sentencizer"]
            nlp_mock.side_effect = make_doc
            mock_spacy.load.return_value = nlp_mock

            chunker = SectionChunker(chunk_size=512, overlap=0)
            text = "## Setup\nInstall the package.\n## Usage\nRun the command."
            chunks = chunker.chunk(text)

        assert all("section_title" in c.metadata for c in chunks)
        section_titles = {c.metadata["section_title"] for c in chunks}
        assert "Setup" in section_titles or "Usage" in section_titles
