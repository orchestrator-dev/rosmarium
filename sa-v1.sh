#!/usr/bin/env bash
# =============================================================================
# Cortex CMS — Antigravity IDE Configuration Setup
# =============================================================================
# Scaffolds the complete .agent/ directory inside your cortex-cms monorepo root.
# Run this script from the root of your cortex-cms repository:
#
#   chmod +x setup-agent.sh
#   ./setup-agent.sh
#
# This script creates:
#   .agent/rules/         (5 rule files — always-on guardrails)
#   .agent/workflows/     (5 workflow files — /slash-command playbooks)
#   .agent/skills/        (4 skill directories with SKILL.md files)
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'

log()  { echo -e "${CYAN}[cortex]${RESET} $*"; }
ok()   { echo -e "${GREEN}  ✓${RESET} $*"; }
head() { echo -e "\n${BOLD}${YELLOW}── $* ──${RESET}"; }

# ── Guard: must be run from monorepo root ────────────────────────────────────
if [[ ! -f "package.json" && ! -f "turbo.json" && ! -f "pnpm-workspace.yaml" ]]; then
  echo -e "${YELLOW}Warning:${RESET} No package.json / turbo.json / pnpm-workspace.yaml found."
  echo "Are you sure you're running this from the cortex-cms monorepo root?"
  read -rp "Continue anyway? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

# ── Create directory structure ───────────────────────────────────────────────
head "Creating .agent directory structure"

mkdir -p .agent/rules
mkdir -p .agent/workflows
mkdir -p .agent/skills/drizzle-schema
mkdir -p .agent/skills/fastify-plugin
mkdir -p .agent/skills/pothos-graphql
mkdir -p .agent/skills/pgvector-ops
mkdir -p .agent/skills/llamaindex-rag
mkdir -p .agent/skills/helm-k8s

ok "Directory structure created"

# =============================================================================
# RULES
# =============================================================================
head "Writing Rules (5 files)"

# ── Rule 01: Project Context ──────────────────────────────────────────────────
log "01-project-context.md"
cat > .agent/rules/01-project-context.md << 'EOF'
# Cortex CMS — Project Context

## What We're Building
Cortex CMS is an open-source, AI-native headless content repository.
Apache 2.0 license. Monorepo managed with Turborepo.

## Architecture: Pragmatic Polyglot
- `apps/cortex-server` — TypeScript / Node.js 22 / Fastify — CMS core API, GraphQL, auth, assets, admin UI
- `apps/cortex-admin` — TypeScript / React 19 — admin interface
- `apps/cortex-ai-worker` — Python 3.12 / FastAPI — AI pipeline (embeddings, RAG, chunking, graph analytics)
- `apps/cortex-cli` — Go 1.22 — developer CLI tool
- `packages/types` — shared TypeScript types
- `packages/sdk` — @cortex-cms/sdk client

## Shared Infrastructure
- PostgreSQL 16 + pgvector extension (primary datastore + vector store)
- Redis 7 / BullMQ (job queues, caching, sessions)
- S3-compatible object storage via @aws-sdk/client-s3

## Current Phase
[AGENT: check PHASE.md in repo root for current phase and active milestone before starting any task]

## Service Communication
- cortex-server → cortex-ai-worker: async via BullMQ Redis queues (embedding jobs, chunking, tagging)
- cortex-server → cortex-ai-worker: sync via internal HTTP on port 8001 (semantic search at query time)
- Both services share the same PostgreSQL instance and Redis instance

## Non-Negotiable Principles
1. Never break the REST or GraphQL API contract without a versioned migration path
2. All AI features are opt-in and can be disabled per content type
3. All configuration via environment variables — no secrets in code or config files
4. pgvector is the default vector store; Qdrant adapter is the scale-out path
5. S3 abstraction must work with any S3-compatible provider, not just AWS
EOF
ok "01-project-context.md"

# ── Rule 02: TypeScript Standards ────────────────────────────────────────────
log "02-typescript-standards.md"
cat > .agent/rules/02-typescript-standards.md << 'EOF'
# TypeScript / Node.js Standards (cortex-server + cortex-admin)

## Language & Runtime
- Node.js 22 LTS, TypeScript 5.x with strict mode enabled
- ESM modules throughout — no CommonJS
- `noUncheckedIndexedAccess: true` in tsconfig — handle all potential undefined

