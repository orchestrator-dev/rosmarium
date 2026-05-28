"""SpaCy sentence-boundary chunker.

Uses the spaCy `sentencizer` (fast — no parser/ner/tagger needed) to detect
sentence boundaries, then groups sentences into chunks that respect *chunk_size*
characters.  The last *overlap* characters of the previous chunk are prepended to
each new chunk so that context is not lost at boundaries.
"""

from __future__ import annotations

from typing import Any

import spacy
from spacy.language import Language

from .base import Chunk, ChunkingStrategy


class SentenceChunker(ChunkingStrategy):
    """Chunks text by grouping spaCy-detected sentences up to *chunk_size* chars.

    Args:
        chunk_size: Maximum character length per chunk (default 512).
        overlap:    Characters from the end of the previous chunk to prepend to
                    the next one (default 50).
    """

    def __init__(self, chunk_size: int = 512, overlap: int = 50) -> None:
        self._chunk_size = chunk_size
        self._overlap = overlap
        self._nlp: Language = self._load_nlp()

    # ------------------------------------------------------------------ #
    # Private helpers                                                       #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _load_nlp() -> Language:
        """Load spaCy model with only the sentencizer enabled (fast path)."""
        nlp = spacy.load(
            "en_core_web_sm",
            disable=["parser", "ner", "tagger", "lemmatizer"],
        )
        # sentencizer is faster than the dependency parser for sentence splitting
        if "sentencizer" not in nlp.pipe_names:
            nlp.add_pipe("sentencizer")
        return nlp

    # ------------------------------------------------------------------ #
    # Public API                                                            #
    # ------------------------------------------------------------------ #

    def chunk(self, text: str, metadata: dict[str, Any] | None = None) -> list[Chunk]:
        """Split *text* into sentence-aware chunks.

        Sentence boundaries are never split; if a single sentence exceeds
        *chunk_size* it is emitted as its own chunk.
        """
        if not text or not text.strip():
            return []

        base_meta: dict[str, Any] = metadata or {}
        doc = self._nlp(text)
        sentences: list[tuple[str, int, int]] = [
            (sent.text, sent.start_char, sent.end_char) for sent in doc.sents
        ]

        chunks: list[Chunk] = []
        current_text = ""
        current_start = 0
        overlap_prefix = ""

        for sent_text, sent_char_start, _ in sentences:
            candidate = (overlap_prefix + sent_text) if not current_text else (current_text + " " + sent_text)

            if len(candidate) > self._chunk_size and current_text:
                # Emit the current chunk
                chunk_start = current_start
                chunk_end = sent_char_start  # up to (not including) this sentence
                chunks.append(
                    Chunk(
                        text=current_text.strip(),
                        chunk_index=len(chunks),
                        char_start=chunk_start,
                        char_end=chunk_end,
                        metadata=dict(base_meta),
                    )
                )

                # Build overlap prefix from end of emitted chunk
                overlap_prefix = ""
                if self._overlap > 0 and len(current_text) > self._overlap:
                    overlap_prefix = current_text[-self._overlap:]

                current_text = (overlap_prefix + " " + sent_text).strip() if overlap_prefix else sent_text
                current_start = max(0, chunk_end - self._overlap) if overlap_prefix else sent_char_start
            else:
                if not current_text:
                    current_text = overlap_prefix + sent_text if overlap_prefix else sent_text
                    current_start = max(0, sent_char_start - len(overlap_prefix)) if overlap_prefix else sent_char_start
                    overlap_prefix = ""
                else:
                    current_text = candidate

        # Emit the final chunk
        if current_text.strip():
            chunks.append(
                Chunk(
                    text=current_text.strip(),
                    chunk_index=len(chunks),
                    char_start=current_start,
                    char_end=len(text),
                    metadata=dict(base_meta),
                )
            )

        return chunks
