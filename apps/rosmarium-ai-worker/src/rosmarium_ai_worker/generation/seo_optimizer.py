"""SEO Optimization module for Rosmarium AI Worker.

Generates SEO titles, meta descriptions, and alt text using LLMs.
"""

from __future__ import annotations

import json

import httpx
import structlog
from pydantic import BaseModel

from ..config import settings

logger = structlog.get_logger(__name__)

_OLLAMA_TIMEOUT_S = 60.0

class SEOResult(BaseModel):
    title: str
    meta_description: str
    headings: list[str]

class SEOOptimizer:
    """Generates SEO metadata based on content."""

    async def optimize(self, text: str, focus_keyword: str | None = None) -> SEOResult:
        """Generate SEO title, meta description, and headings for the content."""
        prompt = self._build_prompt(text, focus_keyword)
        model = settings.summarization_model

        try:
            async with httpx.AsyncClient(timeout=_OLLAMA_TIMEOUT_S) as client:
                resp = await client.post(
                    f"{settings.ollama_base_url}/api/generate",
                    json={
                        "model": model, 
                        "prompt": prompt, 
                        "stream": False,
                        "format": "json"
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                
                try:
                    result = json.loads(data.get("response", "{}"))
                    return SEOResult(
                        title=result.get("title", ""),
                        meta_description=result.get("meta_description", ""),
                        headings=result.get("headings", [])
                    )
                except json.JSONDecodeError:
                    logger.error("seo_json_decode_error", response=data.get("response"))
                    return SEOResult(title="", meta_description="", headings=[])
                    
        except Exception as e:
            logger.error("seo_optimization_error", error=str(e))
            raise

    async def generate_alt_text(self, context: str) -> str:
        """Generate alt text based on surrounding context (or image description).
        
        Currently a text-only stub, assumes context is a description of the image.
        For true multimodal, we would pass base64 image data.
        """
        prompt = f"Write a concise, descriptive alt text (max 125 characters) for an image described as or appearing in the following context:\n\n{context}"
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
            logger.error("alt_text_generation_error", error=str(e))
            raise

    def _build_prompt(self, text: str, focus_keyword: str | None) -> str:
        keyword_instr = f" The focus keyword is '{focus_keyword}'." if focus_keyword else ""
        return (
            "Analyze the following text and generate SEO metadata. "
            "Respond ONLY with a valid JSON object containing exactly these keys: "
            "'title' (string, max 60 chars), 'meta_description' (string, max 160 chars), "
            f"and 'headings' (array of strings for H2/H3 suggestions).{keyword_instr}\n\n"
            f"Text:\n{text[:3000]}"
        )

seo_optimizer = SEOOptimizer()