## Code Style
- Prettier for formatting (config in repo root)
- ESLint with @typescript-eslint/recommended + custom rules
- No `any` types — use `unknown` and narrow explicitly
- Prefer `const` over `let`; never `var`
- Async/await always — no raw Promise chains
- Zod for all runtime validation — never trust external input without parsing

## cortex-server Patterns
- All routes are Fastify plugins in `src/plugins/` — never define routes in index.ts
- Business logic lives in `src/modules/` — route handlers call module functions, no logic in handlers
- Drizzle ORM for all database access — no raw SQL strings except in migrations
- All database queries go through the module layer — never query from route handlers directly
- BullMQ job definitions in `src/modules/jobs/` — dispatch from modules, never from routes
- Zod schemas auto-generated from content type definitions in schema registry

## Error Handling
- All route handlers wrapped in try/catch — never let unhandled promise rejections propagate
- Use Fastify's error handling plugin — return structured `{ error: { code, message } }` responses
- Log errors with Pino — include `requestId` in every error log
- HTTP status codes: 400 for validation, 401 for unauth, 403 for forbidden, 404 for not found, 422 for business logic errors, 500 for unexpected

## Testing
- Vitest for unit tests, co-located with source files (`*.test.ts`)
- Fastify inject for route handler tests — no running server required
- Minimum 80% coverage for modules; 100% for auth and RBAC modules
- Test file naming: `<module>.test.ts` — never `<module>.spec.ts`

## Package Management
- pnpm workspaces — never npm or yarn in this repo
- All dependencies pinned to exact versions in production — no `^` or `~`
- Dev dependencies use `^` for minor updates
EOF
ok "02-typescript-standards.md"

# ── Rule 03: Python Standards ─────────────────────────────────────────────────
log "03-python-standards.md"
cat > .agent/rules/03-python-standards.md << 'EOF'
# Python Standards (cortex-ai-worker)

## Language & Runtime
- Python 3.12 — use new syntax (match statements, PEP 695 type aliases where supported)
- pyproject.toml for all project config (no setup.py, no requirements.txt)
- uv for package management (faster than pip, compatible lockfile)
- Ruff for linting and formatting (replaces flake8 + black + isort)

## Type Safety
- Full type hints on all public functions and class methods — mandatory
- Pydantic v2 models for all data structures that cross service boundaries
- mypy in strict mode — CI fails on type errors
- Never use `dict` as a return type when a Pydantic model can be used

## FastAPI Patterns
- All routes in `src/api/routes/` — one file per domain (embeddings, search, rag, health)
- Dependency injection for database connections, Redis clients, embedding providers
- Pydantic models for all request bodies and response schemas — never raw dicts
- Background tasks via BullMQ consumer workers in `src/workers/` — not FastAPI BackgroundTasks

## AI/ML Conventions
- Embedding provider interface: all providers must implement `EmbeddingProvider` abstract class
- Chunking strategy interface: all strategies must implement `ChunkingStrategy` abstract class
- Never hardcode model names in business logic — always read from `settings.embedding_model`
- Log embedding latency and token counts for every call — required for cost tracking
- Batch embedding calls where possible — never embed one item at a time in a loop

## Async Patterns
- asyncpg for all PostgreSQL access — never synchronous psycopg2 in async context
- async/await throughout — no mixing sync and async in the same function
- Use `asyncio.gather()` for parallel async operations
- Redis via redis-py async client

## Testing
- pytest + pytest-asyncio for all tests
- Fixtures in `conftest.py` — shared database/redis fixtures using testcontainers
- Mock embedding providers in tests — never call real OpenAI/Cohere in CI
- Minimum 80% coverage for all modules
EOF
ok "03-python-standards.md"

# ── Rule 04: Git Workflow ─────────────────────────────────────────────────────
log "04-git-workflow.md"
cat > .agent/rules/04-git-workflow.md << 'EOF'
# Git Workflow

## Branching
- `main` — protected, requires PR + passing CI
- `develop` — integration branch for features
- Feature branches: `feat/<scope>/<short-description>` (e.g., `feat/ai-worker/embedding-pipeline`)
- Fix branches: `fix/<scope>/<short-description>`
- Chore branches: `chore/<scope>/<short-description>`

## Commit Messages (Conventional Commits)
Format: `<type>(<scope>): <description>`

Types: feat | fix | chore | docs | test | refactor | perf | ci
Scopes: server | admin | ai-worker | cli | types | sdk | deploy | docs

