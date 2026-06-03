"""Tests for the ContentTypeClassifier — mocks LLM and embedding providers."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from rosmarium_ai_worker.ingestor.classifier import ContentTypeClassifier
from rosmarium_ai_worker.ingestor.models import ClassificationResult, CrawledPage
from datetime import UTC, datetime


def make_page(url: str = "https://example.com/post", title: str = "My Blog Post", markdown: str = "This is a blog article about Python.") -> CrawledPage:
    return CrawledPage(
        url=url,
        title=title,
        markdown=markdown,
        html="",
        metadata={},
        language="en",
        contentType="text/html",
        crawledAt=datetime.now(tz=UTC),
        depth=0,
    )


CONTENT_TYPES = [
    {
        "name": "article",
        "displayName": "Article",
        "isComponent": False,
        "fields": [
            {"name": "title", "type": "text"},
            {"name": "body", "type": "richtext"},
            {"name": "author", "type": "text"},
        ],
    },
    {
        "name": "product",
        "displayName": "Product",
        "isComponent": False,
        "fields": [
            {"name": "name", "type": "text"},
            {"name": "price", "type": "number"},
        ],
    },
]


@pytest.mark.asyncio
async def test_classify_returns_known_type() -> None:
    """classify() should return a contentTypeName from the provided list."""
    classifier = ContentTypeClassifier(CONTENT_TYPES)

    llm_response = '{"contentTypeName": "article", "confidence": 0.95, "reasoning": "It is a blog post", "alternativeTypes": ["product"]}'

    with patch.object(classifier, "_call_llm", new=AsyncMock(return_value=llm_response)):
        result = await classifier.classify(make_page())

    assert result.contentTypeName == "article"
    assert result.confidence >= 0.9


@pytest.mark.asyncio
async def test_classify_low_confidence_triggers_fallback() -> None:
    """classify() should fall back to embedding similarity when LLM confidence < 0.6."""
    classifier = ContentTypeClassifier(CONTENT_TYPES)

    low_conf_response = '{"contentTypeName": "article", "confidence": 0.4, "reasoning": "uncertain", "alternativeTypes": []}'
    fallback_result = ClassificationResult(
        contentTypeName="article",
        confidence=0.88,
        reasoning="Classified by embedding similarity (LLM fallback)",
        alternativeTypes=[],
    )

    with patch.object(classifier, "_call_llm", new=AsyncMock(return_value=low_conf_response)):
        with patch.object(classifier, "_fallback_embedding_classify", new=AsyncMock(return_value=fallback_result)):
            result = await classifier.classify(make_page())

    assert result.confidence == 0.88
    assert "fallback" in result.reasoning.lower()


@pytest.mark.asyncio
async def test_classify_handles_llm_failure() -> None:
    """classify() should not raise when LLM call fails; uses fallback instead."""
    classifier = ContentTypeClassifier(CONTENT_TYPES)

    fallback_result = ClassificationResult(
        contentTypeName="article",
        confidence=0.7,
        reasoning="Classified by embedding similarity (LLM fallback)",
        alternativeTypes=[],
    )

    with patch.object(classifier, "_call_llm", new=AsyncMock(side_effect=RuntimeError("LLM down"))):
        with patch.object(classifier, "_fallback_embedding_classify", new=AsyncMock(return_value=fallback_result)):
            result = await classifier.classify(make_page())

    assert result.contentTypeName in {"article", "product"}


@pytest.mark.asyncio
async def test_classify_batch_respects_concurrency() -> None:
    """classify_batch() should handle 10 pages with concurrency limit without error."""
    classifier = ContentTypeClassifier(CONTENT_TYPES)

    good_response = '{"contentTypeName": "article", "confidence": 0.9, "reasoning": "Blog post", "alternativeTypes": []}'

    with patch.object(classifier, "_call_llm", new=AsyncMock(return_value=good_response)):
        pages = [make_page(url=f"https://example.com/post-{i}") for i in range(10)]
        results = await classifier.classify_batch(pages)

    assert len(results) == 10
    for r in results:
        assert r.contentTypeName in {"article", "product"}


@pytest.mark.asyncio
async def test_classify_no_content_types() -> None:
    """classify() with empty content_types list should return low-confidence result without error."""
    classifier = ContentTypeClassifier([])
    result = await classifier.classify(make_page())
    assert result.confidence == 0.0


@pytest.mark.asyncio
async def test_classify_filters_component_types() -> None:
    """ContentTypeClassifier should exclude isComponent=True content types from classification options."""
    cts = CONTENT_TYPES + [
        {"name": "image_block", "displayName": "Image Block", "isComponent": True, "fields": []}
    ]
    classifier = ContentTypeClassifier(cts)
    # Component types should not be in the summary
    assert "image_block" not in classifier._ct_summary
