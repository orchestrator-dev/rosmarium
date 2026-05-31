#!/usr/bin/env bash
# =============================================================================
# Rosmarium COS — AI Agent Configuration Setup
# =============================================================================
# Scaffolds the complete agent configuration for AI coding assistants.
# Supports: Antigravity (.agent/), Claude Code (CLAUDE.md), Cursor (.cursor/),
#           GitHub Copilot (.github/copilot-instructions.md), and AGENTS.md standard.
#
# Run from the Rosmarium monorepo root:
#
#   chmod +x setup-agent.sh
#   ./setup-agent.sh
#
# Creates:
#   AGENT.md                  — Primary Antigravity agent context (repo root)
#   AGENTS.md                 — Cross-tool standard agent context
#   CLAUDE.md                 — Symlink → AGENTS.md (Claude Code)
#   .agent/rules/             — 8 always-on guardrail files
#   .agent/skills/            — 12 domain-specific skill directories
#   .agent/workflows/         — 6 slash-command workflow playbooks
#   .agent/MASTER_PROMPT.md   — Agent session opening prompt
#   .cursor/rules/            — 4 Cursor rule files (.mdc)
#   .github/copilot-instructions.md — GitHub Copilot context
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

log()  { echo -e "${CYAN}[rosmarium]${RESET} $*"; }
ok()   { echo -e "${GREEN}  ✓${RESET} $*"; }
warn() { echo -e "${YELLOW}  ⚠${RESET} $*"; }
head() { echo -e "\n${BOLD}${YELLOW}── $* ──${RESET}"; }

# ── Guard: must be run from monorepo root ────────────────────────────────────
if [[ ! -f "package.json" ]] || ! grep -q "rosmarium-cos" package.json 2>/dev/null; then
  echo -e "${RED}Error:${RESET} This script must be run from the rosmarium monorepo root."
  echo "Expected to find package.json with name 'rosmarium-cos'."
  exit 1
fi

# ── Create directory structure ───────────────────────────────────────────────
head "Creating directory structure"

mkdir -p .agent/rules
mkdir -p .agent/workflows
mkdir -p .agent/skills/content-engine
mkdir -p .agent/skills/drizzle-schema
mkdir -p .agent/skills/pothos-graphql
mkdir -p .agent/skills/pgvector-search
mkdir -p .agent/skills/rag-pipeline
mkdir -p .agent/skills/knowledge-graph
mkdir -p .agent/skills/fastify-server
mkdir -p .agent/skills/admin-ui
mkdir -p .agent/skills/ai-intelligence
mkdir -p .agent/skills/block-editor
mkdir -p .agent/skills/workflow-engine
mkdir -p .agent/skills/plugin-system
mkdir -p .cursor/rules
mkdir -p .github

ok "Directory structure created"

# =============================================================================
# AGENT.md (Antigravity primary context — repo root)
# =============================================================================
head "Writing AGENT.md"

cat > AGENT.md << 'AGENT_EOF'
# Rosmarium COS — AI Agent Context

## Overview
Rosmarium is an open-source, AI-native headless **Content Orchestration System (COS)**.
Apache 2.0 license. Monorepo managed with pnpm workspaces + Turborepo.

## Architecture
| App | Stack | Port | Purpose |
|-----|-------|------|---------|
| `apps/rosmarium-server` | TypeScript / Node.js 22 / Fastify 4 | 3000 | Core API (REST + GraphQL), auth, RBAC, webhooks |
| `apps/rosmarium-admin` | TypeScript / React 19 / Vite / MUI v9 | 5173 | Admin dashboard |
| `apps/rosmarium-ai-worker` | Python 3.12 / FastAPI | 8001 | AI pipeline (embeddings, RAG, NER, graph analytics) |

| Package | Name | Purpose |
|---------|------|---------|
| `packages/types` | `@orchestrator.dev/types` | Shared TypeScript types |
| `packages/sdk` | `@orchestrator.dev/rosmarium-sdk` | API client SDK |
| `packages/config` | `@orchestrator.dev/config` | Shared configuration |

## Infrastructure
- **Database**: PostgreSQL 16 + pgvector (primary + vector store)
- **Cache/Queue**: Redis 7 + BullMQ (3 queues: embedding-jobs, intelligence-jobs, webhook-deliveries)
- **Storage**: S3-compatible (MinIO for dev)
- **Observability**: OpenTelemetry + Prometheus + Grafana

## Service Communication
- Server → AI Worker: BullMQ Redis queues (async) + HTTP on port 8001 (sync search/RAG)
- Both services share the same PostgreSQL and Redis instances
- GraphQL subscriptions via graphql-ws WebSocket

## Development Commands
```bash
pnpm infra:up          # Start PostgreSQL, Redis, MinIO via Docker/Podman
pnpm infra:init        # Initialize pgvector extension + MinIO bucket (first run)
pnpm db:migrate        # Run Drizzle migrations
pnpm db:seed           # Seed initial data
pnpm demo:seed         # Seed demo dataset ("Rosmarium Discovery")
pnpm dev               # Start all apps (Turborepo)
pnpm typecheck         # TypeScript type checking (all workspaces)
pnpm lint              # ESLint (TS) + Ruff (Python)
pnpm test              # Run all tests
pnpm db:generate       # Generate Drizzle migration after schema change
```

## Key Conventions
- **TypeScript imports**: Always use `.js` extensions for ESM (`from "./config.js"`)
- **IDs**: `@paralleldrive/cuid2` via `createId()` — all tables use `text("id")`
- **Column naming**: camelCase in TypeScript ↔ snake_case in SQL
- **Services**: Object literal pattern (`export const fooService = { async method() {} }`)
- **Config validation**: Zod (TypeScript) / Pydantic Settings (Python)
- **Auth**: Lucia v3 session cookies + Bearer API key auth
- **GraphQL**: graphql-yoga v5 + Pothos v4 schema builder (NOT Mercurius)
- **Admin UI**: React 19, MUI v9 (`size={{ xs: 12 }}` for Grid), react-router-dom v7
- **Multi-tenancy**: `X-Tenant-Id` header → AsyncLocalStorage → PostgreSQL `search_path`

## Guidelines for AI Agents
1. **Read `PHASE.md`** before starting any task — know the current phase.
2. **Read `roadmapV2.md`** for V2 planned features and architecture.
3. **Database changes**: Update Drizzle schema in `apps/rosmarium-server/src/db/schema/`, then `pnpm db:generate`. Show migration diff before applying.
4. **Check `.agent/skills/`** for domain-specific patterns before modifying database, GraphQL, search, graph, or AI pipeline code.
5. **Testing**: Co-locate tests as `*.test.ts` (Vitest) or `test_*.py` (pytest). Run `pnpm typecheck && pnpm lint && pnpm test` before committing.
6. **Documentation**: Update docs in `apps/rosmarium-www/src/content/docs/` for API changes. Screenshots via Chrome DevTools MCP only — no synthetic images.
7. **Verify after every change**: `pnpm typecheck && pnpm lint && pnpm test`

## Custom Agent Skills
Check `.agent/skills/` for detailed patterns on: content-engine, drizzle-schema, pothos-graphql, pgvector-search, rag-pipeline, knowledge-graph, fastify-server, admin-ui, ai-intelligence, block-editor, workflow-engine, plugin-system.
AGENT_EOF
ok "AGENT.md"

# =============================================================================
# AGENTS.md (Cross-tool standard — CLAUDE.md, Copilot, Cursor, Aider)
# =============================================================================
head "Writing AGENTS.md"

cat > AGENTS.md << 'AGENTS_EOF'
# Rosmarium COS — Agent Configuration

## Project
Open-source, AI-native headless Content Orchestration System. Apache 2.0.
TypeScript/Fastify API + React admin + Python/FastAPI AI worker. pnpm monorepo + Turborepo.

## Tech Stack
- TypeScript 5.4, Node.js 22, Fastify 4, Drizzle ORM 0.43, graphql-yoga 5, Pothos 4
- React 19, Vite 5, MUI v9, react-router-dom v7
- Python 3.12, FastAPI, Pydantic v2, spaCy, LlamaIndex, PyTorch
- PostgreSQL 16 + pgvector, Redis 7 + BullMQ, S3 (MinIO)

## Commands
- Install: `pnpm install`
- Dev: `pnpm dev`
- Infra: `pnpm infra:up && pnpm infra:init`
- DB migrate: `pnpm db:migrate`
- DB generate: `pnpm db:generate` (after schema changes)
- Test: `pnpm test`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Python lint: `cd apps/rosmarium-ai-worker && ruff check src/`
- Python types: `cd apps/rosmarium-ai-worker && mypy src/`

