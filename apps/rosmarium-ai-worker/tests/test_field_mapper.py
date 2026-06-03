"""Tests for the FieldMapper — verifies deterministic and LLM field extraction."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest

from rosmarium_ai_worker.ingestor.field_mapper import FieldMapper, _slug_from_url, _first_paragraph
from rosmarium_ai_worker.ingestor.models import ClassificationResult, CrawledPage


def make_page(
    url: str = "https://example.com/blog/my-article",
    title: str | None = "My Article",
    markdown: str = "# Hello\n\nThis is the first paragraph of the article.",
    metadata: dict | None = None,
) -> CrawledPage:
    return CrawledPage(
        url=url,
        title=title,
        markdown=markdown,
        html="",
        metadata=metadata or {},
        language="en",
        contentType="text/html",
        crawledAt=datetime.now(tz=UTC),
        depth=0,
    )


def make_classification(ct_name: str = "article") -> ClassificationResult:
    return ClassificationResult(
        contentTypeName=ct_name, confidence=0.92, reasoning="test", alternativeTypes=[]
    )


ARTICLE_CT = {
    "name": "article",
    "displayName": "Article",
    "fields": [
        {"name": "title", "type": "text", "required": True},
        {"name": "slug", "type": "slug"},
        {"name": "body", "type": "richtext"},
        {"name": "summary", "type": "textarea"},
    ],
}


class TestSlugFromUrl:
    def test_extracts_last_path_segment(self) -> None:
        assert _slug_from_url("https://example.com/blog/my-article") == "my-article"

    def test_handles_trailing_slash(self) -> None:
        assert _slug_from_url("https://example.com/about/") == "about"

    def test_fallback_for_root(self) -> None:
        slug = _slug_from_url("https://example.com/")
        assert slug == "imported-page"


class TestFirstParagraph:
    def test_skips_headings(self) -> None:
        md = "# Title\n\nActual first paragraph."
        assert _first_paragraph(md) == "Actual first paragraph."

    def test_returns_empty_for_blank(self) -> None:
        assert _first_paragraph("") == ""


class TestFieldMapper:
    @pytest.mark.asyncio
    async def test_extracts_og_title(self) -> None:
        mapper = FieldMapper()
        page = make_page(metadata={"og_title": "OG Title"})

        with patch.object(mapper, "_resolve_slug", new=AsyncMock(return_value="my-article")):
            result = await mapper.map(page, ARTICLE_CT, make_classification())

        assert result.fields.get("title") == "OG Title"

    @pytest.mark.asyncio
    async def test_falls_back_to_h1_title(self) -> None:
        mapper = FieldMapper()
        page = make_page(title="H1 Title", metadata={})

        with patch.object(mapper, "_resolve_slug", new=AsyncMock(return_value="my-article")):
            result = await mapper.map(page, ARTICLE_CT, make_classification())

        assert result.fields.get("title") == "H1 Title"

    @pytest.mark.asyncio
    async def test_extracts_slug_from_url(self) -> None:
        mapper = FieldMapper()

        with patch.object(mapper, "_resolve_slug", new=AsyncMock(return_value="my-article")):
            result = await mapper.map(make_page(), ARTICLE_CT, make_classification())

        assert result.fields.get("slug") == "my-article"

    @pytest.mark.asyncio
    async def test_slug_conflict_appends_suffix(self) -> None:
        mapper = FieldMapper()
        # _resolve_slug returns -2 variant (simulating conflict)
        with patch.object(mapper, "_resolve_slug", new=AsyncMock(return_value="my-article-2")):
            result = await mapper.map(make_page(), ARTICLE_CT, make_classification())

        assert result.fields.get("slug") == "my-article-2"

    @pytest.mark.asyncio
    async def test_required_field_gets_fallback(self) -> None:
        """Required fields that can't be extracted should get fallback values (not None)."""
        ct = {
            "name": "article",
            "displayName": "Article",
            "fields": [
                {"name": "headline", "type": "text", "required": True},
            ],
        }
        mapper = FieldMapper()

        with patch.object(mapper, "_llm_extract_fields", new=AsyncMock(return_value={})):
            result = await mapper.map(make_page(), ct, make_classification())

        assert result.fields.get("headline") is not None
        assert isinstance(result.fields.get("headline"), str)

    @pytest.mark.asyncio
    async def test_extracts_date_from_og_published_time(self) -> None:
        ct = {
            "name": "article",
            "displayName": "Article",
            "fields": [
                {"name": "publishedOn", "type": "date"},
            ],
        }
        mapper = FieldMapper()
        page = make_page(metadata={"og_published_time": "2024-01-15T12:00:00Z"})

        result = await mapper.map(page, ct, make_classification())

        assert result.fields.get("publishedOn") == "2024-01-15T12:00:00Z"

    @pytest.mark.asyncio
    async def test_richtext_field_gets_full_markdown(self) -> None:
        mapper = FieldMapper()
        md = "# Title\n\nFull body content here."
        page = make_page(markdown=md)

        with patch.object(mapper, "_resolve_slug", new=AsyncMock(return_value="my-article")):
            result = await mapper.map(page, ARTICLE_CT, make_classification())

        assert result.fields.get("body") == md
