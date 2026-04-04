# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-04-05

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
