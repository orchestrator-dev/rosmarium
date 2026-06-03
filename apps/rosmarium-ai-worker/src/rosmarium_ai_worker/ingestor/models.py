"""Pydantic v2 models for the Rosmarium Content Ingestor pipeline."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class IngestorConfig(BaseModel):
    """Full configuration for a single crawl-and-import job."""

    startUrl: str
    maxDepth: int = Field(default=3, ge=1, le=5)
    maxPages: int = Field(default=500, ge=1, le=500)
    includePatterns: list[str] = []
    excludePatterns: list[str] = []
    targetContentType: str | None = None
    respectRobotsTxt: bool = True
    importAs: Literal["draft", "published"] = "draft"
    tenantId: str | None = None
    contentSetName: str
    apiKey: str
    apiBaseUrl: str = "http://localhost:3000"
    duplicateThreshold: float = Field(default=0.92, ge=0.0, le=1.0)


class CrawledPage(BaseModel):
    """Output of the crawler for a single URL."""

    url: str
    title: str | None
    markdown: str
    html: str
    metadata: dict[str, Any] = {}
    language: str | None
    contentType: str | None
    crawledAt: datetime
    depth: int


class ClassificationResult(BaseModel):
    """LLM-matched content type for a crawled page."""

    contentTypeName: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str
    alternativeTypes: list[str] = []


class MappedEntry(BaseModel):
    """Structured field dict extracted from a crawled page."""

    contentTypeName: str
    fields: dict[str, Any]
    confidence: float
    sourceUrl: str
    sourceTitle: str | None
    isDuplicate: bool
    duplicateEntryId: str | None
    duplicateScore: float | None


class IngestionResult(BaseModel):
    """Per-page import outcome."""

    entryId: str | None
    sourceUrl: str
    contentType: str
    status: Literal["created", "skipped_duplicate", "failed"]
    errorMessage: str | None = None


class ContentSetStatus(BaseModel):
    """Live progress snapshot for SSE streaming."""

    jobId: str
    contentSetId: str | None = None
    contentSetName: str
    startUrl: str
    status: Literal[
        "queued",
        "crawling",
        "classifying",
        "importing",
        "complete",
        "failed",
        "cancelled",
    ]
    totalPages: int = 0
    crawledPages: int = 0
    classifiedPages: int = 0
    importedEntries: int = 0
    skippedDuplicates: int = 0
    failedPages: int = 0
    startedAt: datetime | None = None
    completedAt: datetime | None = None
    errors: list[str] = []
    recentResults: list[IngestionResult] = []