Examples:
- `feat(server): add hybrid search endpoint with BM25 + pgvector`
- `feat(ai-worker): implement sentence-boundary chunking strategy`
- `fix(server): correct RBAC field-level permission evaluation for null fields`
- `chore(deploy): update Helm chart resource limits for ai-worker`

## PR Rules
- Every PR must reference an issue or milestone task
- PR description must include: What changed, Why, How to test
- Breaking API changes require `BREAKING CHANGE:` footer in commit and version bump
- Never squash merge — preserve commit history

## Agent Behavior
- Always create a feature branch before making changes — never commit directly to main or develop
- Write descriptive commit messages following the convention above
- Group related changes in a single commit — don't commit every file separately
- Run `pnpm lint && pnpm typecheck && pnpm test` before committing
EOF
ok "04-git-workflow.md"

# ── Rule 05: Security ─────────────────────────────────────────────────────────
log "05-security.md"
cat > .agent/rules/05-security.md << 'EOF'
# Security Rules

## Terminal Command Policy
- ALWAYS require human approval before: `rm -rf`, `DROP TABLE`, `DELETE FROM`, any `sudo` command
- NEVER run database migrations without showing the migration diff first
- NEVER commit `.env` files, API keys, secrets, or credentials
- NEVER log request bodies that may contain passwords, tokens, or PII

## API Security
- All external endpoints require authentication — no unauthenticated write endpoints
- Validate and sanitize all user input with Zod (TS) or Pydantic (Python) before any processing
- Rate limiting on all public endpoints — configured in cortex-server Fastify rate limit plugin
- Content-Security-Policy headers on all admin UI responses

## Secrets Management
- Secrets in environment variables only — never in code, config files, or database
- Reference `.env.example` for required variables — never create actual `.env` files
- API keys for AI providers (OpenAI, Cohere) must be masked in all logs

## Database Safety
- Never run raw DELETE or DROP in application code — use Drizzle soft deletes or migrations
- All Drizzle migrations must be reviewed before execution — show diff to user first
- pgvector index operations (REINDEX, CREATE INDEX CONCURRENTLY) require explicit approval

## Dependency Safety
- Flag any new dependency that is not well-maintained (< 100 GitHub stars or last commit > 1 year)
- No dependencies with known critical CVEs — check before adding
EOF
ok "05-security.md"

# =============================================================================
# WORKFLOWS
# =============================================================================
head "Writing Workflows (5 files)"

# ── Workflow: new-content-type ────────────────────────────────────────────────
log "new-content-type.md"
cat > .agent/workflows/new-content-type.md << 'EOF'
# Workflow: Create New Content Type

Triggered by: /new-content-type

## Steps

1. **Gather requirements** — Ask the user:
   - What is the content type name (singular, PascalCase)?
   - What fields are needed? (name, type, required, unique, localised?)
   - Should this content type support vector/semantic search? (adds vector field)
   - What relations to existing types are needed?

2. **Schema definition** — Create the Drizzle schema in `apps/cortex-server/src/db/schema/<type>.ts`:
   - Define the table with all specified fields
   - Add standard fields: `id` (cuid2), `createdAt`, `updatedAt`, `publishedAt`, `locale`
   - Add vector column if semantic search requested: `embedding vector(1536)`
   - Define relations using Drizzle `relations()`

3. **Generate migration** — Run:
   ```
   cd apps/cortex-server && pnpm drizzle-kit generate
   ```
   Show migration diff to user before proceeding.

4. **Register in schema registry** — Add content type definition to `src/modules/content/registry.ts`

5. **REST API** — Verify auto-generated routes cover the new type (no manual work needed if registry updated)

6. **GraphQL** — Verify Pothos type auto-generation picks up new schema (check `src/api/graphql/types/`)

7. **If vector field added** — Update `apps/cortex-ai-worker/src/embedding/index_manager.py`:
   - Add pgvector table entry for the new content type
   - Register embedding job trigger in BullMQ worker

8. **Tests** — Generate unit tests for the new module in `apps/cortex-server/src/modules/<type>/<type>.test.ts`

9. **Commit** with message: `feat(server): add <TypeName> content type with <fields>`
EOF
ok "new-content-type.md"

# ── Workflow: add-embedding-field ─────────────────────────────────────────────
log "add-embedding-field.md"
cat > .agent/workflows/add-embedding-field.md << 'EOF'
# Workflow: Add Semantic Search to Content Type

Triggered by: /add-embedding-field

## Steps

1. **Identify target** — Ask: which content type? Which field(s) should be embedded? (title, body, both?)