## Coding Standards
### TypeScript (apps/rosmarium-server)
- ESM with `.js` import extensions: `import { x } from "./module.js"`
- Strict mode, `noUncheckedIndexedAccess: true`
- Zod for all runtime validation. No `any` — use `unknown` + narrow.
- Services as object literals: `export const fooService = { async bar() {} }`
- Custom error classes with `code` property

### Python (apps/rosmarium-ai-worker)
- Type hints on all functions. Pydantic v2 models for all data boundaries.
- mypy strict mode. Ruff for linting (line-length 100).
- async/await throughout. asyncpg for DB. Never mix sync/async.

### React (apps/rosmarium-admin)
- Functional components, named exports, hooks only
- MUI v9 — Grid uses `size={{ xs: 12 }}` not `xs={12}`
- react-router-dom v7 (BrowserRouter, Routes, Route)
- Plain fetch() for API calls — no axios

### Database
- Drizzle ORM. IDs: `text("id").$defaultFn(() => createId())` (cuid2)
- Column names: snake_case in SQL, camelCase in TypeScript
- Timestamps: `timestamp("x", { withTimezone: true }).notNull().defaultNow()`
- Show migration diff before applying. Never auto-run destructive migrations.

## Architecture Notes
- GraphQL: graphql-yoga v5 + Pothos v4 (NOT Mercurius)
- Auth: Lucia v3 sessions + API key auth
- Events: TypedEventEmitter → bridges to PubSub, Webhooks, Job queues
- Multi-tenancy: X-Tenant-Id header → AsyncLocalStorage → PostgreSQL search_path

## Boundaries
### Always
- Run `pnpm typecheck && pnpm lint && pnpm test` before committing
- Use conventional commits: `feat(server): description`
- Read PHASE.md before starting work
- Show migration SQL diffs before applying

### Never
- Never commit .env files, API keys, or secrets
- Never use raw SQL in application code (use Drizzle ORM)
- Never use `any` type in TypeScript
- Never run destructive DB operations without confirmation
- Never log request bodies containing passwords, tokens, or PII
- Never add dependencies without checking maintenance status
AGENTS_EOF
ok "AGENTS.md"

# ── Symlink CLAUDE.md → AGENTS.md ────────────────────────────────────────────
if [[ -L "CLAUDE.md" ]]; then
  rm CLAUDE.md
fi
if [[ -f "CLAUDE.md" ]]; then
  warn "CLAUDE.md exists as a regular file — skipping symlink"
else
  ln -s AGENTS.md CLAUDE.md
  ok "CLAUDE.md → AGENTS.md (symlink)"
fi

# ── GitHub Copilot instructions ──────────────────────────────────────────────
cp AGENTS.md .github/copilot-instructions.md
ok ".github/copilot-instructions.md (copy of AGENTS.md)"

# =============================================================================
# RULES (8 files — always-on guardrails)
# =============================================================================
head "Writing Rules (8 files)"

# ── Rule 01: Project Context ─────────────────────────────────────────────────
log "01-project-context.md"
cat > .agent/rules/01-project-context.md << 'EOF'
# Rosmarium COS — Project Context

## What We're Building
Rosmarium is an open-source, AI-native headless Content Orchestration System (COS).
Apache 2.0 license. Monorepo managed with pnpm workspaces + Turborepo.

## Architecture: Pragmatic Polyglot
- `apps/rosmarium-server` — TypeScript / Node.js 22 / Fastify 4 — CMS core API, GraphQL, auth, webhooks
- `apps/rosmarium-admin` — TypeScript / React 19 / Vite / MUI v9 — admin dashboard
- `apps/rosmarium-ai-worker` — Python 3.12 / FastAPI — AI pipeline (embeddings, RAG, NER, graph analytics)
- `packages/types` — `@orchestrator.dev/types` — shared TypeScript types
- `packages/sdk` — `@orchestrator.dev/rosmarium-sdk` — API client SDK
- `packages/config` — `@orchestrator.dev/config` — shared configuration (Zod)

## Shared Infrastructure
- PostgreSQL 16 + pgvector (primary datastore + vector store)
- Redis 7 / BullMQ (3 queues: embedding-jobs, intelligence-jobs, webhook-deliveries)
- S3-compatible storage via @aws-sdk/client-s3 (MinIO for local dev)

## Service Communication
- rosmarium-server → rosmarium-ai-worker: async via BullMQ Redis queues (embedding, intelligence, graph jobs)
- rosmarium-server → rosmarium-ai-worker: sync via internal HTTP on port 8001 (search, RAG at query time)
- GraphQL subscriptions via graphql-ws WebSocket protocol
- Both services share the same PostgreSQL instance and Redis instance

## Current Phase
[Read PHASE.md in repo root for current phase and active milestone before starting any task]
[Read roadmapV2.md for V2 planned features and architecture]

## Non-Negotiable Principles
1. Never break the REST or GraphQL API contract without a versioned migration path
2. All AI features are opt-in and can be disabled per content type via `settings.aiIntelligence`
3. All configuration via environment variables — no secrets in code or config files
4. pgvector is the default vector store; dynamic table creation per content type
5. S3 abstraction must work with any S3-compatible provider, not just AWS
6. Multi-tenancy via PostgreSQL schema isolation — every query must be tenant-aware
EOF
ok "01-project-context.md"

# ── Rule 02: TypeScript Standards ────────────────────────────────────────────
log "02-typescript-standards.md"
cat > .agent/rules/02-typescript-standards.md << 'EOF'
# TypeScript / Node.js Standards (rosmarium-server)

## Language & Runtime
- Node.js 22 LTS, TypeScript 5.4+ with strict mode
- ESM modules throughout (`"type": "module"` in package.json) — no CommonJS
- `noUncheckedIndexedAccess: true` in tsconfig — handle all potential undefined
- All `.ts` imports MUST use `.js` extensions: `import { config } from "./config.js"`

## Code Style
- ESLint with @typescript-eslint/recommended
- No `any` types — use `unknown` and narrow explicitly
- Prefer `const` over `let`; never `var`
- Async/await always — no raw Promise chains
- Zod for all runtime validation — never trust external input without parsing

## Module / Service Pattern
- Business logic in `src/modules/{domain}/` — one directory per domain
- Services exported as object literals (NOT classes):
  ```typescript
  export const fooService = {
    async findMany(opts: FindManyOpts) { ... },
    async create(data: CreateInput) { ... },
  };
  ```
- Exception: `ContentTypeRegistry` is a class with singleton export
- File naming: `{domain}.service.ts`, `{domain}.routes.ts`, `{domain}.client.ts`, `{domain}.test.ts`

## Route Pattern
- Routes are FastifyPluginAsync functions in `src/routes/`
- Route handlers call module services — no business logic in handlers
- All routes registered via `app.register(routeModule)` in route index

## Error Pattern
- Custom Error classes with `code` property:
  ```typescript
  export class AuthError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message); this.name = "AuthError";
    }
  }
  ```
- HTTP status: 400 validation, 401 unauth, 403 forbidden, 404 not found, 422 business logic, 500 unexpected

## Event System
- `rosmariumEvents` singleton (`TypedEventEmitter`) in `src/lib/events.ts`
- Events bridge to: GraphQL PubSub, Webhook delivery, Intelligence/Embedding jobs
- Event names: `content.created`, `content.updated`, `content.deleted`, `content.published`, `content.unpublished`

## Testing
- Vitest for unit tests, co-located: `{name}.test.ts` (never `.spec.ts`)
- Use `vi.hoisted()` + `vi.mock()` for mocking
- Minimum 80% coverage for modules; 100% for auth and RBAC
- pnpm workspaces — never npm or yarn
EOF
ok "02-typescript-standards.md"

# ── Rule 03: Python Standards ────────────────────────────────────────────────
log "03-python-standards.md"
cat > .agent/rules/03-python-standards.md << 'EOF'
# Python Standards (rosmarium-ai-worker)

## Language & Runtime
- Python 3.12 — use modern syntax (match statements, type unions with `|`)
- pyproject.toml for all config (hatchling build backend). No setup.py or requirements.txt.
- uv for package management (faster than pip)
- Ruff for linting AND formatting (line-length 100, target py312)

## Type Safety
- Full type hints on all public functions and class methods — mandatory
- Pydantic v2 models for all data structures crossing service boundaries
- mypy in strict mode — CI fails on type errors
- Never use `dict` as a return type when a Pydantic model can be used

