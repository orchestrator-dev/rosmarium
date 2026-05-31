"""Translation REST endpoints."""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .intelligence import require_worker_secret
from ...translation.translator import translator
from ...translation.glossary import glossary_manager

logger = structlog.get_logger(__name__)
router = APIRouter()

class TranslateRequest(BaseModel):
    text: str
    targetLanguage: str
    tenantId: str | None = None

class GlossaryAddRequest(BaseModel):
    source: str
    target: str

@router.post("/translate", dependencies=[Depends(require_worker_secret)])
async def translate_text(request: TranslateRequest):
    result = await translator.translate(request.text, request.targetLanguage, request.tenantId)
    return {"result": result}

@router.post("/glossary/{tenant_id}", dependencies=[Depends(require_worker_secret)])
async def add_glossary_term(tenant_id: str, request: GlossaryAddRequest):
    glossary_manager.add_term(tenant_id, request.source, request.target)
    return {"status": "ok"}
