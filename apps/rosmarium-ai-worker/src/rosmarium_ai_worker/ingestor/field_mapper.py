"""Field mapper for the Rosmarium ingestor.

Extracts structured field values from a crawled page based on a content type's
field definitions. Uses deterministic extraction first; falls back to LLM for
complex or unrecognised fields.
"""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlparse

import httpx
import structlog

from ..config import settings
from .models import ClassificationResult, CrawledPage, MappedEntry

logger = structlog.get_logger(__name__)

_OLLAMA_TIMEOUT_S = 30.0


def _slug_from_url(url: str) -> str:
    """Extract the last path segment as a slug."""
    path = urlparse(url).path.rstrip("/")
    segment = path.split("/")[-1] if path else ""
    # Normalise: lowercase, replace non-alphanumeric with hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", segment.lower()).strip("-")
    return slug or "imported-page"


def _first_paragraph(markdown: str) -> str:
    """Return the first non-heading paragraph from markdown."""
    for line in markdown.split("\n"):
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and not stripped.startswith("!"):
            return stripped[:300]
    return ""


def _extract_date(metadata: dict[str, Any]) -> str | None:
    """Try to extract a publish date from og: or URL pattern."""
    for key in ("og_published_time", "og_article:published_time", "article:published_time"):
        if key in metadata:
            return str(metadata[key])
    return None


