"""Content generation module for Rosmarium AI Worker.

Handles prompt-based content generation using LLMs.
Supports Server-Sent Events (SSE) streaming.
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any

import httpx
import structlog
from fastapi.responses import StreamingResponse

from ..config import settings

logger = structlog.get_logger(__name__)

_OLLAMA_TIMEOUT_S = 60.0

class ContentGenerator:
    """Generates content using configured LLM provider."""

    async def generate_stream(
        self, prompt: str, context: dict[str, Any] | None = None
    ) -> StreamingResponse:
        """Generate content from prompt and stream the response."""
        full_prompt = self._build_prompt(prompt, context)
        model = settings.summarization_model  # Reusing model config for now

        async def event_generator() -> AsyncGenerator[str, None]:
            try:
                async with httpx.AsyncClient(timeout=_OLLAMA_TIMEOUT_S) as client:
                    async with client.stream(
                        "POST",
                        f"{settings.ollama_base_url}/api/generate",
                        json={"model": model, "prompt": full_prompt, "stream": True},
                    ) as response:
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if line:
                                data = json.loads(line)
                                if "response" in data:
                                    chunk = data["response"]
                                    # SSE format
                                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                                if data.get("done"):
                                    break
            except Exception as e:
                logger.error("generation_stream_error", error=str(e))
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            finally:
                yield "data: [DONE]\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    async def generate(self, prompt: str, context: dict[str, Any] | None = None) -> str:
        """Generate content synchronously (wait for full response)."""
        full_prompt = self._build_prompt(prompt, context)
        model = settings.summarization_model

        try:
            async with httpx.AsyncClient(timeout=_OLLAMA_TIMEOUT_S) as client:
                resp = await client.post(
                    f"{settings.ollama_base_url}/api/generate",
                    json={"model": model, "prompt": full_prompt, "stream": False},
                )
                resp.raise_for_status()
                data = resp.json()
                return str(data.get("response", "")).strip()
        except Exception as e:
            logger.error("generation_error", error=str(e))
            raise

    def _build_prompt(self, prompt: str, context: dict[str, Any] | None) -> str:
        if not context:
            return prompt
        
        ctx_str = json.dumps(context, indent=2)
        return f"Context information:\n{ctx_str}\n\nTask:\n{prompt}"

content_generator = ContentGenerator()