2. **Check prerequisites**:
   - Confirm pgvector extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'vector'`
   - Confirm `EMBEDDING_PROVIDER` env var is set in cortex-ai-worker config

3. **Add vector column** — In the Drizzle schema for the target type:
   ```typescript
   embedding: vector('embedding', { dimensions: 1536 }).notNull(),
   embeddingModel: text('embedding_model'),
   embeddedAt: timestamp('embedded_at'),
   ```

4. **Generate and review migration** — Show diff before running

5. **Create pgvector HNSW index** in migration file:
   ```sql
   CREATE INDEX CONCURRENTLY ON <table>_embedding_idx
   USING hnsw (embedding vector_cosine_ops)
   WITH (m = 16, ef_construction = 64);
   ```

6. **Register embedding trigger** — In `apps/cortex-server/src/modules/<type>/`:
   - Add `content.saved` event handler that dispatches BullMQ job
   - Job payload: `{ contentId, contentType, fieldsToEmbed, locale }`

7. **Python worker** — In `apps/cortex-ai-worker/src/workers/embedding_worker.py`:
   - Register new content type in `EMBEDDABLE_TYPES` config
   - Map field names to text extraction logic

8. **Backfill existing content** — Ask user: run backfill job for existing records?
   If yes, dispatch a bulk embedding job with progress tracking.

9. **Verify** — Run a test semantic search query against the new type:
   ```
   GET /api/search?q=test+query&contentType=<type>
   ```

10. **Commit**: `feat(server,ai-worker): add semantic search to <TypeName> content type`
EOF
ok "add-embedding-field.md"

# ── Workflow: db-migrate ──────────────────────────────────────────────────────
log "db-migrate.md"
cat > .agent/workflows/db-migrate.md << 'EOF'
# Workflow: Database Migration

Triggered by: /db-migrate

## Steps

1. **Generate migration** (if schema changed):
   ```
   cd apps/cortex-server && pnpm drizzle-kit generate
   ```

2. **ALWAYS show the full migration SQL diff** to the user before proceeding — never auto-apply

3. **Check for destructive operations**:
   - Any `DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN` that changes type? → Require explicit confirmation
   - Any operation on a table with >10K rows? → Recommend `CONCURRENTLY` variant and maintenance window

4. **Apply migration** (only after user confirms):
   ```
   cd apps/cortex-server && pnpm drizzle-kit migrate
   ```

5. **Verify** — Run schema check:
   ```
   cd apps/cortex-server && pnpm drizzle-kit check
   ```

6. **Commit migration files**: `chore(server): add migration <migration-name>`

## Safety Rules
- Never run `/db-migrate` against a production database without a backup confirmation
- Always test migrations on a dev database first
- pgvector index creation uses `CREATE INDEX CONCURRENTLY` to avoid table locks
EOF
ok "db-migrate.md"

# ── Workflow: phase-checkpoint ────────────────────────────────────────────────
log "phase-checkpoint.md"
cat > .agent/workflows/phase-checkpoint.md << 'EOF'
# Workflow: Phase Milestone Checkpoint

Triggered by: /phase-checkpoint

## Steps

1. **Read current phase** from `PHASE.md` in repo root

2. **Check milestone completion** — for each item in the current phase deliverables:
   - Does the feature exist? (search codebase)
   - Does it have tests? (check test coverage report)
   - Is it documented? (check docs/ or inline JSDoc)
   - Mark as ✅ complete, ⚠️ partial, or ❌ missing

3. **Generate checkpoint report** as a markdown Artifact:
   ```
   ## Phase [X] Checkpoint — [Date]
   ### Completed ✅
   ### Partial ⚠️ (needs work)
   ### Missing ❌
   ### Blockers
   ### Recommended next actions
   ```

4. **Identify blockers** — flag anything that would prevent releasing the current phase version

5. **Ask user**: update PHASE.md to mark milestone complete and advance to next phase?
EOF
ok "phase-checkpoint.md"

# ── Workflow: ship-it ─────────────────────────────────────────────────────────
log "ship-it.md"
cat > .agent/workflows/ship-it.md << 'EOF'
# Workflow: Prepare Release

Triggered by: /ship-it

## Steps

1. **Run full test suite**:
   ```
   pnpm --filter cortex-server test
   pnpm --filter cortex-admin test
   cd apps/cortex-ai-worker && python -m pytest
   ```
   Stop and report if any tests fail — do not proceed.

2. **Type check**:
   ```
   pnpm --filter cortex-server typecheck
   pnpm --filter cortex-admin typecheck
   cd apps/cortex-ai-worker && mypy src/
   ```

3. **Lint**:
   ```
   pnpm --filter cortex-server lint
   pnpm --filter cortex-ai-worker && ruff check src/
   ```

4. **Build**:
   ```
   pnpm --filter cortex-server build
   pnpm --filter cortex-admin build
   ```

5. **Check CHANGELOG.md** — ask user to confirm the changelog is up to date for this version

6. **Version bump** — ask user for version (patch / minor / major):
   ```
   pnpm version <patch|minor|major> -r
   ```

7. **Build Docker images**:
   ```
   docker build -t cortex-cms/cortex-server:$(cat package.json | jq -r .version) apps/cortex-server/
   docker build -t cortex-cms/cortex-ai-worker:$(cat package.json | jq -r .version) apps/cortex-ai-worker/
   ```

8. **Tag and push**:
   ```
   git tag v$(cat package.json | jq -r .version)
   git push origin main --tags
   ```

9. Generate a **release notes Artifact** summarizing changes in this version.
EOF
ok "ship-it.md"

# =============================================================================
# SKILLS
# =============================================================================
head "Writing Skills (4 SKILL.md files)"

# ── Skill: drizzle-schema ─────────────────────────────────────────────────────
log "skills/drizzle-schema/SKILL.md"
cat > .agent/skills/drizzle-schema/SKILL.md << 'EOF'
# Drizzle ORM Schema Skill

## Description
Expert knowledge for defining Drizzle ORM schemas in Cortex CMS. Load this skill when creating
or modifying database schema definitions, relations, or migrations.

## Core Instructions

### Table Definition Pattern
Always follow this structure for Cortex CMS content type tables:

```typescript
import { pgTable, text, boolean, timestamp, jsonb, vector, index } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'

