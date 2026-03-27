# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
