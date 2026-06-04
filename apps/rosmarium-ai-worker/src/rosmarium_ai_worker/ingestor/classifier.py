"""Content type classifier for the Rosmarium ingestor.

Uses an LLM (Ollama or OpenAI) to match crawled pages against existing content types.
Falls back to embedding cosine similarity when LLM confidence < 0.6.
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any

import httpx
import structlog

from ..config import settings
from ..embedding.registry import get_provider
from .models import ClassificationResult, CrawledPage

logger = structlog.get_logger(__name__)

_OLLAMA_TIMEOUT_S = 30.0
_BATCH_CONCURRENCY = 5


class ContentTypeClassifier:
    """Classifies crawled pages against existing Rosmarium content types.

    Strategy:
    1. Build prompt from content type definitions (name, displayName, fields)
    2. Send page title + first 500 chars to LLM → returns JSON with contentTypeName + confidence
    3. Fallback: if confidence < 0.6, use embedding similarity against CT descriptions
    """

    def __init__(
        self,
        content_types: list[dict[str, Any]],
        system_prompt: str | None = None,
        user_prompt: str | None = None,
        model: str | None = None,
    ) -> None:
        self._content_types = [
            ct for ct in content_types if not ct.get("isComponent", False)
        ]
        self._system_prompt = system_prompt
        self._user_prompt = user_prompt
        self._model = model
        self._ct_summary = self._build_ct_summary()

    def _build_ct_summary(self) -> str:
        lines: list[str] = []
        for ct in self._content_types:
            field_names = ", ".join(
                f["name"] for f in ct.get("fields", []) if not f.get("isComponent")
            )
            lines.append(
                f"- {ct['name']}: {ct.get('displayName', ct['name'])} "
                f"(fields: {field_names or 'none'})"
            )
        return "\n".join(lines)

    async def classify(self, page: CrawledPage) -> ClassificationResult:
        """Classify a single page against available content types."""
        if not self._content_types:
            return ClassificationResult(
                contentTypeName="article",
                confidence=0.0,
                reasoning="No content types available for classification",
                alternativeTypes=[],
            )

        sys_part = self._system_prompt or (
            "You are classifying a web page into one of these content types:\n\n"
            f"{self._ct_summary}\n\n"
        )
        usr_part = self._user_prompt or (
            "Page URL: {url}\n"
            "Page title: {title}\n"
            "Content (first 500 chars):\n{content}\n\n"
            "Respond with JSON only:\n"
            '{\n'
            '  "contentTypeName": "<exact name from list above>",\n'
            '  "confidence": <0.0-1.0>,\n'
            '  "reasoning": "<one sentence why>",\n'
            '  "alternativeTypes": ["<other possible type>"]\n'
            '}\n\n'
            "If no content type matches well, use the closest one with low confidence."
        )

        # Always use str.replace() — never .format() — because the JSON schema
        # embedded in usr_part contains literal { } braces that would confuse str.format().
        usr_part = usr_part.replace("{url}", page.url)
        usr_part = usr_part.replace("{title}", page.title or "unknown")
        usr_part = usr_part.replace("{content}", page.markdown[:500])

        prompt = f"{sys_part}\n{usr_part}"

        try:
            response_text = await self._call_llm(prompt)
            # Extract JSON from response (LLMs sometimes wrap in markdown)
            json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if not json_match:
                raise ValueError(f"No JSON found in LLM response: {response_text[:200]}")
            data = json.loads(json_match.group(0))
            result = ClassificationResult(**data)

            # Validate that contentTypeName is in our list
            known_names = {ct["name"] for ct in self._content_types}
            if result.contentTypeName not in known_names:
                logger.warning(
                    "llm_returned_unknown_type",
                    url=page.url,
                    type_name=result.contentTypeName,
                )
                result = result.model_copy(update={"confidence": 0.4})

            if result.confidence < 0.6:
                logger.debug(
                    "low_confidence_fallback",
                    url=page.url,
                    confidence=result.confidence,
                )
                return await self._fallback_embedding_classify(page, result)

            return result

        except Exception as e:
            logger.warning("classify_llm_error", url=page.url, error=str(e))
            return await self._fallback_embedding_classify(page, None)

    async def classify_batch(self, pages: list[CrawledPage]) -> list[ClassificationResult]:
        """Classify many pages with bounded concurrency."""
        semaphore = asyncio.Semaphore(_BATCH_CONCURRENCY)

        async def _bounded(page: CrawledPage) -> ClassificationResult:
            async with semaphore:
                return await self.classify(page)

        return list(await asyncio.gather(*[_bounded(p) for p in pages]))

    async def _fallback_embedding_classify(
        self,
        page: CrawledPage,
        prior: ClassificationResult | None,
    ) -> ClassificationResult:
        """Embed the page and find the closest content type by cosine similarity."""
        if not self._content_types:
            return prior or ClassificationResult(
                contentTypeName=self._content_types[0]["name"] if self._content_types else "article",
                confidence=0.0,
                reasoning="Fallback: no content types",
                alternativeTypes=[],
            )
        try:
            provider = get_provider()
            page_text = f"{page.title or ''} {page.markdown[:200]}"

            ct_descriptions = [
                f"{ct.get('displayName', ct['name'])}: {' '.join(f['name'] for f in ct.get('fields', []))}"
                for ct in self._content_types
            ]

            vectors = await provider.embed([page_text, *ct_descriptions])
            page_vec = vectors[0]
            ct_vecs = vectors[1:]

            def cosine(a: list[float], b: list[float]) -> float:
                dot = sum(x * y for x, y in zip(a, b, strict=False))
                norm_a = sum(x ** 2 for x in a) ** 0.5
                norm_b = sum(x ** 2 for x in b) ** 0.5
                return dot / (norm_a * norm_b + 1e-9)

            scores = [(cosine(page_vec, v), ct) for v, ct in zip(ct_vecs, self._content_types, strict=False)]
            scores.sort(key=lambda t: t[0], reverse=True)

            best_score, best_ct = scores[0]
            alts = [ct["name"] for _, ct in scores[1:3]]

            return ClassificationResult(
                contentTypeName=best_ct["name"],
                confidence=float(best_score),
                reasoning="Classified by embedding similarity (LLM fallback)",
                alternativeTypes=alts,
            )
        except Exception as e:
            logger.warning("fallback_embed_classify_error", error=str(e))
            # Final fallback: return prior if available, else first CT
            if prior:
                return prior
            first = self._content_types[0] if self._content_types else None
            return ClassificationResult(
                contentTypeName=first["name"] if first else "article",
                confidence=0.0,
                reasoning=f"Classification unavailable: {e}",
                alternativeTypes=[],
            )

    async def _call_llm(self, prompt: str) -> str:
        """Call the configured LLM (Ollama or OpenAI)."""
        if settings.embedding_provider == "openai" and settings.openai_api_key:
            return await self._call_openai(prompt)
        return await self._call_ollama(prompt)

    async def _call_ollama(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=_OLLAMA_TIMEOUT_S) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": self._model or settings.summarization_model,
                    "prompt": prompt,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            return str(resp.json().get("response", "")).strip()

    async def _call_openai(self, prompt: str) -> str:
        async with httpx.AsyncClient(timeout=_OLLAMA_TIMEOUT_S) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": self._model or "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return str(data["choices"][0]["message"]["content"])
