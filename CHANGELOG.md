# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] - 2026-05-25

### Added
- **cortex-ai-worker**: NetworkX analytics worker for PageRank, betweenness, community detection (Louvain), and HITS hub/authority scoring.
- **cortex-ai-worker**: Knowledge graph export engine supporting JSON-LD, RDF Turtle, Cytoscape.js JSON, and GraphML formats.
- **cortex-server**: Analytics REST endpoints (`/api/graph/communities/:contentType`, `/api/graph/influential/:contentType`, `/api/graph/analytics/compute`, `/api/graph/export`).

### Fixed
- **cortex-ai-worker**: Resolved `FastAPIError` by allowing `response_model=None` for multiple export format responses.
- **cortex-server**: Fixed `cortex-server` JSONB property mappings for retrieving analytical results from the database.

## [0.7.0] - 2026-05-25

### Added
- **cortex-server**: Multi-hop graph traversal engine with PostgreSQL recursive CTEs.
- **cortex-server**: Traversal REST endpoints (`/api/graph/traverse`, `/api/graph/neighbors`, `/api/graph/path`, `/api/graph/recommend`).
- **cortex-server**: Cypher-lite DSL parser to convert Cypher patterns to parameterized SQL.
- **cortex-server**: GraphQL `@traverse` directive for content entry schemas.
- **cortex-ai-worker**: Semantic graph recommendation integration combining structural and semantic scores.

## [0.5.0] - 2026-05-23

### Added

- **cortex-ai-worker**: `AutoTagger` — HuggingFace zero-shot text classification using cross-encoder NLI models; label taxonomy configurable per content type; CPU-only inference with lazy model loading
- **cortex-ai-worker**: `NERExtractor` — spaCy `en_core_web_sm` named entity extraction (PERSON, ORG, GPE, DATE, PRODUCT, EVENT, WORK_OF_ART, LAW); lazy model load on first use; per-entity deduplication
- **cortex-ai-worker**: `ContentSummarizer` — Ollama LLM summarization with `brief`, `detailed`, and `bullet` styles; extractive sentence-scoring fallback when Ollama is unavailable
- **cortex-ai-worker**: `DuplicateDetector` — pgvector cosine similarity for per-entry and full-collection duplicate scanning; configurable threshold; batch processing to avoid memory pressure
- **cortex-ai-worker**: `intelligence_worker` — BullMQ `analyse-content` job processor; runs all four operations independently with fault isolation; persists results to `content_entries.metadata->'ai'` via JSONB merge
- **cortex-ai-worker**: Second `QueueConsumer` for the `intelligence-jobs` BullMQ queue
- **cortex-ai-worker**: FastAPI routes: `POST /intelligence/tag`, `POST /intelligence/ner`, `POST /intelligence/summarize`, `POST /intelligence/find-duplicates`, `GET /intelligence/scan-duplicates/{type}`
- **cortex-ai-worker**: New config vars: `TAGGING_MODEL`, `SUMMARIZATION_MODEL`, `DUPLICATE_THRESHOLD`
- **cortex-server**: `intelligence.client.ts` — HTTP client for cortex-ai-worker intelligence endpoints with `X-Worker-Secret` auth
- **cortex-server**: `intelligence.service.ts` — on-demand intelligence orchestration with JSONB metadata persistence via raw SQL merge
- **cortex-server**: `intelligence.jobs.ts` — BullMQ `analyse-content` job dispatch and queue statistics for all queues
- **cortex-server**: REST routes: `POST /api/content/:type/:id/tag`, `POST /api/content/:type/:id/summarize`, `GET /api/content/:type/:id/entities`, `GET /api/content/:type/duplicates`
- **cortex-server**: `GET /api/admin/queue-stats` — live BullMQ statistics for embedding-jobs, intelligence-jobs, webhook-deliveries (admin role only)
- **cortex-server**: Automatic intelligence job dispatch on `content.published` event when `contentType.settings.aiIntelligence.enabled = true`
- **cortex-admin**: AI Dashboard with 4 panels — Embedding Coverage, Auto-tagging Taxonomy, Duplicate Detection scanner, Intelligence Queue live stats (auto-refreshes every 5s)
- **cortex-admin**: Tab navigation between Search and AI views
- **DB**: Migration `0006_ai_metadata_gin_index` — GIN index on `content_entries.metadata->'ai'` for fast AI result queries

### Changed

- **cortex-ai-worker**: `NERExtractor` now loads `en_core_web_sm` lazily on first call (was at instantiation time)
- **cortex-server**: `.env.example` updated with `TAGGING_MODEL`, `SUMMARIZATION_MODEL`, `DUPLICATE_THRESHOLD`

### Tests

- 23 new Python tests: `test_tagger.py`, `test_summarizer.py` (updated), `test_duplicate_detector.py`, `test_intelligence_worker.py`
- 5 new TypeScript tests in `intelligence.service.test.ts`
- NER tests auto-skip when `en_core_web_sm` not installed locally
- All 79 Python tests passing (7 skipped); all 143 TypeScript tests passing
- `mypy src/ --ignore-missing-imports` clean; `tsc --noEmit` clean