export const articles = pgTable('articles', {
  // Standard fields — always include these
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
  publishedAt: timestamp('published_at'),
  locale:      text('locale').notNull().default('en'),
  status:      text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),

  // Content fields
  title:       text('title').notNull(),
  slug:        text('slug').notNull().unique(),
  body:        jsonb('body'),  // TipTap JSON for rich text

  // Vector field (if semantic search enabled)
  embedding:     vector('embedding', { dimensions: 1536 }),
  embeddingModel: text('embedding_model'),
  embeddedAt:    timestamp('embedded_at'),
}, (table) => ({
  // Always add these indexes
  slugIdx:   index('articles_slug_idx').on(table.slug),
  statusIdx: index('articles_status_idx').on(table.status),
  localeIdx: index('articles_locale_idx').on(table.locale),
  // Vector index — add if embedding field present
  embeddingIdx: index('articles_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
}))
```

### Relations Pattern
```typescript
import { relations } from 'drizzle-orm'

export const articlesRelations = relations(articles, ({ one, many }) => ({
  author: one(users, { fields: [articles.authorId], references: [users.id] }),
  tags:   many(articleTags),
}))
```

### Migration Rules
- Never use `ALTER COLUMN` to change a column type on a table with data — add new column, migrate data, drop old
- Always use `CREATE INDEX CONCURRENTLY` for adding indexes to existing large tables
- pgvector HNSW index parameters for Cortex CMS: `m=16, ef_construction=64` (tuned for 1M vectors)
EOF
ok "skills/drizzle-schema/SKILL.md"

# ── Skill: pothos-graphql ─────────────────────────────────────────────────────
log "skills/pothos-graphql/SKILL.md"
cat > .agent/skills/pothos-graphql/SKILL.md << 'EOF'
# Pothos GraphQL Schema Skill

## Description
Expert knowledge for Pothos code-first GraphQL schema generation in cortex-server.
Load when creating GraphQL types, resolvers, or queries from content type definitions.

## Core Instructions

### Type Generation from Content Type
```typescript
import SchemaBuilder from '@pothos/core'
import { db } from '../db'
import { articles } from '../db/schema/articles'

const builder = new SchemaBuilder({})

// Content type → GraphQL type
const ArticleType = builder.objectType('Article', {
  description: 'A CMS article content type',
  fields: (t) => ({
    id:          t.exposeString('id'),
    title:       t.exposeString('title'),
    slug:        t.exposeString('slug'),
    publishedAt: t.expose('publishedAt', { type: 'DateTime', nullable: true }),
    status:      t.exposeString('status'),
    // Relation field
    author: t.field({
      type: UserType,
      resolve: async (parent) => db.query.users.findFirst({
        where: eq(users.id, parent.authorId)
      })
    })
  })
})

