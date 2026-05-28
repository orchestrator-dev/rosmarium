"""Named Entity Recognition — spaCy en_core_web_sm.

Extracts PERSON, ORG, GPE, DATE, PRODUCT, EVENT, WORK_OF_ART, LAW entities.
Only the 'ner' pipeline component is enabled for speed.
Deduplicates entities with the same text, keeping highest-confidence occurrence.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

# Entity types we care about — filter out noise like CARDINAL, ORDINAL, QUANTITY
_RELEVANT_LABELS = frozenset(
    {"PERSON", "ORG", "GPE", "DATE", "PRODUCT", "EVENT", "WORK_OF_ART", "LAW"}
)


@dataclass
class Entity:
    """A single named entity extracted from text."""

    text: str
    label: str  # e.g. PERSON, ORG, GPE
    start: int  # character offset in original text
    end: int
    confidence: float = field(default=1.0)


class NERExtractor:
    """spaCy-based named entity extractor.

    Loads en_core_web_sm lazily on first use.
    Async via thread-pool executor — spaCy is CPU-bound.
    """

    def __init__(self) -> None:
        # Callable[str] -> spacy.tokens.Doc
        self._nlp: Callable[[str], Any] | None = None

    def _ensure_loaded(self) -> None:
        """Load the spaCy model on first use."""
        if self._nlp is None:
            import spacy

            # Load model; assign via Any to bridge spaCy stubs vs no-stubs environments
            _loaded: Any = spacy.load(
                "en_core_web_sm",
                disable=["tagger", "parser", "lemmatizer", "attribute_ruler"],
            )
            self._nlp = _loaded
            logger.info("ner_model_loaded", model="en_core_web_sm")

    def extract(self, text: str) -> list[Entity]:
        """Extract named entities from text.

        Returns deduplicated list of Entity objects for relevant types only.
        """
        if not text or not text.strip():
            return []

        self._ensure_loaded()
        assert self._nlp is not None
        doc = self._nlp(text)

        # Collect entities, keeping highest-confidence per unique text+label pair
        seen: dict[tuple[str, str], Entity] = {}
        for ent in doc.ents:
            if ent.label_ not in _RELEVANT_LABELS:
                continue

            key = (ent.text.strip(), ent.label_)
            # spaCy doesn't expose per-entity confidence directly;
            # use 1.0 as default (kb_id_ is empty for en_core_web_sm)
            confidence = 1.0

            if key not in seen or confidence > seen[key].confidence:
                seen[key] = Entity(
                    text=ent.text.strip(),
                    label=ent.label_,
                    start=ent.start_char,
                    end=ent.end_char,
                    confidence=confidence,
                )

        return list(seen.values())

    async def extract_async(self, text: str) -> list[Entity]:
        """Async wrapper — runs extract() in a thread pool executor."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.extract, text)

    def to_dict(self, entities: list[Entity]) -> dict[str, list[str]]:
        """Group entities by label for compact storage.

        Returns: {"PERSON": ["Alice", "Bob"], "ORG": ["Rosmarium CMS"], ...}
        """
        result: dict[str, list[str]] = {}
        for ent in entities:
            result.setdefault(ent.label, [])
            if ent.text not in result[ent.label]:
                result[ent.label].append(ent.text)
        return result


# Singleton — loaded once per process (spaCy model load is expensive)
ner_extractor = NERExtractor()
