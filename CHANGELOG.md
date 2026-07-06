# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-07-06

### Added
- **rosmarium-server**: Completed native Model Context Protocol (MCP) server implementation with stdio transport (`@modelcontextprotocol/sdk@^1.29.0`).
- **rosmarium-server**: Added 7 Content CRUD tools (`content_list`, `content_get`, `content_create`, `content_update`, `content_publish`, `content_unpublish`, `content_delete`).
- **rosmarium-server**: Added 2 Schema tools (`schema_list`, `schema_get`) and 2 Search tools (`search_hybrid`, `search_graph`).
- **rosmarium-server**: Added 4 AI tools (`ai_summarize`, `ai_tag`, `ai_translate`, `ai_generate`) wired to the AI worker.
- **rosmarium-server**: Added 6 Workflow & Scheduling tools (`workflow_status`, `workflow_transition`, `workflow_list`, `schedule_publish`, `schedule_cancel`, `schedule_list`).
- **rosmarium-server**: Added 3 MCP Resources (`rosmarium://content-types`, `rosmarium://locales`, `rosmarium://workflows`).
- **rosmarium-server**: Added MCP authentication module (`mcpAuth`) with API key validation and context provider.
- **rosmarium-server**: Added MCP Plugin Bridge (`registerPluginMcpTools`) allowing plugins to register custom MCP tools dynamically.
- **rosmarium-cli**: Fixed `mcpCommand` dynamic import path to `@orchestrator.dev/server/mcp/server.js`.
- **rosmarium-types**: Added `McpToolDefinition` interface and `mcpTools` property to `RosmariumPlugin` type definition.
- **rosmarium-admin**: Visual Experience Orchestration (Page Builder) UI for dragging and dropping components.
- **rosmarium-server**: Page schema, Component Registry, and Page routing APIs.
- **rosmarium-sdk**: Bidirectional live preview synchronization protocol for the visual builder.
- **rosmarium-edge**: Edge Analytics and Personalization framework to evaluate audience segments based on user traits.
- **rosmarium-server**: Audience Segment and Content Variant APIs for personalization.
- **rosmarium-admin**: Personalization segments UI for defining audience logic.

## [2.1.0] - 2026-06-23

### Added
- **rosmarium-server**: Content Federation System. Introduced `remote_sources` schema to store external APIs and integrated `@graphql-tools/stitch` in Pothos schema definition to automatically federate remote APIs.
- **rosmarium-server**: Redis-based federated query cache via `cache.service.ts` for rate-limit protection on remote APIs.
- **rosmarium-server**: Invalidation webhook routes to flush federated caches.
- **rosmarium-admin**: Federation configuration UI (`Federation.tsx`) for managing remote data sources visually.
- **rosmarium-edge**: Edge caching definitions for federated queries.

## [2.0.0] - 2026-06-01
### Added
- **rosmarium-www**: Complete premium aesthetic overhaul of the documentation site, including custom Tailwind CSS, neon gradients, and a new markdown MDX styling architecture.
- **rosmarium-www**: Global copy-to-clipboard functionality across all documentation code blocks.
- **rosmarium-www**: Dedicated documentation pages for new V2 features: Content Branching and Visual Live Preview.
- **rosmarium-admin**: Branching UI components and Live Preview iframe integrations.
- **rosmarium-server**: Content branching backend APIs (create, merge, three-way diff).

### Fixed
- **rosmarium-server**: Fixed SSO OAuth/SAML service bugs and GraphQL pubsub issues.
- **rosmarium-server**: Fixed media processing and RBAC middleware vulnerabilities.
- **rosmarium-edge**: Resolved edge caching invalidation issues and router configuration.
- **rosmarium-admin**: Fixed various frontend E2E bugs in AuditLog, ContentEditor, Governance, and Login pages.
- **rosmarium-www**: Resolved MDX compilation crashes caused by raw JSX curly braces by migrating to standard Markdown code blocks.

### Changed
- **Global**: Official bump to V2.0.0 marking the stable release of the new AI-native, branchable content architecture.

## [1.14.0] - 2026-05-31

