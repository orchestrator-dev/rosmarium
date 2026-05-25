# Cortex CMS — Current Development Phase

## Active Phase: Phase 3 — Developer Experience & Ecosystem
**Target release:** v0.6.0+
**Duration:** Months 9–12

## Completed Phases
- ✅ Phase 1 — CMS Foundation (v0.1.0 released)
- ✅ Phase 2 — AI Layer (v0.5.0 released)

## Phase 3: Headless & API Layer

-   [x] **Month 7:** API Foundation & Caching (REST, Fastify)
-   [x] **Month 8:** GraphQL & Webhook Engine (Mercurius, background jobs)
-   [x] **Month 9:** Graph Data Model (Relations, Edge inference, Graph service)
-   [x] **Month 10:** Graph Traversal API (Multi-hop traversal, Cypher parser, GraphQL @traverse, Cytoscape Explorer)
-   [ ] **Month 11:** Multi-Tenant Architecture & Sub-organizations (Row-level security, isolated content spaces)
-   [ ] **Month 12:** Edge CDN Integration & Static Export (Vercel/Cloudflare targets, asset optimization)
-   [ ] **Month 13:** Phase 3 Hardening (Rate limiting, abuse prevention, final scale tests)

## Shipped Milestones
- ✅ Phase 1 — CMS Foundation (v0.1.0)
- ✅ Month 5 — AI Worker + Embedding Pipeline (v0.2.0)
- ✅ Month 6 — Hybrid Search: BM25 + pgvector + RRF (v0.3.0)
- ✅ Month 7 — RAG Pipeline: LlamaIndex retrieval, spaCy chunking, streaming (v0.4.0)
- ✅ Month 8 — AI Metadata Intelligence: auto-tagging, NER, summarization, duplicate detection (v0.5.0)

## Phase 2 Checklist (Complete)
- [x] cortex-ai-worker bootstrap (FastAPI, pyproject.toml, uv, Ruff, mypy)
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
- [x] AutoTagger — zero-shot classification (transformers + cross-encoder NLI model)
- [x] NERExtractor — spaCy en_core_web_sm (PERSON, ORG, GPE, DATE, PRODUCT, etc.)
- [x] ContentSummarizer — Ollama LLM with extractive fallback
- [x] DuplicateDetector — pgvector cosine similarity; full-collection scan
- [x] intelligence_worker — BullMQ 'analyse-content' job processor
- [x] Second queue consumer for intelligence-jobs
- [x] REST API: /intelligence/{tag,ner,summarize,duplicates,scan-duplicates}
- [x] intelligence.client.ts — cortex-server HTTP client
- [x] intelligence.service.ts — metadata persistence via JSONB merge
- [x] intelligence.jobs.ts — BullMQ job dispatch + queue stats
- [x] content.published → auto-dispatch intelligence jobs (opt-in via aiIntelligence setting)
- [x] Routes: POST /api/content/:type/:id/tag|summarize, GET /api/content/:type/:id/entities|duplicates
- [x] GET /api/admin/queue-stats — live BullMQ stats for all queues
- [x] AI Dashboard in cortex-admin — 4 panels: embedding coverage, tagging, duplicates, queue
- [x] DB migration 0006 — GIN index on content_entries.metadata->'ai'
- [x] 23 new Python tests + 5 new TypeScript tests, all passing
- [x] mypy clean (37 source files), tsc --noEmit clean

## Notes
Phase 1 shipped as v0.1.0. Full REST + GraphQL API, Auth + RBAC,
Asset Engine, Admin UI scaffold all complete.
Month 5 shipped — cortex-ai-worker bootstrapped with full embedding pipeline,
3 provider adapters, pgvector index manager, and BullMQ consumer.
Month 6 shipped — hybrid search delivered (BM25 + pgvector + RRF).
Month 7 shipped — RAG pipeline with spaCy chunking, LlamaIndex retrieval,
freshness scoring, Cohere rerank, and SSE streaming (v0.4.0).
Month 8 shipped — AI Metadata Intelligence complete: auto-tagging pipeline,
NER extraction, content summarization, semantic duplicate detection,
intelligence queue consumer, REST endpoints, admin AI Dashboard (v0.5.0).
Month 9 shipped — Graph Data Model complete: edges, inference (NER, similarity, refs),
REST API, graph service, Admin UI GraphPanel (v0.6.0).
Month 10 shipped — Graph Traversal API complete: multi-hop traversal, pathfinding, 
Cypher-lite DSL parser, GraphQL @traverse directive, Graph-enhanced RAG,
and Cytoscape.js Explorer in Admin UI (v0.7.0).