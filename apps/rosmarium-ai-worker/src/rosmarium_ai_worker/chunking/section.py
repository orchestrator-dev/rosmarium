"""Section-aware chunker.

Detects markdown headings (# / ## / ###) and HTML headings (<h1>-<h4>),
splits text at heading boundaries, then applies SentenceChunker within each
section.  Section title and parent heading are injected into chunk metadata.
"""

from __future__ import annotations

import re
from typing import Any

from .base import Chunk, ChunkingStrategy
from .sentence import SentenceChunker

# Matches:  # Heading, ## Heading, ### Heading, #### Heading
_MARKDOWN_HEADING = re.compile(r"^(#{1,4})\s+(.+)$", re.MULTILINE)
# Matches:  <h1>Heading</h1> ... <h4>...>
_HTML_HEADING = re.compile(r"<h([1-4])[^>]*>(.*?)</h\1>", re.IGNORECASE | re.DOTALL)


class SectionChunker(ChunkingStrategy):
    """Heading-aware chunker that delegates to SentenceChunker within sections.

    Args:
        chunk_size: Forwarded to the inner SentenceChunker (default 512).
        overlap:    Forwarded to the inner SentenceChunker (default 50).
    """

    def __init__(self, chunk_size: int = 512, overlap: int = 50) -> None:
        self._chunk_size = chunk_size
        self._overlap = overlap

    def chunk(self, text: str, metadata: dict[str, Any] | None = None) -> list[Chunk]:
        """Split *text* into section-aware chunks.

        Each section's chunks carry `section_title` and `parent_heading` in
        their metadata.  Falls back to sentence chunking when no headings are
        found.
        """
        if not text or not text.strip():
            return []

        base_meta: dict[str, Any] = metadata or {}
        sections = self._detect_sections(text)
        sentence_chunker = SentenceChunker(self._chunk_size, self._overlap)

        all_chunks: list[Chunk] = []
        global_index = 0

        for section in sections:
            section_meta: dict[str, Any] = {
                **base_meta,
                "section_title": section["title"],
                "parent_heading": section["parent_heading"],
            }
            sub_chunks = sentence_chunker.chunk(section["text"], section_meta)
            for c in sub_chunks:
                # Re-index globally; offsets are relative to each section's text
                all_chunks.append(
                    Chunk(
                        text=c.text,
                        chunk_index=global_index,
                        char_start=c.char_start + section["start"],
                        char_end=c.char_end + section["start"],
                        metadata=c.metadata,
                    )
                )
                global_index += 1

        return all_chunks

    # ------------------------------------------------------------------ #
    # Section detection                                                     #
    # ------------------------------------------------------------------ #

    def _detect_sections(self, text: str) -> list[dict[str, Any]]:
        """Return a list of section dicts: {title, parent_heading, text, start, end}."""
        boundaries: list[dict[str, Any]] = []

        # --- Markdown headings ---
        for m in _MARKDOWN_HEADING.finditer(text):
            level = len(m.group(1))
            title = m.group(2).strip()
            boundaries.append({"pos": m.start(), "end": m.end(), "level": level, "title": title})

        # --- HTML headings (only if no markdown headings found) ---
        if not boundaries:
            for m in _HTML_HEADING.finditer(text):
                level = int(m.group(1))
                title = re.sub(r"<[^>]+>", "", m.group(2)).strip()
                boundaries.append({"pos": m.start(), "end": m.end(), "level": level, "title": title})

        if not boundaries:
            # No headings — treat whole text as one unnamed section
            return [{"title": "", "parent_heading": "", "text": text, "start": 0, "end": len(text)}]

        # Sort by position (should already be ordered, but be safe)
        boundaries.sort(key=lambda b: b["pos"])

        # Build section list with parent_heading tracking
        sections: list[dict[str, Any]] = []
        # Leading content before the first heading (if any)
        if boundaries[0]["pos"] > 0:
            preamble = text[: boundaries[0]["pos"]].strip()
            if preamble:
                sections.append(
                    {"title": "", "parent_heading": "", "text": preamble, "start": 0, "end": boundaries[0]["pos"]}
                )

        heading_stack: list[dict[str, Any]] = []

        for i, boundary in enumerate(boundaries):
            # Pop headings from stack that are at same or deeper level
            while heading_stack and heading_stack[-1]["level"] >= boundary["level"]:
                heading_stack.pop()

            parent_heading = heading_stack[-1]["title"] if heading_stack else ""
            heading_stack.append(boundary)

            # Text of this section runs from end of this heading to start of next
            text_start = boundary["end"]
            text_end = boundaries[i + 1]["pos"] if i + 1 < len(boundaries) else len(text)
            section_text = text[text_start:text_end].strip()

            if section_text:
                sections.append(
                    {
                        "title": boundary["title"],
                        "parent_heading": parent_heading,
                        "text": section_text,
                        "start": text_start,
                        "end": text_end,
                    }
                )

        return sections
