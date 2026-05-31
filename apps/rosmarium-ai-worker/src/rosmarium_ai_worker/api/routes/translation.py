"""Translation REST endpoints."""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ...translation.glossary import glossary_manager
from ...translation.translator import translator
from .intelligence import require_worker_secret

logger = structlog.get_logger(__name__)
router = APIRouter()

class TranslateRequest(BaseModel):
    text: str
    target_language: str = Field(alias="targetLanguage")
    tenant_id: str | None = Field(default=None, alias="tenantId")

class GlossaryAddRequest(BaseModel):
    source: str
    target: str

@router.post("/translate", dependencies=[Depends(require_worker_secret)])
async def translate_text(request: TranslateRequest) -> Any:
    result = await translator.translate(request.text, request.target_language, request.tenant_id)
    return {"result": result}

@router.post("/glossary/{tenant_id}", dependencies=[Depends(require_worker_secret)])
async def add_glossary_term(tenant_id: str, request: GlossaryAddRequest) -> Any:
    glossary_manager.add_term(tenant_id, request.source, request.target)
    return {"status": "ok"}
