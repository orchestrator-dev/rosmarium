"""Intelligence REST endpoints — on-demand AI analysis.

All routes require X-Worker-Secret header authentication.

Routes:
  POST /intelligence/tag            — zero-shot auto-tagging
  POST /intelligence/ner            — named entity extraction
  POST /intelligence/summarize      — LLM content summarization
  POST /intelligence/duplicates     — find duplicates for an entry
  POST /intelligence/scan-duplicates — full-collection duplicate scan
"""

from __future__ import annotations

import time

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ...config import settings
from ...database import get_pool
from ...intelligence.duplicate_detector import DuplicateCandidate, duplicate_detector
from ...intelligence.ner import ner_extractor
from ...intelligence.summarizer import SummaryResult, content_summarizer
from ...intelligence.tagger import TagResult, auto_tagger

logger = structlog.get_logger(__name__)
router = APIRouter()

# ─── Auth dependency ───────────────────────────────────────────────────────────

_WORKER_SECRET_HEADER = "x-worker-secret"  # noqa: S105


async def require_worker_secret(
    x_worker_secret: str | None = Header(default=None, alias=_WORKER_SECRET_HEADER),
) -> None:
    """Validate X-Worker-Secret header."""
    if x_worker_secret is None or x_worker_secret != settings.worker_secret:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Worker-Secret")


# ─── Request/Response models ───────────────────────────────────────────────────


class TagRequest(BaseModel):
    text: str
    candidateLabels: list[str]
    threshold: float = 0.3


class TagResponse(BaseModel):
    tags: list[TagResult]
    model: str
    latencyMs: int


class NERRequest(BaseModel):
    text: str


class NERResponse(BaseModel):
    entities: dict[str, list[str]]
    count: int
    latencyMs: int


class SummarizeRequest(BaseModel):
    text: str
    maxWords: int = 100
    style: str = "brief"


class DuplicatesRequest(BaseModel):
    entryId: str
    contentType: str


class DuplicatesResponse(BaseModel):
    candidates: list[DuplicateCandidate]
    scannedCount: int
    latencyMs: int


class ScanDuplicatesRequest(BaseModel):
    contentType: str


class DuplicatePair(BaseModel):
    entryIdA: str
    entryIdB: str
    score: float


class ScanDuplicatesResponse(BaseModel):
    pairs: list[DuplicatePair]
    total: int


class ModelsResponse(BaseModel):
    data: list[str]
    recommended: str

# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get(
    "/models",
    response_model=ModelsResponse,
    dependencies=[Depends(require_worker_secret)],
    summary="List available AI models",
)
async def list_models() -> ModelsResponse:
    """Return a list of available models for classification based on config."""
    try:
        import torch
        vram_gb = 0
        if torch.cuda.is_available():
            vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)

        if vram_gb > 16:
            models = ["llama3:8b", "mistral", "gpt-4o", "claude-3-sonnet", "local-fallback"]
            recommended = "llama3:8b"
        elif vram_gb > 8:
            models = ["llama3:8b", "gpt-4o-mini", "claude-3-haiku", "local-fallback"]
            recommended = "gpt-4o-mini"
        else:
            models = ["local-fallback", "gpt-4o-mini"]
            recommended = "local-fallback"
    except Exception:
        models = ["local-fallback", "gpt-4o-mini", "llama3:8b"]
        recommended = "local-fallback"

    return ModelsResponse(data=models, recommended=recommended)


@router.post(
    "/tag",
    response_model=TagResponse,
    dependencies=[Depends(require_worker_secret)],
    summary="Zero-shot auto-tagging",
)
async def tag_content(request: TagRequest) -> TagResponse:
    """Run zero-shot classification against the provided candidate labels."""
    start = time.monotonic()
    tags = await auto_tagger.tag_async(
        request.text, request.candidateLabels, request.threshold
    )
    latency_ms = int((time.monotonic() - start) * 1000)
    return TagResponse(tags=tags, model=settings.tagging_model, latencyMs=latency_ms)


@router.post(
    "/ner",
    response_model=NERResponse,
    dependencies=[Depends(require_worker_secret)],
    summary="Named entity recognition",
)
async def extract_entities(request: NERRequest) -> NERResponse:
    """Extract named entities from text using spaCy."""
    start = time.monotonic()
    entities = await ner_extractor.extract_async(request.text)
    grouped = ner_extractor.to_dict(entities)
    latency_ms = int((time.monotonic() - start) * 1000)
    return NERResponse(
        entities=grouped,
        count=len(entities),
        latencyMs=latency_ms,
    )


@router.post(
    "/summarize",
    response_model=SummaryResult,
    dependencies=[Depends(require_worker_secret)],
    summary="Content summarization",
)
async def summarize_content(request: SummarizeRequest) -> SummaryResult:
    """Summarize content using Ollama LLM or extractive fallback."""
    from typing import Literal

    valid_styles: tuple[str, ...] = ("brief", "detailed", "bullet")
    style: Literal["brief", "detailed", "bullet"] = (
        request.style if request.style in valid_styles else "brief"  # type: ignore[assignment]
    )
    return await content_summarizer.summarize(request.text, request.maxWords, style)


@router.post(
    "/duplicates",
    response_model=DuplicatesResponse,
    dependencies=[Depends(require_worker_secret)],
    summary="Find duplicate entries",
)
async def find_duplicates(request: DuplicatesRequest) -> DuplicatesResponse:
    """Find entries similar to the specified entry using pgvector cosine similarity."""
    start = time.monotonic()

    pool = await get_pool()
    async with pool.acquire() as conn:
        table = f"rosmarium_{request.contentType}_embeddings"
        try:
            row = await conn.fetchrow(
                f"SELECT embedding FROM {table} WHERE content_entry_id = $1 LIMIT 1",
                request.entryId,
            )
        except Exception:
            row = None

        if not row:
            return DuplicatesResponse(candidates=[], scannedCount=0, latencyMs=0)

        embedding = list(row["embedding"])
        candidates = await duplicate_detector.find_duplicates(
            request.entryId, request.contentType, embedding, conn
        )

        # Count total entries scanned
        try:
            count_row = await conn.fetchrow(
                f"SELECT COUNT(DISTINCT content_entry_id) AS cnt FROM {table}"
            )
            scanned = int(count_row["cnt"]) if count_row else 0
        except Exception:
            scanned = 0

    latency_ms = int((time.monotonic() - start) * 1000)
    return DuplicatesResponse(
        candidates=candidates, scannedCount=scanned, latencyMs=latency_ms
    )


@router.post(
    "/scan-duplicates",
    response_model=ScanDuplicatesResponse,
    dependencies=[Depends(require_worker_secret)],
    summary="Full collection duplicate scan",
)
async def scan_duplicates(request: ScanDuplicatesRequest) -> ScanDuplicatesResponse:
    """Run a full collection scan to find all duplicate pairs above threshold.

    Note: This can be slow on large collections.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        pairs = await duplicate_detector.scan_collection(request.contentType, conn)

    return ScanDuplicatesResponse(
        pairs=[
            DuplicatePair(entryIdA=a, entryIdB=b, score=score)
            for a, b, score in pairs
        ],
        total=len(pairs),
    )
