"""Crawl4AI wrapper for recursive website crawling.

Crawls from a start URL up to maxDepth, yields CrawledPage objects one at a time.
Handles JS-rendered pages via Playwright headless Chromium.
"""

from __future__ import annotations

import re
from collections.abc import AsyncGenerator, Awaitable, Callable
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from urllib.parse import urljoin, urlparse

import structlog

from .models import CrawledPage, IngestorConfig

if TYPE_CHECKING:
    pass

logger = structlog.get_logger(__name__)


def _extract_og_metadata(html: str) -> dict[str, Any]:
    """Extract Open Graph and meta tags from raw HTML."""
    meta: dict[str, Any] = {}

    # og: tags
    og_pattern = re.compile(
        r'<meta\s+property=["\']og:(\w+)["\']\s+content=["\'](.*?)["\']',
        re.IGNORECASE,
    )
    for match in og_pattern.finditer(html):
        meta[f"og_{match.group(1)}"] = match.group(2)

    # meta description
    desc_pattern = re.compile(
        r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']',
        re.IGNORECASE,
    )
    m = desc_pattern.search(html)
    if m:
        meta["description"] = m.group(1)

    return meta


def _extract_title_from_html(html: str) -> str | None:
    """Extract the <title> text from raw HTML."""
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return m.group(1).strip() if m else None


def _detect_language(text: str) -> str | None:
    """Detect the language of a text string using langdetect."""
    try:
        from langdetect import detect  # type: ignore[import-untyped]
        return str(detect(text[:1000]))
    except Exception:
        return None


class RosmaCrawler:
    """Wraps Crawl4AI for recursive website crawling.

    Yields clean markdown output for each page, one at a time.
    Handles link discovery, deduplication, robots.txt, and URL filtering.
    """

    def __init__(self, config: IngestorConfig) -> None:
        self._config = config
        self._base_domain = urlparse(config.startUrl).netloc

    async def crawl(
        self,
        progress_callback: Callable[[CrawledPage], Awaitable[None]],
    ) -> AsyncGenerator[CrawledPage, None]:
        """Recursively crawl startUrl up to maxDepth.

        Yields CrawledPage objects one at a time as they are crawled.
        The progress_callback is also called for each page for live updates.
        """
        try:
            from crawl4ai import (  # type: ignore[import-untyped]
                AsyncWebCrawler,
                BrowserConfig,
                CrawlerRunConfig,
            )
            from crawl4ai.content_filter_strategy import (
                PruningContentFilter,  # type: ignore[import-untyped]
            )
            from crawl4ai.markdown_generation_strategy import (
                DefaultMarkdownGenerator,  # type: ignore[import-untyped]
            )
        except ImportError as exc:
            raise RuntimeError(
                "crawl4ai is not installed. "
                "Install with: uv pip install 'rosmarium-ai-worker[ingestor]'"
            ) from exc

        browser_config = BrowserConfig(
            headless=True,
            browser_type="chromium",
            verbose=False,
        )
        run_config = CrawlerRunConfig(
            only_main_content=True,
            markdown_generator=DefaultMarkdownGenerator(
                content_filter=PruningContentFilter()
            ),
            wait_for="networkidle",
            respect_robots_txt=self._config.respectRobotsTxt,
        )

        visited: set[str] = set()
        queue: list[tuple[str, int]] = [(self._config.startUrl, 0)]
        page_count = 0

        async with AsyncWebCrawler(config=browser_config) as crawler:
            while queue and page_count < self._config.maxPages:
                url, depth = queue.pop(0)

                # Normalise URL (strip fragments)
                url = url.split("#")[0].rstrip("/") or url

                if url in visited:
                    continue
                if not self._url_matches(url):
                    logger.debug("url_filtered", url=url)
                    continue

                visited.add(url)

                try:
                    result = await crawler.arun(url=url, config=run_config)

                    if not result.success or not result.markdown:
                        logger.warning("crawl_page_failed", url=url)
                        continue

                    html: str = result.html or ""
                    meta = _extract_og_metadata(html)

                    # Title: og:title → <title> → None
                    title = (
                        meta.get("og_title")
                        or _extract_title_from_html(html)
                    )

                    markdown_text: str = (
                        result.markdown.fit_markdown
                        if hasattr(result.markdown, "fit_markdown")
                        else str(result.markdown)
                    )

                    page = CrawledPage(
                        url=url,
                        title=title,
                        markdown=markdown_text,
                        html=html,
                        metadata=meta,
                        language=_detect_language(markdown_text),
                        contentType=result.response_headers.get("content-type")
                        if hasattr(result, "response_headers") and result.response_headers
                        else None,
                        crawledAt=datetime.now(tz=UTC),
                        depth=depth,
                    )

                    yield page
                    await progress_callback(page)
                    page_count += 1

                    # Discover internal links for next depth
                    if depth < self._config.maxDepth and hasattr(result, "links"):
                        for link in result.links.get("internal", []):
                            href = link.get("href", "")
                            if not href:
                                continue
                            # Resolve relative URLs
                            absolute = urljoin(url, href).split("#")[0].rstrip("/")
                            if absolute and absolute not in visited:
                                queue.append((absolute, depth + 1))

                except Exception as e:
                    logger.warning("crawl_page_error", url=url, error=str(e))

    def _url_matches(self, url: str) -> bool:
        """Return True if URL should be crawled based on domain + pattern filters."""
        parsed = urlparse(url)

        # Must be same domain
        if parsed.netloc != self._base_domain:
            return False

        # Must match at least one includePattern (if any)
        if self._config.includePatterns:
            if not any(
                re.search(p, url) for p in self._config.includePatterns
            ):
                return False

        # Must not match any excludePattern
        if self._config.excludePatterns:
            if any(re.search(p, url) for p in self._config.excludePatterns):
                return False

        return True
