"""Content rewriting module for Rosmarium AI Worker.

Handles tone adjustments, expansion, compression, and simplification.
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Literal

import httpx
import structlog
from fastapi.responses import StreamingResponse

from ..config import settings

logger = structlog.get_logger(__name__)

_OLLAMA_TIMEOUT_S = 60.0

RewriteStyle = Literal["formal", "casual", "technical", "marketing", "expand", "compress", "simplify"]

class ContentRewriter:
    """Rewrites content based on specified style."""

    async def rewrite_stream(
        self, text: str, style: RewriteStyle
    ) -> StreamingResponse:
        """Rewrite content and stream the response."""
        prompt = self._build_prompt(text, style)
        model = settings.summarization_model

        async def event_generator() -> AsyncGenerator[str, None]:
            try:
                async with httpx.AsyncClient(timeout=_OLLAMA_TIMEOUT_S) as client:
                    async with client.stream(
                        "POST",
                        f"{settings.ollama_base_url}/api/generate",
                        json={"model": model, "prompt": prompt, "stream": True},
                    ) as response:
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if line:
                                data = json.loads(line)
                                if "response" in data:
                                    yield f"data: {json.dumps({'chunk': data['response']})}\n\n"
                                if data.get("done"):
                                    break
            except Exception as e:
                logger.error("rewrite_stream_error", error=str(e))
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            finally:
                yield "data: [DONE]\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    def _build_prompt(self, text: str, style: RewriteStyle) -> str:
        instructions = {
            "formal": "Rewrite the following text to be more formal and professional.",
            "casual": "Rewrite the following text to be more casual, friendly, and approachable.",
            "technical": "Rewrite the following text to use precise technical terminology.",
            "marketing": "Rewrite the following text to be persuasive, engaging, and sales-oriented.",
            "expand": "Expand on the following text, adding more details and context while maintaining the original meaning.",
            "compress": "Compress the following text, removing fluff and keeping only the most essential points.",
            "simplify": "Simplify the following text so that it can be easily understood by a general audience."
        }
        
        instruction = instructions.get(style, "Rewrite the following text:")
        return f"{instruction}\n\nText:\n{text}"

content_rewriter = ContentRewriter()
