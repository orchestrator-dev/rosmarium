"""Ingestion pipeline orchestrator for the Rosmarium Content Ingestor.

Orchestrates the complete flow:
  Crawl → Classify → Field Map → Duplicate Check → Create Entry → Track
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

import httpx
import redis.asyncio as aioredis
import structlog

from ..config import settings
from ..database import get_pool
from .classifier import ContentTypeClassifier
from .content_set import content_set_manager
from .crawler import RosmaCrawler
from .duplicate_guard import DuplicateGuard
from .field_mapper import FieldMapper
from .models import (
    ClassificationResult,
    ContentSetStatus,
    CrawledPage,
    IngestionResult,
    IngestorConfig,
)

logger = structlog.get_logger(__name__)

_CANCEL_KEY_PREFIX = "ingestor:cancel:"
_GRAPH_ANALYTICS_JOB = "compute-graph-analytics"


class IngestionPipeline:
    """Orchestrates the complete ingestion flow for a single crawl job.

    Designed to run as a BullMQ job in the ai-worker.
    Checks Redis cancellation flag on each page iteration.
    """

    async def run(
        self,
        config: IngestorConfig,
        job_id: str,
        content_set_id: str,
        status_callback: Callable[[ContentSetStatus], Awaitable[None]],
    ) -> ContentSetStatus:
        """Execute the full ingestor pipeline and return final status."""
        status = ContentSetStatus(
            jobId=job_id,
            contentSetId=content_set_id,
            contentSetName=config.contentSetName,
            startUrl=config.startUrl,
            status="crawling",
            startedAt=datetime.now(tz=UTC),
        )
        await status_callback(status)

        redis_client = aioredis.from_url(settings.redis_url)

        try:
            # Step 1: Fetch content types
            content_types = await self._fetch_content_types(config)
            classifier = ContentTypeClassifier(content_types)

            # Step 2: Crawl
            crawler = RosmaCrawler(config)
            crawled_pages: list[CrawledPage] = []

            async def on_page_crawled(page: CrawledPage) -> None:
                crawled_pages.append(page)
                status.crawledPages = len(crawled_pages)
                status.totalPages = len(crawled_pages)
                await status_callback(status)

            async for _page in crawler.crawl(on_page_crawled):
                # Check cancellation flag
                cancelled = await redis_client.exists(f"{_CANCEL_KEY_PREFIX}{job_id}")
                if cancelled:
                    status.status = "cancelled"
                    await content_set_manager.update_status(
                        job_id, "cancelled", self._stats(status)
                    )
                    await status_callback(status)
                    return status

            # Step 3: Classify
            status.status = "classifying"
            await status_callback(status)

            if config.targetContentType:
                classifications: list[ClassificationResult] = [
                    ClassificationResult(
                        contentTypeName=config.targetContentType,
                        confidence=1.0,
                        reasoning="User-specified content type",
                        alternativeTypes=[],
                    )
                    for _ in crawled_pages
                ]
            else:
                classifications = await classifier.classify_batch(crawled_pages)

            status.classifiedPages = len(classifications)
            await status_callback(status)

            # Step 4: Map fields + import entries
            status.status = "importing"
            await status_callback(status)

            results: list[IngestionResult] = []
            guard = DuplicateGuard(similarity_threshold=config.duplicateThreshold)
            mapper = FieldMapper()

            pool = await get_pool()

            for page, classification in zip(crawled_pages, classifications, strict=False):
                # Check cancellation
                cancelled = await redis_client.exists(f"{_CANCEL_KEY_PREFIX}{job_id}")
                if cancelled:
                    status.status = "cancelled"
                    break

                try:
                    # Skip very low confidence
                    if classification.confidence < 0.5:
                        logger.warning(
                            "low_confidence_skip",
                            url=page.url,
                            confidence=classification.confidence,
                        )
                        status.failedPages += 1
                        continue

                    async with pool.acquire() as conn:
                        is_dup, _dup_id, _dup_score = await guard.check(
                            source_url=page.url,
                            title=page.title,
                            markdown=page.markdown,
                            content_type_name=classification.contentTypeName,
                            conn=conn,
                        )

                    if is_dup:
                        status.skippedDuplicates += 1
                        result = IngestionResult(
                            entryId=None,
                            sourceUrl=page.url,
                            contentType=classification.contentTypeName,
                            status="skipped_duplicate",
                        )
                        results.append(result)
                        status.recentResults = [result, *status.recentResults][:20]
                        await status_callback(status)
                        continue

                    # Map fields
                    ct_def = next(
                        (
                            ct
                            for ct in content_types
                            if ct["name"] == classification.contentTypeName
                        ),
                        None,
                    )
                    if ct_def is None:
                        logger.warning(
                            "content_type_not_found",
                            type_name=classification.contentTypeName,
                        )
                        status.failedPages += 1
                        continue

                    mapped = await mapper.map(
                        page, ct_def, classification, config.apiBaseUrl, config.apiKey
                    )

                    # Add ingestor metadata
                    mapped.fields["_sourceUrl"] = page.url
                    mapped.fields["_ingestedAt"] = datetime.now(tz=UTC).isoformat()
                    mapped.fields["_contentSetId"] = content_set_id
                    mapped.fields["_classificationConfidence"] = classification.confidence

                    # Create entry via rosmarium-server API
                    entry_id = await self._create_entry(
                        config, classification.contentTypeName, mapped.fields
                    )

                    # Publish if configured
                    if config.importAs == "published":
                        await self._publish_entry(
                            config, classification.contentTypeName, entry_id
                        )

                    # Track in content set
                    await content_set_manager.add_item(
                        content_set_id=content_set_id,
                        entry_id=entry_id,
                        source_url=page.url,
                        content_type=classification.contentTypeName,
                        classification_confidence=classification.confidence,
                    )

                    status.importedEntries += 1
                    result = IngestionResult(
                        entryId=entry_id,
                        sourceUrl=page.url,
                        contentType=classification.contentTypeName,
                        status="created",
                    )
                    results.append(result)
                    status.recentResults = [result, *status.recentResults][:20]

                except Exception as e:
                    status.failedPages += 1
                    status.errors.append(f"{page.url}: {e!s}")
                    result = IngestionResult(
                        entryId=None,
                        sourceUrl=page.url,
                        contentType=classification.contentTypeName
                        if classification else "unknown",
                        status="failed",
                        errorMessage=str(e),
                    )
                    results.append(result)
                    status.recentResults = [result, *status.recentResults][:20]
                    logger.error("ingestion_entry_failed", url=page.url, error=str(e))

                await status_callback(status)

            # Step 5: Graph analytics trigger
            if status.status != "cancelled":
                imported_types = list(
                    {r.contentType for r in results if r.status == "created"}
                )
                if imported_types:
                    await self._trigger_graph_analytics(config, imported_types, redis_client)

                status.status = "complete"
            status.completedAt = datetime.now(tz=UTC)

            await content_set_manager.update_status(
                job_id,
                status.status,
                self._stats(status),
                completed_at=status.completedAt.isoformat(),
            )
            await status_callback(status)
            return status

        except Exception as e:
            logger.error("ingestion_pipeline_failed", job_id=job_id, error=str(e))
            status.status = "failed"
            status.completedAt = datetime.now(tz=UTC)
            status.errors.append(str(e))
            await content_set_manager.update_status(
                job_id,
                "failed",
                self._stats(status),
                completed_at=status.completedAt.isoformat(),
            )
            await status_callback(status)
            return status
        finally:
            await redis_client.aclose()

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _fetch_content_types(self, config: IngestorConfig) -> list[dict[str, Any]]:
        """Fetch all content types from the rosmarium-server REST API."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"Authorization": f"Bearer {config.apiKey}"}
            if config.tenantId:
                headers["X-Tenant-Id"] = config.tenantId
            resp = await client.get(
                f"{config.apiBaseUrl}/api/content-types", headers=headers
            )
            resp.raise_for_status()
            data = resp.json()
            return list(data.get("data", []))

    async def _create_entry(
        self,
        config: IngestorConfig,
        content_type_name: str,
        fields: dict[str, Any],
    ) -> str:
        """Create a content entry via the rosmarium-server REST API."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {
                "Authorization": f"Bearer {config.apiKey}",
                "Content-Type": "application/json",
            }
            if config.tenantId:
                headers["X-Tenant-Id"] = config.tenantId

            resp = await client.post(
                f"{config.apiBaseUrl}/api/content/{content_type_name}",
                headers=headers,
                json=fields,
            )
            resp.raise_for_status()
            data = resp.json()
            entry_id = data.get("data", {}).get("id") or data.get("id")
            if not entry_id:
                raise RuntimeError(f"No entry ID returned from API: {data}")
            return str(entry_id)

    async def _publish_entry(
        self, config: IngestorConfig, content_type_name: str, entry_id: str
    ) -> None:
        """Publish a content entry via the rosmarium-server REST API."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"Authorization": f"Bearer {config.apiKey}"}
            if config.tenantId:
                headers["X-Tenant-Id"] = config.tenantId
            await client.post(
                f"{config.apiBaseUrl}/api/content/{content_type_name}/{entry_id}/publish",
                headers=headers,
            )

    async def _trigger_graph_analytics(
        self,
        config: IngestorConfig,
        content_types: list[str],
        redis_client: aioredis.Redis,  # type: ignore[type-arg]
    ) -> None:
        """Enqueue graph analytics jobs for imported content types."""
        import json
        import time

        for ct in content_types:
            try:
                job_id = f"ga-{ct}-{int(time.time() * 1000)}"
                job_key = f"bull:intelligence-jobs:{job_id}"
                await redis_client.hset(  # type: ignore[misc]
                    job_key,
                    mapping={
                        "id": job_id,
                        "name": _GRAPH_ANALYTICS_JOB,
                        "data": json.dumps({"contentType": ct}),
                        "opts": "{}",
                        "timestamp": str(int(time.time() * 1000)),
                    },
                )
                await redis_client.lpush(  # type: ignore[misc]
                    "bull:intelligence-jobs:waiting", job_id
                )
                logger.info("graph_analytics_triggered", content_type=ct)
            except Exception as e:
                logger.warning("graph_analytics_trigger_failed", error=str(e))

    def _stats(self, status: ContentSetStatus) -> dict[str, Any]:
        return {
            "totalPages": status.totalPages,
            "crawledPages": status.crawledPages,
            "classifiedPages": status.classifiedPages,
            "importedEntries": status.importedEntries,
            "skippedDuplicates": status.skippedDuplicates,
            "failedPages": status.failedPages,
            "errors": status.errors[:50],  # cap stored errors
        }


async def run_ingestion_pipeline_check(job_id: str) -> bool:
    """Check if a cancellation flag is set for a job. Used by the SSE endpoint."""
    client = aioredis.from_url(settings.redis_url)
    try:
        result = await client.exists(f"{_CANCEL_KEY_PREFIX}{job_id}")
        return bool(result)
    finally:
        await client.aclose()


async def set_cancellation_flag(job_id: str) -> None:
    """Set the cancellation flag for a running job in Redis."""
    client = aioredis.from_url(settings.redis_url)
    try:
        await client.set(f"{_CANCEL_KEY_PREFIX}{job_id}", "1", ex=86400)
    finally:
        await client.aclose()
