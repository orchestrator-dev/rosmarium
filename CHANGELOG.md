# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