### Added
- **rosmarium-server**: SSO Provider database schema for storing OAuth2, OIDC, and SAML configurations.
- **rosmarium-server**: `oauth.service.ts` for handling OAuth2/OIDC discovery, PKCE state validation, and id_token decoding via `arctic`.
- **rosmarium-server**: `saml.service.ts` for managing SAML 2.0 SP-initiated login and callback validation via `@node-saml/node-saml`.
- **rosmarium-server**: `sso.service.ts` to orchestrate login flows, auto-provision users if they don't exist, and perform dynamic role mapping based on claims/groups.
- **rosmarium-server**: Fastify routes `/api/auth/sso/providers`, `/api/auth/sso/login/:providerId`, and `/api/auth/sso/callback/:providerId`.
- **rosmarium-admin**: Dynamic Admin UI login page that fetches active SSO providers and renders direct sign-in buttons for Enterprise Auth.

## [1.12.0] - 2026-05-31

### Added
- **rosmarium-server**: AI Operations Log schema and tracking API.
- **rosmarium-server**: Fastify routes for AI Governance dashboard metrics.
- **rosmarium-server**: Faceted Search service for filtering and aggregation.
- **rosmarium-server**: Related Content Recommendations based on vector similarity and graph proximity.
- **rosmarium-server**: Saved Searches service.
- **rosmarium-admin**: AI Governance Dashboard UI showing token usage, limits, and metrics.

## [1.11.0] - 2026-05-31

### Added
- **rosmarium-ai-worker**: AI Generative Content Studio — text generation from prompts with SSE streaming (`generator.py`).
- **rosmarium-ai-worker**: Inline AI Rewriter for tone adjustment, expansion, and compression (`rewriter.py`).
- **rosmarium-ai-worker**: AI SEO Optimizer for automatic metadata extraction (`seo_optimizer.py`).
- **rosmarium-ai-worker**: Multi-lingual AI translation engine with tenant-specific glossary enforcement (`translator.py`, `glossary.py`).
- **rosmarium-server**: Fastify proxy routes forwarding SSE streams to the frontend (`generation.routes.ts`, `translation.routes.ts`).
- **rosmarium-admin**: Floating AI Assistant UI integrated into the content authoring experience.
- **rosmarium-admin**: Inline AI context menu for quick content transformations.
- **rosmarium-admin**: One-click translation button.

## [1.5.0] - 2026-05-31

### Added
- **rosmarium-admin**: Content Tree View with drag-and-drop hierarchy management (`@dnd-kit/core`).
- **rosmarium-admin**: Bulk Operations Action Bar to publish, unpublish, archive, tag, summarize, and delete multiple entries simultaneously.
- **rosmarium-server**: Hierarchy Service to query and mutate `parent_of` edges for content nodes.
- **rosmarium-server**: Transactional Bulk Operations API endpoints supporting integrated intelligence pipelines.

## [1.4.0] - 2026-05-31
- **rosmarium-admin**: Live Preview Engine providing real-time content preview in the admin UI without saving.
- **rosmarium-server**: Secure token-based access via `postMessage` protocol between the CMS iframe and the external frontend for live previews.
- **rosmarium-admin**: Conditional Fields logic allowing fields to be dynamically shown or hidden.
- **rosmarium-server**: Server-side validation now automatically skips conditionally hidden fields.

## [1.2.0] - 2026-05-31

### Added
- **rosmarium-admin**: Tiptap/ProseMirror block editor integration.
- **rosmarium-admin**: New `@orchestrator.dev/types` package defining the structured `BlockDocument` format.
- **rosmarium-admin**: Slash command menu and formatting toolbar for block editor.
- **rosmarium-server**: Serialization support for structured `BlockDocument` to HTML, Markdown, and Plaintext.
- **rosmarium-server**: Unified `richText` validation supporting both legacy string format and modern BlockDocument schema.

## [1.1.0] - 2026-05-29

### Added
- **rosmarium-admin**: Content Type Builder with an intuitive 5-step wizard and drag-and-drop field management.
- **rosmarium-admin**: Access Control management screens for Users, Roles, and API Keys.
- **rosmarium-admin**: Webhooks management interface.

### Fixed
- **rosmarium-admin**: Fixed TypeScript definitions and linting errors across the newly added Settings screens.
- **rosmarium-server**: Corrected internal import path for `client.js` in `query.ts`.

## [1.0.1] - 2026-05-27

### Fixed
- **rosmarium-admin**: Fixed Hybrid Search component crash (white screen) caused by data schema mismatch.
- **rosmarium-admin**: Implemented fully functional Edit and Create Entry UI overlays for content items.
- **rosmarium-admin**: Improved Knowledge Graph search with Autocomplete UI and empty state guidance.
- **rosmarium-admin**: Added robust Loading, Empty, and Error states to Hybrid Search view.
- **rosmarium-admin**: Refactored AI Dashboard layout to be responsive.
- **rosmarium-admin/rosmarium-server**: Fixed internal TypeScript and linting errors.

