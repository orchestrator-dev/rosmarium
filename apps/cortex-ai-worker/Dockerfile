# syntax=docker/dockerfile:1
# Cortex AI Worker — multi-stage build

FROM python:3.12-slim AS base
WORKDIR /app
RUN pip install --no-cache-dir uv

FROM base AS deps
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --extra embeddings --extra rag
RUN uv run python -m spacy download en_core_web_sm

FROM deps AS production
COPY src/ ./src/
ENV PYTHONPATH=/app/src
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8001
CMD ["uvicorn", "cortex_ai_worker.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8001", \
     "--workers", "1"]