## FastAPI Patterns
- App factory in `src/rosmarium_ai_worker/main.py` — `def create_app() -> FastAPI`
- Lifespan context manager for startup/shutdown (asyncpg pool, embedding provider, queue consumers)
- Routes in `src/rosmarium_ai_worker/api/routes/` — one file per domain
- Pydantic models for all request/response schemas — never raw dicts

## Config
- Pydantic Settings (`BaseSettings`) in `config.py` — singleton at module level
- All env vars validated at startup with typed defaults
- `model_config = SettingsConfigDict(env_file=".env", extra="ignore")`

## AI/ML Conventions
- Embedding providers implement `EmbeddingProvider` ABC from `embedding/base.py`
- Registry pattern: `init_embedding_provider()`, `get_provider()` in `embedding/registry.py`
- Never hardcode model names — always read from Settings
- Log embedding latency and token counts for cost tracking
- Batch embedding calls — never embed one at a time in a loop

## BullMQ Consumer
- Custom `QueueConsumer` class reads from Redis `bull:{queue}:wait` lists
- BRPOPLPUSH atomic move to active
- Handler registration: `consumer.register_handler("job-type", handler_fn)`
- Worker files in `src/rosmarium_ai_worker/workers/`
- Payload models use **camelCase** fields for BullMQ wire compatibility

## Testing
- pytest + pytest-asyncio (auto mode) for all tests
- Tests in `tests/` directory (not co-located)
- Mock embedding providers — never call real APIs in CI
- Minimum 80% coverage
EOF
ok "03-python-standards.md"

# ── Rule 04: React / Admin UI ────────────────────────────────────────────────
log "04-react-admin.md"
cat > .agent/rules/04-react-admin.md << 'EOF'
# React / Admin UI Standards (rosmarium-admin)

## Stack
- React 19, Vite 5, TypeScript 5.4
- MUI v9 (`@mui/material@^9.0.1`, `@mui/icons-material@^9.0.1`)
- react-router-dom v7 (BrowserRouter, Routes, Route)
- cytoscape for graph visualization, @dnd-kit for drag-and-drop
- Playwright for E2E tests

## Component Patterns
- Functional components only — named exports: `export function PageName() { ... }`
- Hooks: `useState`, `useEffect`, `useNavigate` from react-router-dom
- MUI imports: individual imports from `@mui/material` (Box, Typography, etc.)
- MUI v9 Grid: use `size={{ xs: 12, md: 6 }}` — NOT `xs={12} md={6}`