// List query with filtering
builder.queryField('articles', (t) =>
  t.field({
    type: [ArticleType],
    args: {
      status: t.arg.string(),
      locale: t.arg.string(),
      limit:  t.arg.int({ defaultValue: 20 }),
      cursor: t.arg.string(),
    },
    resolve: async (_, args) => {
      return db.query.articles.findMany({
        where: and(
          args.status ? eq(articles.status, args.status) : undefined,
          args.locale ? eq(articles.locale, args.locale) : undefined,
        ),
        limit: args.limit,
        // cursor pagination...
      })
    }
  })
)
```

### Subscription Pattern (real-time updates)
```typescript
builder.subscriptionField('articleUpdated', (t) =>
  t.field({
    type: ArticleType,
    subscribe: (_, args) => pubsub.asyncIterator(`article.updated`),
    resolve: (payload) => payload,
  })
)
```

### DataLoader pattern (N+1 prevention)
Always use DataLoader for relation resolution — never query in a loop.
```typescript
import DataLoader from 'dataloader'
const userLoader = new DataLoader(async (ids: readonly string[]) => {
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, [...ids]))
  return ids.map(id => users.find(u => u.id === id))
})
```
EOF
ok "skills/pothos-graphql/SKILL.md"

# ── Skill: pgvector-ops ───────────────────────────────────────────────────────
log "skills/pgvector-ops/SKILL.md"
cat > .agent/skills/pgvector-ops/SKILL.md << 'EOF'
# pgvector Operations Skill

## Description
Expert knowledge for pgvector operations in Cortex CMS — index management, hybrid search queries,
and HNSW parameter tuning. Load when working with vector search, embedding storage, or semantic retrieval.

## Core Instructions

### Hybrid Search Query (BM25 + cosine)
Cortex CMS uses Reciprocal Rank Fusion to blend full-text and vector scores:

```typescript
// In cortex-server: hybrid search across a content type
const hybridSearch = async (query: string, embedding: number[], alpha: number = 0.5, limit = 10) => {
  // Vector similarity search (pgvector)
  const vectorResults = await db.execute(sql`
    SELECT id, title, 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS vector_score
    FROM articles
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${limit * 2}
  `)

  // Full-text search (tsvector)
  const textResults = await db.execute(sql`
    SELECT id, title, ts_rank(search_vector, plainto_tsquery('english', ${query})) AS text_score
    FROM articles
    WHERE search_vector @@ plainto_tsquery('english', ${query})
    ORDER BY text_score DESC
    LIMIT ${limit * 2}
  `)

  // Reciprocal Rank Fusion
  return fuseRanks(vectorResults.rows, textResults.rows, alpha, limit)
}
```

### HNSW Index Creation (for migrations)
```sql
-- Standard Cortex CMS HNSW index — tuned for 1M vector collections
CREATE INDEX CONCURRENTLY articles_embedding_hnsw_idx
ON articles USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- For high-recall production use (slower build, better recall)
WITH (m = 32, ef_construction = 128);
```

### Index Maintenance
```sql
-- Check index usage and size
SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes WHERE indexname LIKE '%embedding%';

-- Reindex after bulk inserts (> 20% of collection size)
REINDEX INDEX CONCURRENTLY articles_embedding_hnsw_idx;
```

### Performance Thresholds
- pgvector performs well up to ~5M vectors with HNSW (m=16, ef_construction=64)
- Above 5M: consider partitioning by content type or migrating to Qdrant adapter
- Embedding query latency target: < 50ms for top-10 at 1M vectors
- If latency exceeds 100ms: increase `ef_search` parameter at query time
EOF
ok "skills/pgvector-ops/SKILL.md"

# ── Skill: llamaindex-rag ─────────────────────────────────────────────────────
log "skills/llamaindex-rag/SKILL.md"
cat > .agent/skills/llamaindex-rag/SKILL.md << 'EOF'
# LlamaIndex RAG Pipeline Skill

## Description
Expert knowledge for building RAG pipelines in cortex-ai-worker using LlamaIndex.
Load when working on retrieval, chunking strategies, re-ranking, or RAG API endpoints.

## Core Instructions

### Standard RAG Pipeline for Cortex CMS
```python
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.core.node_parser import SentenceSplitter, SemanticSplitterNodeParser
from llama_index.core.postprocessor import SimilarityPostprocessor, CohereRerank
from llama_index.embeddings.openai import OpenAIEmbedding

