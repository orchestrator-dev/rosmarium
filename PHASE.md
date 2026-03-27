# Rosmarium CMS — Current Development Phase

## Active Phase: Phase 2 — AI Layer
**Target release:** v0.2.0
**Duration:** Months 5–8

## Completed Phases
- ✅ Phase 1 — CMS Foundation (v0.1.0 released)

## Active Milestone
Month 5 — Python AI Worker Foundation + Embedding Pipeline

## Checklist
- [ ] rosmarium-ai-worker bootstrap (FastAPI, pyproject.toml, uv, Ruff, mypy)
- [ ] Pydantic Settings config with all env vars
- [ ] asyncpg connection pool (shared PostgreSQL)
- [ ] BullMQ Redis queue consumer
- [ ] EmbeddingProvider abstract base class
- [ ] Ollama adapter (local, default for dev)
- [ ] OpenAI adapter (production option)
- [ ] Cohere adapter
- [ ] pgvector index manager (ensure_table, upsert, delete, search)
- [ ] embedding_worker job processor
- [ ] Docker service added to compose.yml
- [ ] GET /health + GET /ready endpoints
- [ ] All tests passing, mypy clean

## Notes
Phase 1 shipped as v0.1.0. Full REST + GraphQL API, Auth + RBAC,
Asset Engine, Admin UI scaffold all complete.