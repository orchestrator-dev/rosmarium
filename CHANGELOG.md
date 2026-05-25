# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-05-25

### Added
- **rosmarium-server**: Multi-hop graph traversal engine with PostgreSQL recursive CTEs.
- **rosmarium-server**: Traversal REST endpoints (`/api/graph/traverse`, `/api/graph/neighbors`, `/api/graph/path`, `/api/graph/recommend`).
- **rosmarium-server**: Cypher-lite DSL parser to convert Cypher patterns to parameterized SQL.
- **rosmarium-server**: GraphQL `@traverse` directive for content entry schemas.
- **rosmarium-ai-worker**: Semantic graph recommendation integration combining structural and semantic scores.

## [0.5.0] - 2026-05-23

### Added

- **rosmarium-ai-worker**: `AutoTagger` — HuggingFace zero-shot text classification using cross-encoder NLI models; label taxonomy configurable per content type; CPU-only inference with lazy model loading
- **rosmarium-ai-worker**: `NERExtractor` — spaCy `en_core_web_sm` named entity extraction (PERSON, ORG, GPE, DATE, PRODUCT, EVENT, WORK_OF_ART, LAW); lazy model load on first use; per-entity deduplication
- **rosmarium-ai-worker**: `ContentSummarizer` — Ollama LLM summarization with `brief`, `detailed`, and `bullet` styles; extractive sentence-scoring fallback when Ollama is unavailable
- **rosmarium-ai-worker**: `DuplicateDetector` — pgvector cosine similarity for per-entry and full-collection duplicate scanning; configurable threshold; batch processing to avoid memory pressure
- **rosmarium-ai-worker**: `intelligence_worker` — BullMQ `analyse-content` job processor; runs all four operations independently with fault isolation; persists results to `content_entries.metadata->'ai'` via JSONB merge
- **rosmarium-ai-worker**: Second `QueueConsumer` for the `intelligence-jobs` BullMQ queue
- **rosmarium-ai-worker**: FastAPI routes: `POST /intelligence/tag`, `POST /intelligence/ner`, `POST /intelligence/summarize`, `POST /intelligence/find-duplicates`, `GET /intelligence/scan-duplicates/{type}`
- **rosmarium-ai-worker**: New config vars: `TAGGING_MODEL`, `SUMMARIZATION_MODEL`, `DUPLICATE_THRESHOLD`
- **rosmarium-server**: `intelligence.client.ts` — HTTP client for rosmarium-ai-worker intelligence endpoints with `X-Worker-Secret` auth
- **rosmarium-server**: `intelligence.service.ts` — on-demand intelligence orchestration with JSONB metadata persistence via raw SQL merge
- **rosmarium-server**: `intelligence.jobs.ts` — BullMQ `analyse-content` job dispatch and queue statistics for all queues
- **rosmarium-server**: REST routes: `POST /api/content/:type/:id/tag`, `POST /api/content/:type/:id/summarize`, `GET /api/content/:type/:id/entities`, `GET /api/content/:type/duplicates`
- **rosmarium-server**: `GET /api/admin/queue-stats` — live BullMQ statistics for embedding-jobs, intelligence-jobs, webhook-deliveries (admin role only)
- **rosmarium-server**: Automatic intelligence job dispatch on `content.published` event when `contentType.settings.aiIntelligence.enabled = true`
- **rosmarium-admin**: AI Dashboard with 4 panels — Embedding Coverage, Auto-tagging Taxonomy, Duplicate Detection scanner, Intelligence Queue live stats (auto-refreshes every 5s)
- **rosmarium-admin**: Tab navigation between Search and AI views
- **DB**: Migration `0006_ai_metadata_gin_index` — GIN index on `content_entries.metadata->'ai'` for fast AI result queries

### Changed

- **rosmarium-ai-worker**: `NERExtractor` now loads `en_core_web_sm` lazily on first call (was at instantiation time)
- **rosmarium-server**: `.env.example` updated with `TAGGING_MODEL`, `SUMMARIZATION_MODEL`, `DUPLICATE_THRESHOLD`

### Tests

- 23 new Python tests: `test_tagger.py`, `test_summarizer.py` (updated), `test_duplicate_detector.py`, `test_intelligence_worker.py`
- 5 new TypeScript tests in `intelligence.service.test.ts`
- NER tests auto-skip when `en_core_web_sm` not installed locally
- All 79 Python tests passing (7 skipped); all 143 TypeScript tests passing
- `mypy src/ --ignore-missing-imports` clean; `tsc --noEmit` clean


### Added