### Added

- **cortex-server**: Unified `GET /api/search` endpoint — hybrid BM25 + pgvector search with Reciprocal Rank Fusion (RRF)
- **cortex-server**: `GET /api/search/suggest` — debounced prefix autocomplete for search input
- **cortex-server**: `fulltextSearch` module — PostgreSQL tsvector / `plainto_tsquery` with `ts_rank_cd` scoring and `ts_headline` snippet extraction
- **cortex-server**: `vectorSearch` module — pgvector cosine similarity search (`<=>` operator); gracefully returns `[]` when the `cortex_{type}_embeddings` table does not yet exist (`42P01` error)
- **cortex-server**: `reciprocalRankFusion` — pure RRF algorithm with configurable `alpha` (0 = fulltext only, 1 = vector only, 0.5 = balanced) and `k` constant; handles multi-chunk deduplication
- **cortex-server**: `aiWorkerClient` — internal HTTP client to cortex-ai-worker with 5 s `AbortController` timeout and `SearchEmbeddingError` for graceful degradation; never logs query text (PII)
- **cortex-server**: Graceful fallback — search works fulltext-only when cortex-ai-worker is unreachable
- **cortex-server**: Database migration `0004_hybrid_search_vector` — `search_vector tsvector GENERATED ALWAYS AS` column covering `title`, `body`, `description` JSONB fields, plus GIN index on `content_entries`
- **cortex-server**: RBAC filtering applied to search results before fusion — draft entries invisible to viewers
- **cortex-ai-worker**: `POST /search/embed` — sync query-time embedding endpoint with `X-Worker-Secret` header auth; never logs query text
- **cortex-ai-worker**: `POST /search/embed-batch` — batch embedding endpoint (max 500 texts per call) for backfill operations
- **cortex-ai-worker**: `embed_one_with_input_type()` and `embed_batch_with_input_type()` added to `EmbeddingProvider` base class; Cohere provider overrides to forward `search_query` vs `search_document` input type to the API
- **cortex-admin**: Standalone search demo UI — debounced autocomplete dropdown, result cards with match-type badges (`hybrid` / `fulltext` / `vector`), RRF score bars, `ts_headline` snippet display, alpha slider for keyword↔semantic balance, and AI-worker-offline notice

### Changed

- **cortex-ai-worker**: `CohereEmbeddingProvider` now overrides `embed_one_with_input_type()` and `embed_batch_with_input_type()` to pass the Cohere-specific `input_type` parameter through correctly

### Fixed

- **cortex-ai-worker**: Ruff S105 false-positive on HTTP header name constant suppressed with `noqa: S105`

## [0.2.0] - 2026-03-27

### Added
- **cortex-ai-worker**: Full service bootstrap — FastAPI app factory with lifespan management
- **cortex-ai-worker**: Pydantic Settings configuration with env var loading
- **cortex-ai-worker**: asyncpg connection pool with FastAPI dependency injection
- **cortex-ai-worker**: Embedding providers — Ollama, OpenAI, and Cohere with abstract base class
- **cortex-ai-worker**: pgvector index manager with HNSW indexing (m=16, ef_construction=64)
- **cortex-ai-worker**: BullMQ-compatible Redis queue consumer for async job processing
- **cortex-ai-worker**: Embedding worker with sentence-boundary chunking
- **cortex-ai-worker**: Health (`GET /health`) and readiness (`GET /ready`) endpoints
- **cortex-ai-worker**: Semantic search endpoint (`POST /search`) with ACL filtering
- **cortex-ai-worker**: Multi-stage Dockerfile for production builds
- **cortex-ai-worker**: Docker Compose service configuration
- **cortex-ai-worker**: 23 unit tests covering providers, index manager, consumer, and health

### Changed
- Upgraded `@typescript-eslint` from v7 to v8 to support TypeScript 5.9
- Fixed 26 ESLint errors across `cortex-server` (unused imports, unused vars, explicit `any`)
- Added `httpx` dev dependency to `cortex-ai-worker` for FastAPI test client support

## [0.1.0] - 2026-03-12

### Added
- Initial monorepo scaffold with Turborepo (cortex-server, cortex-admin, cortex-ai-worker, cortex-cli)
- **cortex-server**: Fastify server with Drizzle ORM, PostgreSQL, and content engine
- **cortex-server**: GraphQL layer (Pothos + graphql-yoga) with queries, mutations, and subscriptions
- **cortex-server**: Webhook delivery system with BullMQ and HMAC-SHA256 signing
- **cortex-server**: Authentication (Lucia v3 session-based) and API key authentication
- **cortex-server**: Role-Based Access Control (RBAC) engine with field-level permissions
- **cortex-admin**: React 19 admin panel scaffold with Vite
- **cortex-ai-worker**: FastAPI-based AI pipeline worker with uv package management
- Comprehensive unit test suites for all server modules (86 tests passing)
- README with architecture overview and quick-start guide