## Theme
- Dark mode, Inter font family
- Primary: indigo (#6366F1), Secondary: cyan (#22D3EE)
- Custom theme at `src/theme/index.ts` using `createTheme()`

## Routing (`App.tsx`)
- `<BrowserRouter>` wrapping `<Routes>` with `<Route>` children
- AppShell layout component for authenticated routes
- Login page at `/login`, default redirect to `/search`

## API Layer (`src/api/`)
- Plain `fetch()` calls to `/api/...` — no axios, no react-query
- Pattern: `async function listItems(): Promise<Item[]>`
- Response shape: `{ data: T }` or `{ data: T[] }`

## Directory Structure
```
src/
  App.tsx, main.tsx
  api/           — fetch wrappers per domain
  components/    — AppShell, shared, domain-specific
  pages/         — one file per page/view
  theme/         — MUI createTheme config
```

## Testing
- Vitest for unit tests, Playwright for E2E
- E2E tests in `tests/` directory
EOF
ok "04-react-admin.md"

# ── Rule 05: Database ────────────────────────────────────────────────────────
log "05-database.md"
cat > .agent/rules/05-database.md << 'EOF'
# Database Standards (Drizzle ORM + PostgreSQL)

## Schema Location
All schema files in `apps/rosmarium-server/src/db/schema/`

## Table Definition Pattern
```typescript
import { pgTable, text, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const myTable = pgTable("my_table", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  // ... content fields
}, (table) => ({
  myIdx: index("my_table_my_idx").on(table.someColumn),
}));

export type MyTable = typeof myTable.$inferSelect;
export type NewMyTable = typeof myTable.$inferInsert;
```

## Naming Conventions
- Table names: snake_case plural (`content_types`, `graph_edges`)
- Column names: snake_case in SQL, camelCase in TypeScript
- Index names: `{table}_{column}_idx`
- Foreign keys: `.references(() => otherTable.id, { onDelete: "cascade" })`

## Migration Rules
- Generate: `pnpm db:generate` (runs drizzle-kit generate)
- Apply: `pnpm db:migrate` (runs drizzle-kit migrate)
- ALWAYS show migration SQL diff before applying — never auto-run
- Never `ALTER COLUMN` type on table with data — add new column, migrate, drop old
- Use `CREATE INDEX CONCURRENTLY` for large tables
- pgvector HNSW params: `m=16, ef_construction=64`

## Multi-Tenancy
- Tenant isolation via PostgreSQL `search_path` schema: `tenant_{slug},public`
- AsyncLocalStorage<string> stores tenant slug per request
- DB connection uses Proxy to set `search_path` per query
- Connection: `postgres` (postgres.js driver) + `drizzle-orm/postgres-js`

## Content Storage
- Content types: `fields` column is JSONB array of field definitions
- Content entries: `data` column is JSONB (schema-less, validated at app layer)
- AI metadata: `content_entries.metadata->'ai'` via JSONB merge (GIN indexed)
- Search vector: `search_vector tsvector GENERATED ALWAYS AS` column
EOF
ok "05-database.md"

# ── Rule 06: GraphQL ─────────────────────────────────────────────────────────
log "06-graphql.md"
cat > .agent/rules/06-graphql.md << 'EOF'
# GraphQL Standards (graphql-yoga + Pothos)

## Stack (IMPORTANT — NOT Mercurius)
- graphql-yoga v5 — HTTP + WebSocket server
- @pothos/core v4 — code-first schema builder
- Pothos plugins: RelayPlugin, ValidationPlugin, WithInputPlugin
- graphql-ws v6 — WebSocket subscriptions

## Schema Builder (`src/graphql/builder.ts`)
```typescript
export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  Objects: { ContentType; ContentEntry; ... };
  Scalars: { DateTime: { Input: Date; Output: Date }; JSON: { Input: unknown; Output: unknown } };
}>({ plugins: [RelayPlugin, ValidationPlugin, WithInputPlugin], relay: {} });
```

## Import Order (CRITICAL — Pothos requires registration order)
```typescript
import { builder } from "./builder.js";
import "./scalars.js";
import "./types/common.js";
import "./types/content-type.js";
import "./types/content-entry.js";
import "./types/pagination.js";
import "./queries/content-types.js";
import "./queries/content-entries.js";
import "./mutations/content-types.js";
import "./mutations/content-entries.js";
import "./subscriptions/content.js";
```

## Context (`src/graphql/context.ts`)
- Auth via session cookie (Lucia) OR Bearer API key
- Includes: `user`, `dataloaders`, `pubsub`, `requestId`
- PubSub channels: `entry.created.${contentType}`, `entry.updated.${contentType}`, `entry.deleted.${contentType}`

## Integration
- Registered as Fastify plugin via `fp()` from `fastify-plugin`
- Route: `/graphql` (GET, POST, OPTIONS)
- GraphiQL enabled in non-production (`NODE_ENV !== "production"`)

## Never
- Never use Mercurius — this project uses graphql-yoga
- Never register Pothos types after building the schema
- Never query DB directly from resolvers — use DataLoaders or service layer
EOF
ok "06-graphql.md"

# ── Rule 07: Git Workflow ────────────────────────────────────────────────────
log "07-git-workflow.md"
cat > .agent/rules/07-git-workflow.md << 'EOF'
# Git Workflow

## Commit Messages (Conventional Commits)
Format: `<type>(<scope>): <description>`

Types: feat | fix | chore | docs | test | refactor | perf | ci
Scopes: server | admin | ai-worker | cli | types | sdk | deploy | docs | infra

Examples:
- `feat(server): add workflow state machine engine`
- `feat(ai-worker): implement content generation pipeline`
- `fix(admin): correct MUI v9 Grid size prop usage`
- `chore(deploy): update Helm chart for edge worker`

## Agent Behavior
- Write descriptive commit messages following the convention above
- Group related changes in a single commit — don't commit every file separately
- Run `pnpm typecheck && pnpm lint && pnpm test` before committing
- Breaking API changes require `BREAKING CHANGE:` footer and version bump
- Update CHANGELOG.md for any user-facing changes
EOF
ok "07-git-workflow.md"

# ── Rule 08: Security ────────────────────────────────────────────────────────
log "08-security.md"
cat > .agent/rules/08-security.md << 'EOF'
# Security Rules

## Terminal Command Safety
- ALWAYS require human approval before: `rm -rf`, `DROP TABLE`, `DELETE FROM`, any `sudo` command
- NEVER run database migrations without showing the migration diff first
- NEVER commit `.env` files, API keys, secrets, or credentials
- NEVER log request bodies that may contain passwords, tokens, or PII

## API Security
- All external endpoints require authentication — no unauthenticated write endpoints
- Validate ALL user input with Zod (TS) or Pydantic (Python) before processing
- Rate limiting on all public endpoints via Fastify rate-limit plugin
- HMAC-SHA256 signing on all webhook deliveries
- API keys stored as SHA-256 hashes, never plaintext

## Auth Implementation
- Lucia v3 for session auth — Argon2id password hashing
- API key auth with scoped permissions and expiry
- Timing-attack protection on login (dummy hash for unknown emails)
- RBAC middleware: `requireAuth()`, `requirePermission(PERMISSIONS.X)`

## Secrets Management
- Secrets in environment variables only — never in code, config files, or database
- Reference `.env.example` for required variables — never create actual `.env` files
- AI provider API keys (OpenAI, Cohere) masked in all logs

## Dependency Safety
- Flag any new dependency with <100 GitHub stars or last commit >1 year
- No dependencies with known critical CVEs — check before adding
EOF
ok "08-security.md"

# =============================================================================
# SKILLS (12 domain-specific skill directories)
# =============================================================================
head "Writing Skills (12 SKILL.md files)"

# ── Skill: content-engine ────────────────────────────────────────────────────
log "skills/content-engine/SKILL.md"
cat > .agent/skills/content-engine/SKILL.md << 'EOF'
---
name: content-engine
description: Expert knowledge for the Rosmarium content type system, field types, validation, and registry. Load when creating or modifying content types, field definitions, or content CRUD operations.
---
# Content Engine Skill

## Content Type System
Content types are defined at runtime via JSON field schemas stored in the `content_types` DB table.
The `ContentTypeRegistry` class (`src/modules/content/registry.ts`) loads all types into memory on startup.

## 13 Field Types (`src/modules/content/field-types.ts`)
| Type | Description | Validation |
|------|-------------|------------|
| `text` | String with optional min/maxLength | `typeof === "string"` |
| `richText` | Rich content (currently string, V2: BlockDocument) | `typeof === "string"` |
| `number` | Numeric with optional min/max/integer | `typeof === "number"` |
| `boolean` | True/false | `typeof === "boolean"` |
| `date` | Date string or Date object | string or Date |
| `datetime` | Datetime with timezone | string or Date |
| `media` | S3 asset reference | structural validation elsewhere |
| `relation` | Reference to another content type | `targetContentType` + `many` flag |
| `json` | Arbitrary JSON | any valid JSON |
| `select` | Enum dropdown | value in `options[]` |
| `slug` | URL-safe string, optionally generated from another field | `generatedFrom` field |
| `group` | Nested object with sub-fields (recursive) | validates each sub-field |
| `component` | Named component with `_component` identifier | validates against `allowedComponents` |
| `blocks` | Ordered array of components with min/max | validates each block item |

## Field Schema (Zod)
All fields extend `baseField`:
```typescript
const baseField = z.object({
  name: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),  // camelCase
  label: z.string().min(1),
  required: z.boolean().default(false),
  unique: z.boolean().default(false),
  localised: z.boolean().default(false),
});
```

## Content Entry Lifecycle
`draft` → `published` → `archived`
- On publish: auto-dispatches embedding + intelligence jobs (if `settings.aiIntelligence.enabled`)
- Events emitted: `content.created`, `content.updated`, `content.deleted`, `content.published`, `content.unpublished`

## Key Files
- Field types + validation: `apps/rosmarium-server/src/modules/content/field-types.ts`
- CRUD service: `apps/rosmarium-server/src/modules/content/crud.service.ts`
- Query builder: `apps/rosmarium-server/src/modules/content/query.builder.ts`
- Registry: `apps/rosmarium-server/src/modules/content/registry.ts`
- REST routes: `apps/rosmarium-server/src/routes/content/index.ts`
EOF
ok "skills/content-engine/SKILL.md"

# ── Skill: drizzle-schema ────────────────────────────────────────────────────
log "skills/drizzle-schema/SKILL.md"
cat > .agent/skills/drizzle-schema/SKILL.md << 'EOF'
---
name: drizzle-schema
description: Expert knowledge for Drizzle ORM schema definitions, relations, and migrations in Rosmarium. Load when creating or modifying database tables, indexes, or migrations.
---
# Drizzle ORM Schema Skill

## Schema Location
`apps/rosmarium-server/src/db/schema/` — one file per table or table group.

## Standard Table Pattern
```typescript
import { pgTable, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const articles = pgTable("articles", {
  id:        text("id").primaryKey().$defaultFn(() => createId()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  status:    text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  locale:    text("locale").notNull().default("en"),
  // Foreign keys
  userId:    text("user_id").references(() => users.id, { onDelete: "set null" }),
  // Content
  data:      jsonb("data"),
}, (table) => ({
  statusIdx: index("articles_status_idx").on(table.status),
  localeIdx: index("articles_locale_idx").on(table.locale),
}));

// ALWAYS export inferred types
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
```

## Existing Tables (11)
users, sessions, api_keys, tenants, content_types, content_entries, audit_log, webhooks, webhook_deliveries, graph_edges, graph_entity_nodes, entry_entity_mentions

## Connection Pattern
- Driver: `postgres` (postgres.js) + `drizzle-orm/postgres-js`
- Multi-tenant: AsyncLocalStorage<string> Proxy sets `search_path` per query
- Location: `apps/rosmarium-server/src/db/index.ts`

## Migration Commands
```bash
pnpm db:generate   # Generate migration SQL from schema changes
pnpm db:migrate    # Apply pending migrations
```

## Rules
- pgvector HNSW index params: `m=16, ef_construction=64`
- Never ALTER COLUMN type on table with data — add new, migrate, drop old
- Always use CREATE INDEX CONCURRENTLY for existing large tables
- Migration naming: auto-generated by drizzle-kit or custom (e.g., `0007_graph_data_model.sql`)
EOF
ok "skills/drizzle-schema/SKILL.md"

# ── Skill: pothos-graphql ────────────────────────────────────────────────────
log "skills/pothos-graphql/SKILL.md"
cat > .agent/skills/pothos-graphql/SKILL.md << 'EOF'
---
name: pothos-graphql
description: Expert knowledge for Pothos code-first GraphQL schema with graphql-yoga in rosmarium-server. Load when creating GraphQL types, resolvers, queries, mutations, or subscriptions.
---
# Pothos GraphQL Skill

## Stack
- graphql-yoga v5 (server) — NOT Mercurius
- @pothos/core v4 (schema builder)
- Plugins: RelayPlugin (cursor pagination), ValidationPlugin, WithInputPlugin
- graphql-ws v6 (WebSocket subscriptions)

## Schema Builder Setup
```typescript
import SchemaBuilder from "@pothos/core";
import RelayPlugin from "@pothos/plugin-relay";
import ValidationPlugin from "@pothos/plugin-validation";
import WithInputPlugin from "@pothos/plugin-with-input";

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
    JSON: { Input: unknown; Output: unknown };
  };
}>({ plugins: [RelayPlugin, ValidationPlugin, WithInputPlugin], relay: {} });
```

## CRITICAL: Import Order
Pothos requires types to be registered before they are referenced. In `graphql/index.ts`:
```
scalars → types/common → types/content-type → types/content-entry → types/pagination
→ queries → mutations → subscriptions
```

## Subscription Pattern
```typescript
builder.subscriptionField("onEntryCreated", (t) =>
  t.field({
    type: ContentEntryType,
    args: { contentType: t.arg.string({ required: false }) },
    subscribe: (_, args, ctx) =>
      ctx.pubsub.subscribe(`entry.created.${args.contentType ?? "*"}`),
    resolve: (payload) => payload,
  })
);
```

## Key Files
- Builder: `apps/rosmarium-server/src/graphql/builder.ts`
- Context: `apps/rosmarium-server/src/graphql/context.ts`
- Index: `apps/rosmarium-server/src/graphql/index.ts`
- Types: `apps/rosmarium-server/src/graphql/types/`
- Queries: `apps/rosmarium-server/src/graphql/queries/`
- Mutations: `apps/rosmarium-server/src/graphql/mutations/`
- Subscriptions: `apps/rosmarium-server/src/graphql/subscriptions/`
EOF
ok "skills/pothos-graphql/SKILL.md"

# ── Skill: pgvector-search ───────────────────────────────────────────────────
log "skills/pgvector-search/SKILL.md"
cat > .agent/skills/pgvector-search/SKILL.md << 'EOF'
---
name: pgvector-search
description: Expert knowledge for pgvector operations, hybrid BM25+vector search, and RRF fusion in Rosmarium. Load when working with vector search, embedding storage, or the search API.
---
# pgvector + Hybrid Search Skill

## Architecture
- Embedding tables created dynamically per content type: `rosmarium_{type}_embeddings`
- Search combines BM25 (tsvector) + pgvector (cosine) via Reciprocal Rank Fusion
- Alpha slider: 0 = fulltext only, 1 = vector only, 0.5 = balanced

## Hybrid Search Flow
1. User query → `GET /api/search?q=...&alpha=0.5`
2. Server calls AI worker for query embedding: `POST /search/embed`
3. Parallel: BM25 fulltext (`ts_rank_cd` + `ts_headline`) + pgvector cosine (`<=>` operator)
4. RRF fusion merges ranked lists
5. RBAC filtering: draft entries hidden from viewers

## Key Modules
- `apps/rosmarium-server/src/modules/search/fulltext.search.ts` — BM25 via tsvector
- `apps/rosmarium-server/src/modules/search/vector.search.ts` — pgvector cosine similarity
- `apps/rosmarium-server/src/modules/search/rrf.ts` — Reciprocal Rank Fusion algorithm
- `apps/rosmarium-server/src/modules/search/search.service.ts` — orchestrator
- `apps/rosmarium-server/src/modules/search/ai-worker.client.ts` — HTTP client to AI worker

## Graceful Degradation
- If AI worker unreachable: search falls back to BM25 fulltext only
- If embedding table doesn't exist (42P01): vector search returns empty array
- 5-second AbortController timeout on AI worker requests

## HNSW Index Parameters
```sql
CREATE INDEX CONCURRENTLY ON rosmarium_{type}_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```
- Good to ~5M vectors per type
- Above 5M: consider partitioning or dedicated vector DB

## Performance Targets
- Embedding query: <50ms for top-10 at 1M vectors
- Hybrid search e2e: <200ms
- If latency exceeds thresholds: increase `ef_search` at query time
EOF
ok "skills/pgvector-search/SKILL.md"

# ── Skill: rag-pipeline ──────────────────────────────────────────────────────
log "skills/rag-pipeline/SKILL.md"
cat > .agent/skills/rag-pipeline/SKILL.md << 'EOF'
---
name: rag-pipeline
description: Expert knowledge for RAG pipeline in rosmarium-ai-worker using LlamaIndex, spaCy chunking, and streaming. Load when working on retrieval, chunking, re-ranking, or RAG endpoints.
---
# RAG Pipeline Skill

## Architecture
- LlamaIndex for retrieval orchestration
- spaCy for chunking (sentencizer, section-aware)
- Optional Cohere rerank for quality improvement
- RBAC-aware: only returns content the requesting user can access

## Chunking Strategies (`src/rosmarium_ai_worker/chunking/`)
| Strategy | Use When | Config |
|----------|----------|--------|
| `sentence` | Medium content (200-1000 tokens) | `SentenceChunker` via spaCy sentencizer |
| `section` | Long content with headings (>1000 tokens) | `SectionChunker` — heading-aware |
| `fixed` | Default / backwards compatible | `FixedSizeChunker` — 512 tokens, 50 overlap |

Factory: `get_chunker(strategy)` in chunking module

## Chunk Metadata (always required)
```python
chunk_metadata = {
    "source_id": content_id,        # Content entry ID
    "content_type": content_type,   # e.g., "article"
    "field_name": field_name,       # e.g., "body"
    "locale": locale,               # e.g., "en"
    "chunk_index": i,               # Position in document
    "parent_heading": heading,      # Nearest heading (if available)
    "published_at": published_at,   # For freshness scoring
}
```

## RAG Pipeline (`src/rosmarium_ai_worker/rag/`)
1. Parallel multi-type retrieval across content types
2. RBAC filtering (CONTENT_READ_ANY vs CONTENT_READ_OWN)
3. Freshness scoring (boost recent content)
4. Optional Cohere rerank (graceful fallback if unavailable)
5. ContextFormatter: token-budgeted LLM context string

## Endpoints
- `POST /rag/retrieve` — JSON response
- `POST /rag/retrieve/stream` — SSE streaming response
- Server proxies: `POST /api/rag/retrieve` (JSON + SSE)
EOF
ok "skills/rag-pipeline/SKILL.md"

# ── Skill: knowledge-graph ───────────────────────────────────────────────────
log "skills/knowledge-graph/SKILL.md"
cat > .agent/skills/knowledge-graph/SKILL.md << 'EOF'
---
name: knowledge-graph
description: Expert knowledge for the Rosmarium knowledge graph — edge model, traversal engine, Cypher-lite parser, analytics, and export. Load when working on graph edges, traversal, or analytics features.
---
# Knowledge Graph Skill

## Data Model
Three tables in `src/db/schema/`:
- `graph_edges` — typed relationships between content entries (weight, source, acceptance status)
- `graph_entity_nodes` — named entities extracted via NER (text, canonical, type, embedding, mentions)
- `entry_entity_mentions` — junction linking entries to entities (confidence score)

## Edge Sources
| Source | Description |
|--------|-------------|
| `manual` | User-created via UI or API |
| `auto_ner` | NER co-mention inference (entities appearing in multiple entries) |
| `auto_similarity` | pgvector cosine similarity above threshold |
| `auto_reference` | Wiki-link parsing (`[[slug]]` markdown references) |
| `api` | External API integration |

## Edge Acceptance: `pending` → `accepted` | `rejected` (for AI-generated edges)

## Traversal Engine (`src/modules/graph/traversal/`)
- Multi-hop traversal via PostgreSQL recursive CTEs
- Cypher-lite DSL parser: `(a:Article)-[r:relatedTo*1..3]->(b:Article)`
- Path finding between two entries
- Recommendation engine (structural + semantic scores)

## Analytics (Python — NetworkX)
- PageRank, betweenness centrality
- Community detection (Louvain)
- HITS hub/authority scoring
- Computed via `POST /api/graph/analytics/compute`

## Export Formats
`GET /api/graph/export?format=jsonld|rdf|graphml|cytoscape`

## REST API
- Edge CRUD: `/api/graph` (POST, GET, PATCH, DELETE)
- Traversal: `/api/graph/traverse`, `/api/graph/neighbors`, `/api/graph/path`, `/api/graph/recommend`
- Analytics: `/api/graph/communities/:type`, `/api/graph/influential/:type`
EOF
ok "skills/knowledge-graph/SKILL.md"

# ── Skill: fastify-server ────────────────────────────────────────────────────
log "skills/fastify-server/SKILL.md"
cat > .agent/skills/fastify-server/SKILL.md << 'EOF'
---
name: fastify-server
description: Expert knowledge for Fastify server patterns in rosmarium-server — plugin registration, route handlers, middleware, and app bootstrap. Load when creating new routes, plugins, or middleware.
---
# Fastify Server Skill

## App Bootstrap (`src/app.ts`)
```typescript
export async function buildApp() {
    const app = Fastify({ logger: { ... } });
    // 1. Tenant middleware (X-Tenant-Id header → AsyncLocalStorage)
    app.addHook("onRequest", tenantMiddleware);
    app.addHook("onRequest", tenantStorageHook);
    // 2. Plugins (cors, helmet, rate-limit, swagger, cookie, sensible)
    await registerPlugins(app);
    // 3. Content type registry load
    await registry.load();
    // 4. Observability
    // 5. GraphQL (yoga + Pothos)
    // 6. REST routes
    await registerRoutes(app);
    // 7. Event bridges
}
```

## Plugin Pattern (`src/plugins/`)
```typescript
import fp from "fastify-plugin";
export default fp(async (app) => {
  await app.register(somePlugin, { options });
});
```

## Route Pattern (`src/routes/`)
```typescript
import type { FastifyPluginAsync } from "fastify";
const myRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/resource", {
    preHandler: [requireAuth(), requirePermission(PERMISSIONS.RESOURCE_READ)],
    schema: { querystring: zodSchema, response: { 200: responseSchema } },
  }, async (request, reply) => {
    const result = await myService.findMany(request.query);
    return reply.send({ data: result });
  });
};
export default myRoutes;
```

## Middleware
- Auth: `requireAuth()` — validates session cookie or API key Bearer token
- RBAC: `requirePermission(PERMISSIONS.X)` — checks user role against permission string
- Tenant: `tenantMiddleware` — extracts X-Tenant-Id, sets AsyncLocalStorage

## Key Files
- Entry: `src/index.ts` (imports observability FIRST, then app)
- App builder: `src/app.ts`
- Config: `src/config.ts` (Zod-parsed env vars)
- Plugins: `src/plugins/index.ts`
- Routes: `src/routes/index.ts`
- Events: `src/lib/events.ts`
EOF
ok "skills/fastify-server/SKILL.md"

# ── Skill: admin-ui ──────────────────────────────────────────────────────────
log "skills/admin-ui/SKILL.md"
cat > .agent/skills/admin-ui/SKILL.md << 'EOF'
---
name: admin-ui
description: Expert knowledge for rosmarium-admin React/MUI v9 patterns. Load when creating or modifying admin UI pages, components, or theme.
---
# Admin UI Skill

## Key Patterns

### Page Component
```tsx
import { useState, useEffect } from "react";
import { Box, Typography, Paper, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";

export function MyPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<MyType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/my-resource")
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CircularProgress />;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>My Page</Typography>
      {/* content */}
    </Box>
  );
}
```

### MUI v9 Grid (IMPORTANT)
```tsx
// ✅ CORRECT (v9)
<Grid container spacing={2}>
  <Grid size={{ xs: 12, md: 6 }}>{/* content */}</Grid>
</Grid>

// ❌ WRONG (v5/v6 syntax)
<Grid container spacing={2}>
  <Grid item xs={12} md={6}>{/* content */}</Grid>
</Grid>
```

### Theme
Located at `src/theme/index.ts`. Dark mode. Colors:
- Primary: `#6366F1` (indigo)
- Secondary: `#22D3EE` (cyan)
- Font: Inter

### Routing
BrowserRouter with nested Routes. AppShell layout component wraps authenticated routes.
Login at `/login`, default redirect to `/search`.

### Existing Pages
Search, AI Dashboard, Knowledge Graph, Content List, Content Editor, Media Library,
Settings (Content Type Builder, Webhooks, Access Control), Login
EOF
ok "skills/admin-ui/SKILL.md"

# ── Skill: ai-intelligence ───────────────────────────────────────────────────
log "skills/ai-intelligence/SKILL.md"
cat > .agent/skills/ai-intelligence/SKILL.md << 'EOF'
---
name: ai-intelligence
description: Expert knowledge for the AI intelligence pipeline — embedding, NER, tagging, summarization, duplicate detection. Load when working on AI features in rosmarium-ai-worker or intelligence endpoints.
---
# AI Intelligence Skill

## Pipeline Components (`apps/rosmarium-ai-worker/src/rosmarium_ai_worker/intelligence/`)
| Component | Model | Description |
|-----------|-------|-------------|
| `AutoTagger` | HuggingFace zero-shot (cross-encoder NLI) | Label taxonomy configurable per content type |
| `NERExtractor` | spaCy `en_core_web_sm` | Entities: PERSON, ORG, GPE, DATE, PRODUCT, EVENT, etc. |
| `ContentSummarizer` | Ollama LLM | Styles: brief, detailed, bullet. Extractive fallback when Ollama down. |
| `DuplicateDetector` | pgvector cosine similarity | Configurable threshold; batch processing |

## Intelligence Job Flow
1. Content published → `content.published` event fires
2. Server dispatches BullMQ `analyse-content` job (if `settings.aiIntelligence.enabled`)
3. AI worker's `intelligence_worker` processes: tag → NER → summarize → detect duplicates
4. Results stored in `content_entries.metadata->'ai'` via JSONB merge
5. Graph inference follows: NER co-mention → semantic similarity → reference parsing

## Embedding Providers (`apps/rosmarium-ai-worker/src/rosmarium_ai_worker/embedding/`)
- Abstract base: `EmbeddingProvider` ABC with `embed()`, `embed_batch()`, `health_check()`
- Implementations: `OllamaProvider`, `OpenAIProvider`, `CohereProvider`
- Registry: `init_embedding_provider()` / `get_provider()` — singleton pattern
- CohereProvider overrides `input_type` for search_query vs search_document

## Key Server Files
- `apps/rosmarium-server/src/modules/intelligence/intelligence.service.ts` — orchestration
- `apps/rosmarium-server/src/modules/intelligence/intelligence.client.ts` — HTTP client to AI worker
- `apps/rosmarium-server/src/modules/jobs/intelligence.jobs.ts` — BullMQ dispatch + queue stats

## Endpoints
- Server: `POST /api/content/:type/:id/tag|summarize`, `GET .../entities|duplicates`
- Worker: `POST /intelligence/tag|ner|summarize|find-duplicates`
- Admin: `GET /api/admin/queue-stats` — live BullMQ stats
EOF
ok "skills/ai-intelligence/SKILL.md"

# ── Skill: block-editor (V2) ─────────────────────────────────────────────────
log "skills/block-editor/SKILL.md"
cat > .agent/skills/block-editor/SKILL.md << 'EOF'
---
name: block-editor
description: "V2 ROADMAP: Expert knowledge for the structured rich text block editor (Tiptap/ProseMirror). Load when implementing Phase 1 of roadmapV2.md — BlockDocument model, editor integration, serialization."
---
# Block Editor Skill (V2 — Phase 1)

## Context
V1 stores richText as a plain string. V2 replaces this with a structured BlockDocument
format for AI consumption, omnichannel delivery, and collaborative editing.

## Target Architecture
- **Editor**: Tiptap v2 (ProseMirror-based) in rosmarium-admin
- **Storage**: BlockDocument JSON in content_entries.data
- **Serialization**: Server-side to HTML, Markdown, plaintext, AMP
- **Backward Compat**: Existing string richText auto-detected and rendered

## BlockDocument Schema (packages/types)
```typescript
interface BlockDocument {
  version: 1;
  blocks: Block[];
}

type Block = ParagraphBlock | HeadingBlock | ImageBlock | CodeBlock
           | QuoteBlock | ListBlock | TableBlock | EmbedBlock
           | DividerBlock | ComponentBlock;

interface ParagraphBlock {
  type: "paragraph";
  id: string;           // UUID for CRDT addressing
  children: InlineNode[];
}

interface InlineNode {
  type: "text" | "link" | "mention" | "inline-code";
  text: string;
  marks?: Mark[];  // bold, italic, underline, strikethrough, code
}
```

## Key Implementation Files
- Type defs: `packages/types/src/block-document.ts` [NEW]
- Field types update: `apps/rosmarium-server/src/modules/content/field-types.ts` [MODIFY]
- Serializer: `apps/rosmarium-server/src/modules/content/block-serializer.ts` [NEW]
- Editor: `apps/rosmarium-admin/src/components/editor/BlockEditor.tsx` [NEW]
- Extensions: `apps/rosmarium-admin/src/components/editor/extensions/` [NEW]

## Acceptance Criteria
See roadmapV2.md Phase 1, Month 1 for full acceptance criteria.
EOF
ok "skills/block-editor/SKILL.md"

# ── Skill: workflow-engine (V2) ──────────────────────────────────────────────
log "skills/workflow-engine/SKILL.md"
cat > .agent/skills/workflow-engine/SKILL.md << 'EOF'
---
name: workflow-engine
description: "V2 ROADMAP: Expert knowledge for the workflow automation engine — state machines, transitions, approval chains. Load when implementing Phase 2 of roadmapV2.md."
---
# Workflow Engine Skill (V2 — Phase 2)

## Context
V1 has only publish/unpublish lifecycle. V2 adds a configurable workflow engine
supporting custom states, transitions, and approval chains.

## Target Architecture
```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  contentTypes: string[];
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  initialState: string;
  publishedState: string;
}

interface WorkflowTransition {
  from: string;
  to: string;
  label: string;
  requiredRole: string;
  requireComment: boolean;
  autoAssign?: string;
  webhookEvent?: string;
}
```

## Database Tables [NEW]
- `workflows` — definition storage (JSONB `definition` column)
- `workflow_history` — full audit trail of state transitions
- `workflow_assignments` — entry → user assignment per state

## Default Workflow
`draft` → `in_review` → `approved` → `published` → `archived`

## Integration Points
- Content CRUD service: integrate workflow state into lifecycle
- Webhook events fired on transitions
- RBAC: transition permissions per role
- Admin UI: visual workflow builder + timeline component

## Key Implementation Files
See roadmapV2.md Phase 2, Month 4 for detailed specifications.
EOF
ok "skills/workflow-engine/SKILL.md"

# ── Skill: plugin-system (V2) ────────────────────────────────────────────────
log "skills/plugin-system/SKILL.md"
cat > .agent/skills/plugin-system/SKILL.md << 'EOF'
---
name: plugin-system
description: "V2 ROADMAP: Expert knowledge for the hook-based plugin/extension system. Load when implementing Phase 3 of roadmapV2.md — plugin architecture, hook engine, admin UI extensions."
---
# Plugin System Skill (V2 — Phase 3)

## Context
V1 has no formal plugin system. V2 adds a hook-based architecture allowing
third-party extensions to modify content lifecycle, add API routes, register
field types, and extend the admin UI.

## Plugin Interface
```typescript
interface RosmariumPlugin {
  name: string;
  version: string;
  hooks?: {
    "content:beforeCreate"?: (ctx: HookContext) => Promise<void>;
    "content:afterCreate"?: (ctx: HookContext) => Promise<void>;
    "content:beforePublish"?: (ctx: HookContext) => Promise<void>;
    "content:afterPublish"?: (ctx: HookContext) => Promise<void>;
    "workflow:beforeTransition"?: (ctx: WorkflowHookContext) => Promise<void>;
    // ... more hooks
  };
  routes?: (fastify: FastifyInstance) => void;
  fieldTypes?: CustomFieldType[];
  graphql?: { types, queries, mutations };
  adminUI?: { pages, widgets, fieldEditors };
}
```

## Loading
- Plugins discovered from `rosmarium.config.ts` at project root
- Loaded from npm packages or local file paths
- Hook engine with priority ordering (0-100) and error isolation

## Key Implementation Files
See roadmapV2.md Phase 3, Month 7 for detailed specifications.
EOF
ok "skills/plugin-system/SKILL.md"

# =============================================================================
# WORKFLOWS (6 files — slash-command playbooks)
# =============================================================================
head "Writing Workflows (6 files)"

# ── Workflow: new-content-type ────────────────────────────────────────────────
log "new-content-type.md"
cat > .agent/workflows/new-content-type.md << 'EOF'
# Workflow: Create New Content Type

Triggered by: /new-content-type

## Steps

1. **Gather requirements** — Ask the user:
   - Content type name (singular, camelCase)?
   - Fields needed? (name, type, required, unique, localised?)
   - Enable AI intelligence? (auto-tagging, NER, summarization on publish)
   - Relations to existing types?

2. **Validate** — Check `apps/rosmarium-server/src/modules/content/field-types.ts` for allowed field types:
   text, richText, number, boolean, date, datetime, media, relation, json, select, slug, group, component, blocks

3. **Create via API** — Use the Content Type CRUD API (runtime-defined, stored in DB):
   ```
   POST /api/content-types
   { "name": "article", "displayName": "Article", "fields": [...], "settings": { "aiIntelligence": { "enabled": true } } }
   ```
   OR register programmatically via the ContentTypeRegistry.

4. **Verify** — Check registry loaded:
   ```
   GET /api/content-types
   ```

5. **If AI intelligence enabled** — Verify embedding table will be auto-created on first publish.

6. **Admin UI** — Verify content type appears in admin Content Type Builder.

7. **Test** — Create a test entry, publish it, verify intelligence jobs dispatch.

8. **Commit**: `feat(server): add <TypeName> content type`
EOF
ok "new-content-type.md"

# ── Workflow: add-ai-intelligence ─────────────────────────────────────────────
log "add-ai-intelligence.md"
cat > .agent/workflows/add-ai-intelligence.md << 'EOF'
# Workflow: Enable AI Intelligence for Content Type

Triggered by: /add-ai-intelligence

## Steps

1. **Identify target** — Ask: which content type? Which fields to embed? (title, body, both?)

2. **Enable intelligence** — Update content type settings:
   ```
   PATCH /api/content-types/:name
   { "settings": { "aiIntelligence": { "enabled": true } } }
   ```

3. **Verify prerequisites**:
   - pgvector extension enabled: `SELECT * FROM pg_extension WHERE extname = 'vector'`
   - AI worker running: `curl http://localhost:8001/health`
   - Embedding provider configured: check `EMBEDDING_PROVIDER` env var

4. **Test pipeline** — Publish a content entry and verify:
   - Embedding job dispatched (check `/api/admin/queue-stats`)
   - Intelligence job dispatched (tagging, NER, summarization)
   - Results appear in entry `metadata.ai`
   - Graph edges inferred (NER co-mention, similarity, references)

5. **Backfill** — Ask user: run intelligence on existing published entries?
   If yes, dispatch bulk jobs via queue.

6. **Verify search** — Run hybrid search:
   ```
   GET /api/search?q=test+query&alpha=0.5
   ```

7. **Commit**: `feat(server): enable AI intelligence for <TypeName>`
EOF
ok "add-ai-intelligence.md"

# ── Workflow: db-migrate ──────────────────────────────────────────────────────
log "db-migrate.md"
cat > .agent/workflows/db-migrate.md << 'EOF'
# Workflow: Database Migration

Triggered by: /db-migrate

## Steps

1. **Update schema** — Modify files in `apps/rosmarium-server/src/db/schema/`

2. **Generate migration**:
   ```bash
   pnpm db:generate
   ```

3. **ALWAYS show the full migration SQL diff** before proceeding:
   ```bash
   cat apps/rosmarium-server/src/db/migrations/<latest>.sql
   ```

4. **Check for destructive operations**:
   - Any `DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN` type change? → Require explicit confirmation
   - Any operation on table with >10K rows? → Recommend `CONCURRENTLY` and maintenance window
   - Any pgvector index changes? → Require explicit approval

5. **Apply migration** (only after user confirms):
   ```bash
   pnpm db:migrate
   ```

6. **Verify** — Run typecheck to ensure schema types match:
   ```bash
   pnpm typecheck
   ```

7. **Commit**: `chore(server): add migration <description>`

## Safety Rules
- Never run against production without backup confirmation
- Always test on dev database first
- pgvector index creation uses CREATE INDEX CONCURRENTLY
EOF
ok "db-migrate.md"

# ── Workflow: v2-feature ──────────────────────────────────────────────────────
log "v2-feature.md"
cat > .agent/workflows/v2-feature.md << 'EOF'
# Workflow: Implement V2 Roadmap Feature

Triggered by: /v2-feature

## Steps

1. **Read roadmapV2.md** — Identify the specific phase, month, and task.

2. **Check dependencies** — Verify prerequisite tasks are complete (see dependency graph in roadmapV2.md).

3. **Create implementation plan** — Generate as artifact:
   - Files to create/modify (from roadmapV2.md implementation tables)
   - Database schema changes (if any)
   - API endpoints to add
   - Admin UI components
   - Test plan

4. **Get approval** — Present plan to user before coding.

5. **Implement** — Follow the task specification in roadmapV2.md:
   - Create/modify files per implementation table
   - Follow acceptance criteria checklist
   - Write tests (minimum count specified per task)

6. **Verify** — Run full verification:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   cd apps/rosmarium-ai-worker && mypy src/ && ruff check src/ && python -m pytest
   ```

7. **Update docs** — If API changed, update `apps/rosmarium-www/src/content/docs/`

8. **Update PHASE.md** — Mark task as complete

9. **Commit**: `feat(<scope>): <V2 feature description>`
EOF
ok "v2-feature.md"

# ── Workflow: phase-checkpoint ────────────────────────────────────────────────
log "phase-checkpoint.md"
cat > .agent/workflows/phase-checkpoint.md << 'EOF'
# Workflow: Phase Milestone Checkpoint

Triggered by: /phase-checkpoint

## Steps

1. **Read current phase** from `PHASE.md` and `roadmapV2.md`

2. **Check completion** — For each task in the current phase:
   - Does the feature exist? (search codebase)
   - Does it have tests? (check test files)
   - Does it meet acceptance criteria? (from roadmapV2.md)
   - Mark as ✅ complete, ⚠️ partial, or ❌ missing

3. **Generate checkpoint report** as markdown artifact:
   ```
   ## Phase [X] Checkpoint — [Date]
   ### Completed ✅
   ### Partial ⚠️ (needs work)
   ### Missing ❌
   ### Test Coverage Summary
   ### Blockers
   ### Recommended Next Actions
   ```

4. **Verify build health**:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   ```

5. **Ask user**: Update PHASE.md and advance to next phase?
EOF
ok "phase-checkpoint.md"

# ── Workflow: ship-it ─────────────────────────────────────────────────────────
log "ship-it.md"
cat > .agent/workflows/ship-it.md << 'EOF'
# Workflow: Prepare Release

Triggered by: /ship-it

## Steps

1. **Run full test suite**:
   ```bash
   pnpm test
   cd apps/rosmarium-ai-worker && python -m pytest
   ```
   Stop and report if any tests fail.

2. **Type check + Lint**:
   ```bash
   pnpm typecheck
   pnpm lint
   cd apps/rosmarium-ai-worker && mypy src/ && ruff check src/
   ```

3. **Build**:
   ```bash
   pnpm build
   ```

4. **Check CHANGELOG.md** — Confirm changelog is up to date for this version.

5. **Version bump** — Ask user for version (patch / minor / major).

6. **Build Docker images**:
   ```bash
   VERSION=$(node -p "require('./package.json').version")
   docker build -t ghcr.io/orchestrator-dev/rosmarium-server:$VERSION apps/rosmarium-server/
   docker build -t ghcr.io/orchestrator-dev/rosmarium-ai-worker:$VERSION apps/rosmarium-ai-worker/
   ```

7. **Tag and push**:
   ```bash
   git tag v$VERSION
   git push origin main --tags
   ```

8. Generate **release notes** artifact summarizing changes.
EOF
ok "ship-it.md"

# =============================================================================
# CURSOR RULES (.cursor/rules/ — .mdc files)
# =============================================================================
head "Writing Cursor Rules (4 .mdc files)"

cat > .cursor/rules/typescript.mdc << 'EOF'
---
description: TypeScript standards for Rosmarium server and packages
globs: ["apps/rosmarium-server/**/*.ts", "packages/**/*.ts"]
alwaysApply: true
---
- ESM with `.js` import extensions: `import { x } from "./module.js"`
- Strict mode, `noUncheckedIndexedAccess: true`
- No `any` — use `unknown` + type guards
- Services as object literals: `export const fooService = { async method() {} }`
- Zod for runtime validation. Custom error classes with `code` property.
- IDs: `text("id").primaryKey().$defaultFn(() => createId())` (cuid2)
- DB columns: camelCase in TS ↔ snake_case in SQL
- Tests: Vitest, co-located `*.test.ts`, `vi.hoisted()` + `vi.mock()`
EOF
ok ".cursor/rules/typescript.mdc"

cat > .cursor/rules/react-admin.mdc << 'EOF'
---
description: React and MUI v9 patterns for Rosmarium admin
globs: ["apps/rosmarium-admin/**/*.tsx", "apps/rosmarium-admin/**/*.ts"]
alwaysApply: false
---
- React 19, functional components only, named exports
- MUI v9: Grid uses `size={{ xs: 12, md: 6 }}` NOT `xs={12} md={6}`
- react-router-dom v7: BrowserRouter, Routes, Route, useNavigate
- Plain fetch() for API calls — no axios
- Theme: dark mode, Inter font, indigo primary, cyan secondary
EOF
ok ".cursor/rules/react-admin.mdc"

cat > .cursor/rules/python.mdc << 'EOF'
---
description: Python standards for Rosmarium AI worker
globs: ["apps/rosmarium-ai-worker/**/*.py"]
alwaysApply: false
---
- Python 3.12, FastAPI, Pydantic v2, asyncpg, structlog
- Type hints on all functions. mypy strict mode.
- Ruff for linting (line-length 100, target py312)
- Pydantic Settings for config. Never raw dicts for responses.
- BullMQ payloads use camelCase fields for wire compat.
- async/await throughout. Never mix sync/async.
EOF
ok ".cursor/rules/python.mdc"

cat > .cursor/rules/security.mdc << 'EOF'
---
description: Security rules for all Rosmarium code
globs: ["**/*"]
alwaysApply: true
---
- Never commit .env files, API keys, or secrets
- Never log passwords, tokens, or PII
- All endpoints require authentication — no unauthenticated writes
- Zod (TS) or Pydantic (Python) for ALL user input validation
- Show DB migration diffs before applying — never auto-run destructive ops
- API keys stored as SHA-256 hashes, never plaintext
EOF
ok ".cursor/rules/security.mdc"

# =============================================================================
# MASTER AGENT PROMPT
# =============================================================================
head "Writing Master Agent Prompt"

cat > .agent/MASTER_PROMPT.md << 'EOF'
# Rosmarium COS — Master Agent Prompt

Use this as the **opening mission prompt** when starting a new AI agent session.

---

```
You are working on Rosmarium COS — an open-source, AI-native headless Content Orchestration System.

BEFORE you do anything else:
1. Read PHASE.md to understand the current development phase and active milestone
2. Read roadmapV2.md for V2 planned features and architecture
3. Read .agent/rules/ — all rules apply to every task you perform
4. Check relevant skills in .agent/skills/ before working on specific domains

ARCHITECTURE:
- rosmarium-server (TypeScript/Fastify 4) = CMS API + GraphQL (graphql-yoga + Pothos) — port 3000
- rosmarium-admin (React 19/MUI v9) = Admin dashboard — port 5173
- rosmarium-ai-worker (Python/FastAPI) = AI pipeline — port 8001, internal only
- Communication: BullMQ queues (async) + HTTP (sync search/RAG)
- Database: PostgreSQL 16 + pgvector, Redis 7, S3 (MinIO)
- Multi-tenancy: X-Tenant-Id header → PostgreSQL search_path isolation

YOUR TASK:
[Insert specific task here]

DEFINITION OF DONE:
- Code follows language standards in .agent/rules/
- Tests written and passing (co-located *.test.ts for TS, tests/ dir for Python)
- Zero TypeScript errors (`pnpm typecheck`) and zero mypy errors
- Zero lint errors (`pnpm lint`, `ruff check`)
- Commit message follows conventional commits: feat|fix|chore(scope): description
- If new API endpoint: verify in OpenAPI spec (`/docs`) and test via curl/httpie
- If DB schema changed: migration generated, diff reviewed, applied
- If API contract changed: docs updated in apps/rosmarium-www/src/content/docs/

Generate an implementation plan first, wait for approval, then execute.
```
EOF
ok "MASTER_PROMPT.md"

# =============================================================================
# SUMMARY
# =============================================================================
head "Setup Complete"

echo ""
echo -e "${BOLD}Files created/updated:${RESET}"
echo ""

# Count files
AGENT_FILES=$(find .agent -type f | wc -l)
CURSOR_FILES=$(find .cursor -type f 2>/dev/null | wc -l)

find .agent -type f | sort | while read -r f; do
  echo -e "  ${GREEN}+${RESET} $f"
done

echo ""
echo -e "  ${GREEN}+${RESET} AGENT.md"
echo -e "  ${GREEN}+${RESET} AGENTS.md"
if [[ -L "CLAUDE.md" ]]; then
  echo -e "  ${GREEN}+${RESET} CLAUDE.md → AGENTS.md (symlink)"
fi
echo -e "  ${GREEN}+${RESET} .github/copilot-instructions.md"

find .cursor -type f 2>/dev/null | sort | while read -r f; do
  echo -e "  ${GREEN}+${RESET} $f"
done

echo ""
echo -e "${BOLD}Summary:${RESET}"
echo -e "  ${CYAN}AGENT.md${RESET}           — Antigravity primary context (updated)"
echo -e "  ${CYAN}AGENTS.md${RESET}          — Cross-tool standard (Claude, Copilot, Aider)"
echo -e "  ${CYAN}.agent/rules/${RESET}      — 8 always-on guardrail files"
echo -e "  ${CYAN}.agent/skills/${RESET}     — 12 domain-specific skills (9 current + 3 V2 roadmap)"
echo -e "  ${CYAN}.agent/workflows/${RESET}  — 6 slash-command workflow playbooks"
echo -e "  ${CYAN}.cursor/rules/${RESET}     — 4 Cursor IDE rule files"

echo ""
echo -e "${BOLD}Next steps:${RESET}"
echo -e "  1. ${CYAN}git add .agent/ .cursor/ .github/copilot-instructions.md AGENT.md AGENTS.md CLAUDE.md${RESET}"
echo -e "  2. ${CYAN}git commit -m 'chore: add comprehensive AI agent configuration for V2'${RESET}"
echo -e "  3. Use workflows: ${CYAN}/new-content-type${RESET}, ${CYAN}/add-ai-intelligence${RESET}, ${CYAN}/db-migrate${RESET}, ${CYAN}/v2-feature${RESET}, ${CYAN}/phase-checkpoint${RESET}, ${CYAN}/ship-it${RESET}"
echo ""
echo -e "${GREEN}${BOLD}Rosmarium COS AI agent configuration ready.${RESET}"
echo -e "Supports: Antigravity, Claude Code, Cursor, GitHub Copilot, Aider"
