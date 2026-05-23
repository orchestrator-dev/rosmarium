# Rosmarium CMS — Current Development Phase

## Active Phase: Phase 2 — AI Layer
**Target release:** v0.2.0
**Duration:** Months 5–8

## Completed Phases
- ✅ Phase 1 — CMS Foundation (v0.1.0 released)

## Active Milestone
Month 8 — LLM Integration & Completions 🚧

## Shipped Milestones
- ✅ Phase 1 — CMS Foundation (v0.1.0)
- ✅ Month 5 — AI Worker + Embedding Pipeline (v0.2.0)
- ✅ Month 6 — Hybrid Search: BM25 + pgvector + RRF (v0.3.0)
- ✅ Month 7 — RAG Pipeline: LlamaIndex retrieval, spaCy chunking, streaming (v0.4.0)

## Checklist
- [x] rosmarium-ai-worker bootstrap (FastAPI, pyproject.toml, uv, Ruff, mypy)
- [x] Pydantic Settings config with all env vars
- [x] asyncpg connection pool (shared PostgreSQL)
- [x] BullMQ Redis queue consumer
- [x] EmbeddingProvider abstract base class
- [x] Ollama adapter (local, default for dev)
- [x] OpenAI adapter (production option)
- [x] Cohere adapter
- [x] pgvector index manager (ensure_table, upsert, delete, search)
- [x] embedding_worker job processor
- [x] Docker service added to compose.yml
- [x] GET /health + GET /ready endpoints
- [x] All tests passing, mypy clean
- [x] POST /search/embed — query-time embedding endpoint (ai-worker)
- [x] POST /search/embed-batch — batch embedding for backfill (ai-worker)
- [x] search_vector tsvector generated column + GIN index (migration 0004)
- [x] BM25 fulltext search module (fulltextSearch)
- [x] pgvector cosine search module (vectorSearch)
- [x] Reciprocal Rank Fusion algorithm (rrf.ts)
- [x] AI worker HTTP client with graceful fallback (ai-worker.client.ts)
- [x] Search service orchestrator (search.service.ts)
- [x] GET /api/search + GET /api/search/suggest REST endpoints
- [x] Admin UI search bar with autocomplete + alpha slider
- [x] spaCy sentencizer chunker (SentenceChunker) replacing regex _simple_chunk
- [x] SectionChunker — markdown/HTML heading-aware chunking
- [x] FixedSizeChunker — backwards-compatible adapter
- [x] get_chunker() factory wired into embedding_worker
- [x] RAGPipeline — parallel multi-type retrieval, RBAC filtering, freshness scoring
- [x] Cohere rerank (optional, graceful fallback)
- [x] ContextFormatter — token-budgeted LLM context string + JSON format
- [x] POST /rag/retrieve (worker, JSON) + POST /rag/retrieve/stream (worker, SSE)
- [x] POST /api/rag/retrieve (server, 3 formats) + SSE stream
- [x] RBAC-aware retrieval (CONTENT_READ_ANY vs CONTENT_READ_OWN)
- [x] Content entry enrichment (single DB round-trip)
- [x] DB migration 0005 — content_entries_created_by_idx
- [x] All unit tests passing (45 new tests, 33 Python + 12 TypeScript)
- [x] pnpm typecheck clean, mypy clean

## Notes
Phase 1 shipped as v0.1.0. Full REST + GraphQL API, Auth + RBAC,
Asset Engine, Admin UI scaffold all complete.
Month 5 shipped — rosmarium-ai-worker bootstrapped with full embedding pipeline,
3 provider adapters, pgvector index manager, and BullMQ consumer.
Month 6 shipped — hybrid search delivered (BM25 + pgvector + RRF).
Month 7 shipped — RAG pipeline with spaCy chunking, LlamaIndex retrieval,
freshness scoring, Cohere rerank, and SSE streaming (v0.4.0).