## [1.0.0] - 2026-05-27

### Added
- **rosmarium-admin**: Complete redesign of Rosmarium Admin UI to production quality using Material UI.
- **demo**: Introduced "Rosmarium Discovery" demo dataset with a full script to showcase CMS and AI features out of the box (`pnpm demo:seed`).

## [0.9.0] - 2026-05-26

### Fixed
- **rosmarium-server**: Fixed queue stats connection lifetime leak in `intelligence.jobs.ts`.
- **rosmarium-ai-worker**: Fixed Python queue consumer job completion/failure ZSET schemas causing `WRONGTYPE` errors in Redis.
- **rosmarium-server**: Fixed `publish` and `unpublish` route foreign key constraint violations by dynamically using the authenticated user ID.
- **rosmarium-server**: Fixed API response schema serialization that was improperly stripping rich JSON `metadata.ai` from entries.
- **rosmarium-admin**: Fixed frontend POST request for Graph Analytics missing `Content-Type: application/json` header.

## [0.8.0] - 2026-05-25

### Added
- **rosmarium-ai-worker**: NetworkX analytics worker for PageRank, betweenness, community detection (Louvain), and HITS hub/authority scoring.
- **rosmarium-ai-worker**: Knowledge graph export engine supporting JSON-LD, RDF Turtle, Cytoscape.js JSON, and GraphML formats.
- **rosmarium-server**: Analytics REST endpoints (`/api/graph/communities/:contentType`, `/api/graph/influential/:contentType`, `/api/graph/analytics/compute`, `/api/graph/export`).

### Fixed
- **rosmarium-ai-worker**: Resolved `FastAPIError` by allowing `response_model=None` for multiple export format responses.
- **rosmarium-server**: Fixed `rosmarium-server` JSONB property mappings for retrieving analytical results from the database.

## [0.7.0] - 2026-05-25

### Added
- **rosmarium-server**: Multi-hop graph traversal engine with PostgreSQL recursive CTEs.
- **rosmarium-server**: Traversal REST endpoints (`/api/graph/traverse`, `/api/graph/neighbors`, `/api/graph/path`, `/api/graph/recommend`).
- **rosmarium-server**: Cypher-lite DSL parser to convert Cypher patterns to parameterized SQL.
- **rosmarium-server**: GraphQL `@traverse` directive for content entry schemas.
- **rosmarium-ai-worker**: Semantic graph recommendation integration combining structural and semantic scores.

### Fixed
- **rosmarium-server**: Resolved strict null check compilation errors in the server `tsc` pipeline, achieving perfect type safety for graph modules.
- **rosmarium-server**: Refactored regex parsing and variable handling in `cypher.parser.ts` to ensure full compatibility with strict mode compilation.
- **rosmarium-ai-worker**: Fixed `linting` warnings across the Python and TypeScript codebases (`ruff` compliance achieved).

## [0.6.0] - 2026-05-24

### Added
- **rosmarium-server**: Graph Database Schema supporting typed content relationships (`graph_edges`), entity nodes (`graph_entity_nodes`), and mentions (via migration `0007_graph_data_model`).
- **rosmarium-server**: Graph Service & Repository for edge validation, bidirectional flag handling, and transactional manual edge lifecycle.
- **rosmarium-server**: Protected REST API endpoints under `/api/graph` for manual edge CRUD, pending AI edge approval workflows, and entity mention visualization.
- **rosmarium-ai-worker**: Built-in inference orchestration engine strategy pipeline processing right after metadata analysis.
- **rosmarium-ai-worker**: NER Co-mention Strategy that identifies extracted entity mentions and links content pieces referencing similar entities.
- **rosmarium-ai-worker**: Semantic Similarity Strategy to automatically trigger bidirectional `relatedTo` links using `pgvector` (`<=>` operator) for neighbors exceeding the similarity threshold.
- **rosmarium-ai-worker**: Reference Strategy to parse inline markdown wiki-links (`[[slug]]`) and relative pathways, creating explicit `references` edges.
- **rosmarium-admin**: Interactive Graph Panel visual interface to query entry neighborhoods, review and approve/reject AI-generated relationships on the fly, and manually link documents together.

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