# Cortex CMS standard retriever setup
async def build_retriever(content_type: str, embed_model, top_k: int = 10):
    vector_store = PGVectorStore.from_params(
        database=settings.db_name,
        host=settings.db_host,
        table_name=f"cortex_{content_type}_embeddings",
        embed_dim=1536,
        hnsw_kwargs={"hnsw_m": 16, "hnsw_ef_construction": 64, "hnsw_ef_search": 40},
    )
    index = VectorStoreIndex.from_vector_store(vector_store, embed_model=embed_model)
    return index.as_retriever(similarity_top_k=top_k)

# Permission-aware retrieval — ALWAYS apply user's allowed content IDs
async def retrieve_with_permissions(
    query: str,
    allowed_ids: list[str],  # From RBAC — never skip this
    retriever,
    rerank: bool = False
) -> list[NodeWithScore]:
    nodes = await retriever.aretrieve(query)
    # Filter to permitted content only
    nodes = [n for n in nodes if n.node.metadata.get('source_id') in allowed_ids]
    if rerank and settings.cohere_api_key:
        reranker = CohereRerank(api_key=settings.cohere_api_key, top_n=5)
        nodes = reranker.postprocess_nodes(nodes, query_str=query)
    return nodes
```

### Chunking Strategy Selection
```python
# Rule of thumb for Cortex CMS content types:
# - Short content (titles, summaries, < 200 tokens): embed whole, no chunking
# - Medium content (product descriptions, blog intros, 200-1000 tokens): sentence splitter
# - Long content (articles, docs, > 1000 tokens): semantic splitter

def get_chunker(strategy: str, embed_model=None):
    match strategy:
        case "fixed":
            return SentenceSplitter(chunk_size=512, chunk_overlap=50)
        case "sentence":
            return SentenceSplitter(chunk_size=256, chunk_overlap=30, paragraph_separator="\n\n")
        case "semantic":
            assert embed_model, "Semantic chunking requires an embed model"
            return SemanticSplitterNodeParser(embed_model=embed_model, breakpoint_percentile_threshold=95)
        case _:
            return SentenceSplitter(chunk_size=512, chunk_overlap=50)
```

### Chunk Metadata (always include for source attribution)
```python
# Every chunk must carry these metadata fields
chunk_metadata = {
    "source_id": content_id,        # Content entry ID
    "content_type": content_type,   # e.g., "article", "product"
    "field_name": field_name,       # e.g., "body", "description"
    "locale": locale,               # e.g., "en", "de"
    "chunk_index": i,               # Position in original document
    "parent_heading": heading,      # Nearest heading above this chunk (if available)
    "published_at": published_at,   # For freshness scoring
}
```
EOF
ok "skills/llamaindex-rag/SKILL.md"

# ── Skill: fastify-plugin (placeholder) ──────────────────────────────────────
log "skills/fastify-plugin/SKILL.md (placeholder)"
cat > .agent/skills/fastify-plugin/SKILL.md << 'EOF'
# Fastify Plugin Skill

## Description
Expert knowledge for Fastify plugin patterns in cortex-server.
Load when creating new Fastify plugins, route handlers, or middleware.

## Status
Placeholder — populate with Fastify plugin patterns as cortex-server matures.

## Core Principles
- Every feature area is a Fastify plugin registered via `fastify.register()`
- Use `fastify-plugin` (fp) to share decorations across plugin scope boundaries
- All plugins must be async and use `await` — never mix callback and async styles
- Declare plugin dependencies explicitly with `plugin.dependencies = [...]`
EOF
ok "skills/fastify-plugin/SKILL.md (placeholder)"

# ── Skill: helm-k8s (placeholder) ────────────────────────────────────────────
log "skills/helm-k8s/SKILL.md (placeholder)"
cat > .agent/skills/helm-k8s/SKILL.md << 'EOF'
# Helm / Kubernetes Skill

## Description
Expert knowledge for Helm chart configuration and Kubernetes deployment of Cortex CMS.
Load when working on deploy/, Helm values, Kubernetes manifests, or HPA configuration.

## Status
Placeholder — populate with Helm chart patterns as the deploy/ directory matures.

## Core Principles
- cortex-server and cortex-ai-worker are separate Deployments with independent HPA configs
- Both services share a single PostgreSQL and Redis instance (separate StatefulSets or external managed)
- All secrets managed via Kubernetes Secrets or External Secrets Operator — never in values.yaml
- Resource requests and limits must be set on all containers — no unbounded pods in production
EOF
ok "skills/helm-k8s/SKILL.md (placeholder)"

# =============================================================================
# MASTER AGENT PROMPT
# =============================================================================
head "Writing Master Agent Prompt"

cat > .agent/MASTER_PROMPT.md << 'EOF'
# Master Agent Prompt

Use this as the **opening mission prompt** when starting a new Antigravity agent session on Cortex CMS.
Paste it into the Agent Manager to orient a new agent before delegating a task.

---

```
You are working on Cortex CMS — an open-source, AI-native headless content repository built
with a pragmatic polyglot architecture.

