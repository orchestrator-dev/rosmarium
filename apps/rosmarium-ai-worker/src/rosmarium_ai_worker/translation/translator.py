"""Multi-provider AI translation module."""

from __future__ import annotations

import httpx
import structlog

from ..config import settings
from .glossary import glossary_manager

logger = structlog.get_logger(__name__)

_OLLAMA_TIMEOUT_S = 120.0

class AITranslator:
    """AI-powered translation considering brand glossary."""

    async def translate(self, text: str, target_language: str, tenant_id: str | None = None) -> str:
        """Translate text to the target language."""
        
        rules = glossary_manager.get_rules(tenant_id) if tenant_id else {}
        glossary_instr = ""
        if rules:
            rules_str = "\n".join(f"- '{src}' should be translated as '{tgt}'" for src, tgt in rules.items())
            glossary_instr = f"\n\nPlease adhere strictly to the following glossary rules:\n{rules_str}\n"

        prompt = (
            f"Translate the following text to {target_language}. "
            f"Maintain the original tone, formatting, and structure.{glossary_instr}\n\n"
            f"Text:\n{text}"
        )
        
        model = settings.summarization_model

        try:
            async with httpx.AsyncClient(timeout=_OLLAMA_TIMEOUT_S) as client:
                resp = await client.post(
                    f"{settings.ollama_base_url}/api/generate",
                    json={"model": model, "prompt": prompt, "stream": False},
                )
                resp.raise_for_status()
                data = resp.json()
                return str(data.get("response", "")).strip()
        except Exception as e:
            logger.error("translation_error", error=str(e), target_language=target_language)
            raise

translator = AITranslator()
