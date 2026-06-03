"""Tests for the RosmaCrawler — uses httpx mock transport, never hits real URLs."""

from __future__ import annotations

import re
from datetime import UTC, datetime
import sys
from unittest.mock import AsyncMock, MagicMock, patch

sys.modules["crawl4ai"] = MagicMock()
sys.modules["crawl4ai.content_filter_strategy"] = MagicMock()
sys.modules["crawl4ai.markdown_generation_strategy"] = MagicMock()

import pytest

from rosmarium_ai_worker.ingestor.crawler import (
    RosmaCrawler,
    _detect_language,
    _extract_og_metadata,
    _extract_title_from_html,
)
from rosmarium_ai_worker.ingestor.models import IngestorConfig


def make_config(**kwargs: object) -> IngestorConfig:
    base = dict(
        startUrl="https://example.com",
        contentSetName="test",
        apiKey="test-key",
    )
    base.update(kwargs)
    return IngestorConfig(**base)  # type: ignore[arg-type]


def make_crawl_result(url: str, markdown: str = "# Hello\n\nContent here.", links: list[dict] | None = None) -> MagicMock:
    result = MagicMock()
    result.success = True
    result.html = f"<html><title>{url}</title><body></body></html>"
    result.response_headers = {"content-type": "text/html"}
    result.links = {"internal": links or []}

    # crawl4ai markdown object
    md_obj = MagicMock()
    md_obj.fit_markdown = markdown
    result.markdown = md_obj
    return result


class TestExtractOgMetadata:
    def test_extracts_og_title(self) -> None:
        html = '<meta property="og:title" content="My Page" />'
        meta = _extract_og_metadata(html)
        assert meta["og_title"] == "My Page"

    def test_extracts_description(self) -> None:
        html = '<meta name="description" content="My desc" />'
        meta = _extract_og_metadata(html)
        assert meta["description"] == "My desc"

    def test_empty_html(self) -> None:
        assert _extract_og_metadata("") == {}


class TestExtractTitle:
    def test_extracts_title(self) -> None:
        html = "<html><head><title>Hello World</title></head></html>"
        assert _extract_title_from_html(html) == "Hello World"

    def test_none_when_missing(self) -> None:
        assert _extract_title_from_html("<html></html>") is None


class TestUrlMatches:
    def test_same_domain_allowed(self) -> None:
        config = make_config(startUrl="https://example.com/blog")
        crawler = RosmaCrawler(config)
        assert crawler._url_matches("https://example.com/blog/post-1")

    def test_different_domain_rejected(self) -> None:
        config = make_config(startUrl="https://example.com")
        crawler = RosmaCrawler(config)
        assert not crawler._url_matches("https://other.com/page")

    def test_include_pattern_filter(self) -> None:
        config = make_config(
            startUrl="https://example.com",
            includePatterns=[r"/blog/.*"],
        )
        crawler = RosmaCrawler(config)
        assert crawler._url_matches("https://example.com/blog/post")
        assert not crawler._url_matches("https://example.com/about")

    def test_exclude_pattern_filter(self) -> None:
        config = make_config(
            startUrl="https://example.com",
            excludePatterns=[r"/tag/.*"],
        )
        crawler = RosmaCrawler(config)
        assert not crawler._url_matches("https://example.com/tag/python")
        assert crawler._url_matches("https://example.com/blog/post")


@pytest.mark.asyncio
async def test_crawler_respects_max_pages() -> None:
    """RosmaCrawler should stop after maxPages even if more links exist."""
    config = make_config(maxPages=2, maxDepth=5)
    crawler = RosmaCrawler(config)

    # Create a result with many internal links
    link_result = make_crawl_result(
        "https://example.com",
        links=[{"href": f"https://example.com/page-{i}"} for i in range(20)],
    )

    pages_seen: list[str] = []

    async def mock_progress(page: object) -> None:
        pass

    with patch("crawl4ai.AsyncWebCrawler") as MockCrawler:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        mock_instance.arun = AsyncMock(return_value=link_result)
        MockCrawler.return_value = mock_instance

        with patch("crawl4ai.BrowserConfig"):
            with patch("crawl4ai.CrawlerRunConfig"):
                async for page in crawler.crawl(mock_progress):
                    pages_seen.append(page.url)

    assert len(pages_seen) <= config.maxPages


@pytest.mark.asyncio
async def test_crawler_respects_max_depth() -> None:
    """Crawler should not enqueue links beyond maxDepth."""
    config = make_config(maxDepth=1, maxPages=100)
    crawler = RosmaCrawler(config)

    call_count = 0

    async def mock_progress(page: object) -> None:
        pass

    depth0_result = make_crawl_result(
        "https://example.com",
        links=[{"href": "https://example.com/level1"}],
    )
    depth1_result = make_crawl_result(
        "https://example.com/level1",
        links=[{"href": "https://example.com/level2"}],
    )

    def side_effect(url: str, config: object) -> MagicMock:
        nonlocal call_count
        call_count += 1
        if "/level1" in url:
            return depth1_result
        return depth0_result

    with patch("crawl4ai.AsyncWebCrawler") as MockCrawler:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        mock_instance.arun = AsyncMock(side_effect=side_effect)
        MockCrawler.return_value = mock_instance

        with patch("crawl4ai.BrowserConfig"):
            with patch("crawl4ai.CrawlerRunConfig"):
                pages: list[object] = []
                async for page in crawler.crawl(mock_progress):
                    pages.append(page)

    # Should have crawled start URL + level1 only (level2 is at depth 2, max is 1)
    assert call_count <= 2


@pytest.mark.asyncio
async def test_crawled_page_has_required_fields() -> None:
    """Each CrawledPage must have url, markdown, crawledAt, and depth."""
    config = make_config()
    crawler = RosmaCrawler(config)

    result = make_crawl_result("https://example.com", "# Hello")

    async def mock_progress(page: object) -> None:
        pass

    with patch("crawl4ai.AsyncWebCrawler") as MockCrawler:
        mock_instance = AsyncMock()
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=False)
        mock_instance.arun = AsyncMock(return_value=result)
        MockCrawler.return_value = mock_instance

        with patch("crawl4ai.BrowserConfig"):
            with patch("crawl4ai.CrawlerRunConfig"):
                pages: list[object] = []
                async for page in crawler.crawl(mock_progress):
                    pages.append(page)

    assert len(pages) == 1
    page = pages[0]
    assert hasattr(page, "url")
    assert hasattr(page, "markdown")
    assert hasattr(page, "crawledAt")
    assert hasattr(page, "depth")
    assert page.depth == 0  # type: ignore[attr-defined]