- **rosmarium-server**: Unified `GET /api/search` endpoint — hybrid BM25 + pgvector search with Reciprocal Rank Fusion (RRF)
- **rosmarium-server**: `GET /api/search/suggest` — debounced prefix autocomplete for search input
- **rosmarium-server**: `fulltextSearch` module — PostgreSQL tsvector / `plainto_tsquery` with `ts_rank_cd` scoring and `ts_headline` snippet extraction
- **rosmarium-server**: `vectorSearch` module — pgvector cosine similarity search (`<=>` operator); gracefully returns `[]` when the `rosmarium_{type}_embeddings` table does not yet exist (`42P01` error)
- **rosmarium-server**: `reciprocalRankFusion` — pure RRF algorithm with configurable `alpha` (0 = fulltext only, 1 = vector only, 0.5 = balanced) and `k` constant; handles multi-chunk deduplication
- **rosmarium-server**: `aiWorkerClient` — internal HTTP client to rosmarium-ai-worker with 5 s `AbortController` timeout and `SearchEmbeddingError` for graceful degradation; never logs query text (PII)
- **rosmarium-server**: Graceful fallback — search works fulltext-only when rosmarium-ai-worker is unreachable
- **rosmarium-server**: Database migration `0004_hybrid_search_vector` — `search_vector tsvector GENERATED ALWAYS AS` column covering `title`, `body`, `description` JSONB fields, plus GIN index on `content_entries`
- **rosmarium-server**: RBAC filtering applied to search results before fusion — draft entries invisible to viewers
- **rosmarium-ai-worker**: `POST /search/embed` — sync query-time embedding endpoint with `X-Worker-Secret` header auth; never logs query text
- **rosmarium-ai-worker**: `POST /search/embed-batch` — batch embedding endpoint (max 500 texts per call) for backfill operations
- **rosmarium-ai-worker**: `embed_one_with_input_type()` and `embed_batch_with_input_type()` added to `EmbeddingProvider` base class; Cohere provider overrides to forward `search_query` vs `search_document` input type to the API
- **rosmarium-admin**: Standalone search demo UI — debounced autocomplete dropdown, result cards with match-type badges (`hybrid` / `fulltext` / `vector`), RRF score bars, `ts_headline` snippet display, alpha slider for keyword↔semantic balance, and AI-worker-offline notice

### Changed

- **rosmarium-ai-worker**: `CohereEmbeddingProvider` now overrides `embed_one_with_input_type()` and `embed_batch_with_input_type()` to pass the Cohere-specific `input_type` parameter through correctly

### Fixed

- **rosmarium-ai-worker**: Ruff S105 false-positive on HTTP header name constant suppressed with `noqa: S105`

## [0.2.0] - 2026-03-27

### Added
- **rosmarium-ai-worker**: Full service bootstrap — FastAPI app factory with lifespan management
- **rosmarium-ai-worker**: Pydantic Settings configuration with env var loading
- **rosmarium-ai-worker**: asyncpg connection pool with FastAPI dependency injection
- **rosmarium-ai-worker**: Embedding providers — Ollama, OpenAI, and Cohere with abstract base class
- **rosmarium-ai-worker**: pgvector index manager with HNSW indexing (m=16, ef_construction=64)
- **rosmarium-ai-worker**: BullMQ-compatible Redis queue consumer for async job processing
- **rosmarium-ai-worker**: Embedding worker with sentence-boundary chunking
- **rosmarium-ai-worker**: Health (`GET /health`) and readiness (`GET /ready`) endpoints
- **rosmarium-ai-worker**: Semantic search endpoint (`POST /search`) with ACL filtering
- **rosmarium-ai-worker**: Multi-stage Dockerfile for production builds
- **rosmarium-ai-worker**: Docker Compose service configuration
- **rosmarium-ai-worker**: 23 unit tests covering providers, index manager, consumer, and health

### Changed
- Upgraded `@typescript-eslint` from v7 to v8 to support TypeScript 5.9
- Fixed 26 ESLint errors across `rosmarium-server` (unused imports, unused vars, explicit `any`)
- Added `httpx` dev dependency to `rosmarium-ai-worker` for FastAPI test client support

## [0.1.0] - 2026-03-12

### Added
- Initial monorepo scaffold with Turborepo (rosmarium-server, rosmarium-admin, rosmarium-ai-worker, rosmarium-cli)
- **rosmarium-server**: Fastify server with Drizzle ORM, PostgreSQL, and content engine
- **rosmarium-server**: GraphQL layer (Pothos + graphql-yoga) with queries, mutations, and subscriptions
- **rosmarium-server**: Webhook delivery system with BullMQ and HMAC-SHA256 signing
- **rosmarium-server**: Authentication (Lucia v3 session-based) and API key authentication
- **rosmarium-server**: Role-Based Access Control (RBAC) engine with field-level permissions
- **rosmarium-admin**: React 19 admin panel scaffold with Vite
- **rosmarium-ai-worker**: FastAPI-based AI pipeline worker with uv package management
- Comprehensive unit test suites for all server modules (86 tests passing)
- README with architecture overview and quick-start guide
