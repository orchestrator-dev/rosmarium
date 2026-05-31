"""Generation REST endpoints."""

from __future__ import annotations

from typing import Any, Literal

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ...generation.generator import content_generator
from ...generation.rewriter import content_rewriter
from ...generation.seo_optimizer import SEOResult, seo_optimizer
from .intelligence import require_worker_secret

logger = structlog.get_logger(__name__)
router = APIRouter()

class GenerateRequest(BaseModel):
    prompt: str
    context: dict[str, Any] | None = None
    stream: bool = False

class RewriteRequest(BaseModel):
    text: str
    style: Literal["formal", "casual", "technical", "marketing", "expand", "compress", "simplify"]
    stream: bool = False

class SEORequest(BaseModel):
    text: str
    focus_keyword: str | None = Field(default=None, alias="focusKeyword")

class AltTextRequest(BaseModel):
    context: str

@router.post("/generate", dependencies=[Depends(require_worker_secret)])
async def generate_content(request: GenerateRequest) -> Any:
    if request.stream:
        return await content_generator.generate_stream(request.prompt, request.context)
    return {"result": await content_generator.generate(request.prompt, request.context)}

@router.post("/rewrite", dependencies=[Depends(require_worker_secret)])
async def rewrite_content(request: RewriteRequest) -> Any:
    # Always stream for simplicity, Fastify can collect or stream it
    return await content_rewriter.rewrite_stream(request.text, request.style)

@router.post("/seo-optimize", dependencies=[Depends(require_worker_secret)])
async def optimize_seo(request: SEORequest) -> SEOResult:
    return await seo_optimizer.optimize(request.text, request.focus_keyword)

@router.post("/alt-text", dependencies=[Depends(require_worker_secret)])
async def generate_alt_text(request: AltTextRequest) -> Any:
    return {"altText": await seo_optimizer.generate_alt_text(request.context)}
