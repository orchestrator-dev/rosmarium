"""Tests for NERExtractor — uses real spaCy en_core_web_sm (fast, < 1s).

Skipped if en_core_web_sm is not installed (i.e., python -m spacy download en_core_web_sm not run).
"""

from __future__ import annotations

import pytest

try:
    import spacy
    spacy.load("en_core_web_sm", disable=["tagger", "parser", "lemmatizer"])
    _model_available = True
except OSError:
    _model_available = False

pytestmark = pytest.mark.skipif(
    not _model_available,
    reason="en_core_web_sm not installed — run: python -m spacy download en_core_web_sm",
)

from cortex_ai_worker.intelligence.ner import NERExtractor


@pytest.fixture(scope="module")
def extractor() -> NERExtractor:
    return NERExtractor()


class TestNERExtractor:
    def test_extracts_person_entities(self, extractor: NERExtractor) -> None:
        """Should detect PERSON entities in text."""
        text = "Alice Smith presented the findings to Bob Johnson at the conference."
        entities = extractor.extract(text)
        labels = {e.label for e in entities}
        texts = {e.text for e in entities}
        assert "PERSON" in labels
        # At least one of the names should be detected
        assert texts & {"Alice Smith", "Alice", "Bob Johnson", "Bob"}

    def test_extracts_org_entities(self, extractor: NERExtractor) -> None:
        """Should detect ORG entities in text."""
        text = "Google and Microsoft announced a partnership last year."
        entities = extractor.extract(text)
        labels = {e.label for e in entities}
        texts = {e.text for e in entities}
        assert "ORG" in labels
        assert texts & {"Google", "Microsoft"}

    def test_deduplicates_repeated_entity(self, extractor: NERExtractor) -> None:
        """When the same entity text appears multiple times, only one entry is returned."""
        text = "Apple released a new product. Apple said it would ship next month."
        entities = extractor.extract(text)
        apple_entries = [e for e in entities if e.text == "Apple"]
        assert len(apple_entries) <= 1

    def test_filters_irrelevant_types(self, extractor: NERExtractor) -> None:
        """CARDINAL, ORDINAL, QUANTITY, etc. should be excluded."""
        text = "There were 42 items and the 3rd batch arrived on Tuesday."
        entities = extractor.extract(text)
        labels = {e.label for e in entities}
        assert "CARDINAL" not in labels
        assert "ORDINAL" not in labels

    def test_to_dict_groups_by_label(self, extractor: NERExtractor) -> None:
        """to_dict() should group entity texts by their label."""
        from cortex_ai_worker.intelligence.ner import Entity

        entities = [
            Entity(text="Alice", label="PERSON", start=0, end=5),
            Entity(text="Bob", label="PERSON", start=10, end=13),
            Entity(text="OpenAI", label="ORG", start=20, end=26),
        ]
        grouped = extractor.to_dict(entities)
        assert "PERSON" in grouped
        assert "OpenAI" in grouped.get("ORG", [])
        assert set(grouped["PERSON"]) == {"Alice", "Bob"}

    def test_returns_empty_on_empty_string(self, extractor: NERExtractor) -> None:
        """Empty input should return empty list without error."""
        assert extractor.extract("") == []
        assert extractor.extract("   ") == []

    @pytest.mark.asyncio
    async def test_extract_async_matches_sync(self, extractor: NERExtractor) -> None:
        """Async extraction should return same results as sync."""
        text = "Elon Musk founded Tesla and SpaceX."
        sync_result = extractor.extract(text)
        async_result = await extractor.extract_async(text)
        assert len(sync_result) == len(async_result)