class FieldMapper:
    """Extracts field values from a crawled page based on a content type definition.

    Deterministic extraction covers: title, slug, body/richText, summary,
    date, author, url/source.
    LLM extraction is used for remaining fields that cannot be mapped
    deterministically (batched in one prompt).
    """
    def __init__(
        self,
        system_prompt: str | None = None,
        user_prompt: str | None = None,
        model: str | None = None,
    ) -> None:
        self._system_prompt = system_prompt
        self._user_prompt = user_prompt
        self._model = model
    async def map(
        self,
        page: CrawledPage,
        content_type: dict[str, Any],
        classification: ClassificationResult,
        api_base_url: str = "http://localhost:3000",
        api_key: str = "",
    ) -> MappedEntry:
        """Map a crawled page to a content type's fields."""
        fields_def: list[dict[str, Any]] = content_type.get("fields", [])
        extracted: dict[str, Any] = {}
        needs_llm: list[dict[str, Any]] = []

        # ── Deterministic extraction ──────────────────────────────────────────
        for field in fields_def:
            fname = field["name"]
            ftype = field.get("type", "text")

            if ftype == "slug":
                extracted[fname] = _slug_from_url(page.url)

            elif ftype in ("text", "textarea") and self._looks_like_title(fname):
                extracted[fname] = (
                    page.metadata.get("og_title")
                    or page.title
                    or fname
                )

            elif ftype == "richtext":
                extracted[fname] = page.markdown

            elif ftype in ("text", "textarea") and self._looks_like_summary(fname):
                extracted[fname] = (
                    page.metadata.get("description")
                    or page.metadata.get("og_description")
                    or _first_paragraph(page.markdown)
                )

            elif ftype in ("date", "datetime"):
                extracted[fname] = _extract_date(page.metadata)

            elif ftype == "url" and self._looks_like_source(fname):
                extracted[fname] = page.url

            elif ftype in ("text", "textarea", "number", "boolean", "select"):
                # Queue for LLM extraction if we haven't mapped it
                if fname not in extracted:
                    needs_llm.append(field)

        # ── LLM extraction for remaining fields ───────────────────────────────
        if needs_llm:
            llm_values = await self._llm_extract_fields(page, needs_llm)
            extracted.update(llm_values)

        # ── Required field safety net ─────────────────────────────────────────
        for field in fields_def:
            fname = field["name"]
            ftype = field.get("type", "text")
            is_required = field.get("required", False)
            if is_required and (fname not in extracted or extracted[fname] is None):
                if ftype == "richtext":
                    extracted[fname] = page.markdown
                else:
                    extracted[fname] = (
                        page.metadata.get("og_title") or page.title or ""
                    )
                logger.warning(
                    "required_field_fallback",
                    field=fname,
                    url=page.url,
                    content_type=content_type.get("name"),
                )

        # ── Slug conflict resolution ──────────────────────────────────────────
        slug_field = next(
            (f for f in fields_def if f.get("type") == "slug"), None
        )
        if slug_field and slug_field["name"] in extracted:
            base_slug = str(extracted[slug_field["name"]])
            final_slug = await self._resolve_slug(
                base_slug,
                content_type["name"],
                api_base_url,
                api_key,
            )
            extracted[slug_field["name"]] = final_slug

        return MappedEntry(
            contentTypeName=content_type["name"],
            fields=extracted,
            confidence=classification.confidence,
            sourceUrl=page.url,
            sourceTitle=page.title,
            isDuplicate=False,
            duplicateEntryId=None,
            duplicateScore=None,
        )

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _looks_like_title(self, name: str) -> bool:
        return name.lower() in ("title", "name", "heading", "headline")

    def _looks_like_summary(self, name: str) -> bool:
        return name.lower() in (
            "summary", "excerpt", "description", "intro", "lead", "abstract"
        )

    def _looks_like_source(self, name: str) -> bool:
        return name.lower() in ("url", "source", "sourceurl", "link", "canonical")

    async def _llm_extract_fields(
        self,
        page: CrawledPage,
        fields: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Use one LLM call to extract values for multiple fields."""
        field_specs = "\n".join(
            f"- \"{f['name']}\" ({f.get('type', 'text')}): "
            f"{f.get('description', 'no description')}"
            for f in fields
        )

        sys_part = self._system_prompt or "Extract the following fields from this web page content."
        usr_part = self._user_prompt or (
            "Fields to extract:\n{field_specs}\n\n"
            "Page URL: {url}\n"
            "Page title: {title}\n"
            "Content:\n{content}\n\n"
            "Respond with JSON only, mapping field names to extracted values.\n"
            "Use null for fields you cannot find.\n"
            "Example: {\"author\": \"Jane Smith\", \"category\": \"Technology\"}"
        )

        # Always use str.replace() — the template may contain JSON examples with { } that break str.format()
        usr_part = usr_part.replace("{field_specs}", field_specs)
        usr_part = usr_part.replace("{url}", page.url)
        usr_part = usr_part.replace("{title}", page.title or "unknown")
        usr_part = usr_part.replace("{content}", page.markdown[:1000])

        prompt = f"{sys_part}\n\n{usr_part}"

        try:
            if settings.embedding_provider == "openai" and settings.openai_api_key:
                response = await self._call_openai(prompt)
            else:
                response = await self._call_ollama(prompt)

            json_match = re.search(r"\{.*\}", response, re.DOTALL)
            if json_match:
                return dict(json.loads(json_match.group(0)))
        except Exception as e:
            logger.warning("llm_field_extraction_error", error=str(e), url=page.url)

        return {}

    async def _resolve_slug(
        self,
        base_slug: str,
        content_type_name: str,
        api_base_url: str,
        api_key: str,
    ) -> str:
        """Check for slug conflicts and append -2, -3 etc. if needed."""
        headers = {"Authorization": f"Bearer {api_key}"}
        candidate = base_slug
        suffix = 1

        async with httpx.AsyncClient(timeout=10.0) as client:
            while True:
                try:
                    url = (
                        f"{api_base_url}/api/content/{content_type_name}"
                        f"?filters[slug][eq]={candidate}&limit=1"
                    )
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        if not data.get("data") or len(data["data"]) == 0:
                            return candidate
                        # Conflict — try next suffix
                        suffix += 1
                        candidate = f"{base_slug}-{suffix}"
                    else:
                        return candidate
                except Exception:
                    return candidate

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
            return str(resp.json()["choices"][0]["message"]["content"])