BEFORE you do anything else:
1. Read PHASE.md in the repo root to understand the current development phase and active milestone
2. Read .agent/rules/ — all rules apply to every task you perform
3. Check the relevant skill in .agent/skills/ before working on database, GraphQL, vector search,
   or RAG pipeline tasks

ARCHITECTURE REMINDER:
- cortex-server (TypeScript/Fastify) = CMS API, GraphQL, auth, assets — runs on port 3000
- cortex-admin (React) = admin UI — served from cortex-server in production
- cortex-ai-worker (Python/FastAPI) = AI pipeline only — runs on port 8001, never public-facing
- Communication: Redis/BullMQ queues for async AI jobs; internal HTTP for sync search calls
- Shared: PostgreSQL 16 + pgvector, Redis 7, S3-compatible storage

YOUR TASK:
[Insert specific task here]

DEFINITION OF DONE:
- Code follows the language standards in .agent/rules/
- Tests written and passing
- No TypeScript or mypy type errors
- Commit message follows conventional commits format
- If you added a new API endpoint: verify it appears in the OpenAPI spec
- If you changed the database schema: migration generated and reviewed

Generate an implementation plan as an Artifact first, wait for my approval, then execute.
```
EOF
ok "MASTER_PROMPT.md"

# =============================================================================
# PHASE.md (starter file for phase tracking)
# =============================================================================
head "Writing PHASE.md starter"

if [[ ! -f "PHASE.md" ]]; then
  cat > PHASE.md << 'EOF'
# Cortex CMS — Current Development Phase

## Active Phase: Phase 1 — CMS Foundation
**Target release:** v0.1.0
**Duration:** Months 1–4

## Active Milestone
Month 1 — Project Scaffolding

## Checklist
- [ ] Monorepo setup (Turborepo, pnpm workspaces)
- [ ] TypeScript configuration, ESLint, Prettier, Husky
- [ ] Fastify bootstrap with plugin architecture
- [ ] PostgreSQL connection with Drizzle ORM + base schema
- [ ] Docker Compose dev stack (PostgreSQL + Redis + MinIO)
- [ ] GitHub Actions CI pipeline
- [ ] cortex-cli skeleton (Go): init, dev, migrate commands

## Notes
<!-- Add notes, blockers, decisions here -->
EOF
  ok "PHASE.md created"
else
  echo -e "  ${YELLOW}↷${RESET} PHASE.md already exists — skipped"
fi

# =============================================================================
# SUMMARY
# =============================================================================
head "Setup Complete"

echo ""
echo -e "${BOLD}Files created:${RESET}"
echo ""
find .agent -type f | sort | while read -r f; do
  echo -e "  ${GREEN}+${RESET} $f"
done
if [[ -f "PHASE.md" ]]; then
  echo -e "  ${GREEN}+${RESET} PHASE.md"
fi

echo ""
echo -e "${BOLD}Next steps:${RESET}"
echo -e "  1. ${CYAN}git add .agent/ PHASE.md && git commit -m 'chore: add Antigravity agent configuration'${RESET}"
echo -e "  2. Open Antigravity → Agent Manager → paste contents of ${CYAN}.agent/MASTER_PROMPT.md${RESET} as your opening prompt"
echo -e "  3. Use ${CYAN}/new-content-type${RESET}, ${CYAN}/add-embedding-field${RESET}, ${CYAN}/db-migrate${RESET}, ${CYAN}/phase-checkpoint${RESET}, ${CYAN}/ship-it${RESET} workflows"
echo ""
echo -e "${GREEN}${BOLD}Cortex CMS Antigravity configuration ready.${RESET}"
