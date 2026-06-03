"""Tests for the IngestionPipeline — mocks crawler, classifier, field_mapper, duplicate_guard."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from rosmarium_ai_worker.ingestor.models import (
    ClassificationResult,
    ContentSetStatus,
    CrawledPage,
    IngestorConfig,
    IngestionResult,
)
from rosmarium_ai_worker.ingestor.pipeline import IngestionPipeline


def make_config(**kwargs: Any) -> IngestorConfig:
    base: dict[str, Any] = dict(
        startUrl="https://example.com",
        contentSetName="Test Set",
        apiKey="test-key",
        maxDepth=1,
        maxPages=10,
    )
    base.update(kwargs)
    return IngestorConfig(**base)


def make_page(url: str, title: str = "Test Page") -> CrawledPage:
    return CrawledPage(
        url=url,
        title=title,
        markdown=f"# {title}\n\nContent for {url}",
        html="",
        metadata={"og_title": title},
        language="en",
        contentType="text/html",
        crawledAt=datetime.now(tz=UTC),
        depth=0,
    )


MOCK_CONTENT_TYPES = [
    {
        "name": "article",
        "displayName": "Article",
        "isComponent": False,
        "fields": [
            {"name": "title", "type": "text", "required": True},
            {"name": "body", "type": "richtext"},
        ],
    }
]


@pytest.mark.asyncio
async def test_pipeline_full_flow_3_pages() -> None:
    """Pipeline runs full flow for 3 pages: crawl → classify → map → create entry."""
    config = make_config()
    pipeline = IngestionPipeline()

    pages = [make_page(f"https://example.com/post-{i}") for i in range(3)]
    classifications = [
        ClassificationResult(
            contentTypeName="article",
            confidence=0.9,
            reasoning="test",
            alternativeTypes=[],
        )
        for _ in pages
    ]

    status_updates: list[ContentSetStatus] = []

    async def on_status(status: ContentSetStatus) -> None:
        status_updates.append(status)

    async def mock_crawl(progress_callback: Any) -> Any:
        for page in pages:
            await progress_callback(page)
            yield page

    with patch.object(pipeline, "_fetch_content_types", new=AsyncMock(return_value=MOCK_CONTENT_TYPES)):
        with patch("rosmarium_ai_worker.ingestor.pipeline.RosmaCrawler") as MockCrawler:
            mock_crawler_instance = MagicMock()
            mock_crawler_instance.crawl = mock_crawl
            MockCrawler.return_value = mock_crawler_instance

            with patch("rosmarium_ai_worker.ingestor.pipeline.ContentTypeClassifier") as MockClassifier:
                mock_cls_instance = MagicMock()
                mock_cls_instance.classify_batch = AsyncMock(return_value=classifications)
                MockClassifier.return_value = mock_cls_instance

                with patch("rosmarium_ai_worker.ingestor.pipeline.DuplicateGuard") as MockGuard:
                    mock_guard_instance = MagicMock()
                    mock_guard_instance.check = AsyncMock(return_value=(False, None, None))
                    MockGuard.return_value = mock_guard_instance

                    with patch("rosmarium_ai_worker.ingestor.pipeline.FieldMapper") as MockMapper:
                        mock_mapper_instance = MagicMock()

                        from rosmarium_ai_worker.ingestor.models import MappedEntry
                        mock_mapper_instance.map = AsyncMock(
                            return_value=MappedEntry(
                                contentTypeName="article",
                                fields={"title": "Test", "body": "Content"},
                                confidence=0.9,
                                sourceUrl="https://example.com/post-0",
                                sourceTitle="Test",
                                isDuplicate=False,
                                duplicateEntryId=None,
                                duplicateScore=None,
                            )
                        )
                        MockMapper.return_value = mock_mapper_instance

                        with patch.object(pipeline, "_create_entry", new=AsyncMock(return_value="entry-id-123")):
                            with patch.object(pipeline, "_trigger_graph_analytics", new=AsyncMock()):
                                with patch("rosmarium_ai_worker.ingestor.pipeline.content_set_manager") as mock_csm:
                                    mock_csm.update_status = AsyncMock()
                                    mock_csm.add_item = AsyncMock()

                                    with patch("rosmarium_ai_worker.ingestor.pipeline.get_pool") as mock_pool:
                                        mock_conn = AsyncMock()
                                        mock_pool.return_value = AsyncMock()
                                        mock_pool.return_value.acquire = MagicMock()
                                        mock_pool.return_value.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
                                        mock_pool.return_value.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

                                        with patch("rosmarium_ai_worker.ingestor.pipeline.aioredis") as mock_redis_mod:
                                            mock_redis_client = AsyncMock()
                                            mock_redis_client.exists = AsyncMock(return_value=0)
                                            mock_redis_client.aclose = AsyncMock()
                                            mock_redis_mod.from_url = MagicMock(return_value=mock_redis_client)

                                            final_status = await pipeline.run(
                                                config=config,
                                                job_id="test-job-id",
                                                content_set_id="test-set-id",
                                                status_callback=on_status,
                                            )

    assert final_status.status == "complete"
    assert final_status.importedEntries == 3
    assert len(status_updates) > 0


@pytest.mark.asyncio
async def test_pipeline_skips_duplicates() -> None:
    """Pipeline should track skippedDuplicates when DuplicateGuard returns True."""
    config = make_config()
    pipeline = IngestionPipeline()

    pages = [make_page("https://example.com/post-0")]
    classifications = [
        ClassificationResult(
            contentTypeName="article",
            confidence=0.9,
            reasoning="test",
            alternativeTypes=[],
        )
    ]

    async def mock_crawl(callback: Any) -> Any:
        for p in pages:
            await callback(p)
            yield p

    with patch.object(pipeline, "_fetch_content_types", new=AsyncMock(return_value=MOCK_CONTENT_TYPES)):
        with patch("rosmarium_ai_worker.ingestor.pipeline.RosmaCrawler") as MockCrawler:
            inst = MagicMock()
            inst.crawl = mock_crawl
            MockCrawler.return_value = inst

            with patch("rosmarium_ai_worker.ingestor.pipeline.ContentTypeClassifier") as MockCls:
                cls_inst = MagicMock()
                cls_inst.classify_batch = AsyncMock(return_value=classifications)
                MockCls.return_value = cls_inst

                with patch("rosmarium_ai_worker.ingestor.pipeline.DuplicateGuard") as MockGuard:
                    guard_inst = MagicMock()
                    guard_inst.check = AsyncMock(return_value=(True, "existing-id", 0.99))
                    MockGuard.return_value = guard_inst

                    with patch.object(pipeline, "_create_entry", new=AsyncMock()) as mock_create:
                        with patch.object(pipeline, "_trigger_graph_analytics", new=AsyncMock()):
                            with patch("rosmarium_ai_worker.ingestor.pipeline.content_set_manager") as mock_csm:
                                mock_csm.update_status = AsyncMock()
                                mock_csm.add_item = AsyncMock()

                                with patch("rosmarium_ai_worker.ingestor.pipeline.get_pool") as mock_pool:
                                    mock_conn = AsyncMock()
                                    mock_pool.return_value = AsyncMock()
                                    mock_pool.return_value.acquire = MagicMock()
                                    mock_pool.return_value.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
                                    mock_pool.return_value.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

                                    with patch("rosmarium_ai_worker.ingestor.pipeline.aioredis") as mock_redis_mod:
                                        mock_redis_client = AsyncMock()
                                        mock_redis_client.exists = AsyncMock(return_value=0)
                                        mock_redis_client.aclose = AsyncMock()
                                        mock_redis_mod.from_url = MagicMock(return_value=mock_redis_client)

                                        final_status = await pipeline.run(
                                            config=config,
                                            job_id="test-job-id",
                                            content_set_id="test-set-id",
                                            status_callback=AsyncMock(),
                                        )

    assert final_status.skippedDuplicates == 1
    assert final_status.importedEntries == 0
    mock_create.assert_not_called()


@pytest.mark.asyncio
async def test_pipeline_respects_cancellation_flag() -> None:
    """Pipeline should cancel when Redis cancellation flag is set."""
    config = make_config()
    pipeline = IngestionPipeline()

    pages = [make_page("https://example.com/post-0")]

    async def mock_crawl(callback: Any) -> Any:
        for p in pages:
            await callback(p)
            yield p

    with patch.object(pipeline, "_fetch_content_types", new=AsyncMock(return_value=MOCK_CONTENT_TYPES)):
        with patch("rosmarium_ai_worker.ingestor.pipeline.RosmaCrawler") as MockCrawler:
            inst = MagicMock()
            inst.crawl = mock_crawl
            MockCrawler.return_value = inst

            with patch("rosmarium_ai_worker.ingestor.pipeline.ContentTypeClassifier") as MockCls:
                cls_inst = MagicMock()
                cls_inst.classify_batch = AsyncMock(return_value=[
                    ClassificationResult(contentTypeName="article", confidence=0.9, reasoning="", alternativeTypes=[])
                ])
                MockCls.return_value = cls_inst

                with patch.object(pipeline, "_trigger_graph_analytics", new=AsyncMock()):
                    with patch("rosmarium_ai_worker.ingestor.pipeline.content_set_manager") as mock_csm:
                        mock_csm.update_status = AsyncMock()
                        mock_csm.add_item = AsyncMock()

                        with patch("rosmarium_ai_worker.ingestor.pipeline.aioredis") as mock_redis_mod:
                            mock_redis_client = AsyncMock()
                            # Return 1 (True) on first exists() call to trigger cancellation
                            mock_redis_client.exists = AsyncMock(return_value=1)
                            mock_redis_client.aclose = AsyncMock()
                            mock_redis_mod.from_url = MagicMock(return_value=mock_redis_client)

                            final_status = await pipeline.run(
                                config=config,
                                job_id="test-job-id",
                                content_set_id="test-set-id",
                                status_callback=AsyncMock(),
                            )

    assert final_status.status == "cancelled"
