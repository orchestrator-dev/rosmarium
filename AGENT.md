# Rosmarium COS — AI Agent Context

Welcome! This file provides context and directives for AI agents working on the **Rosmarium COS** project.

## Overview
Rosmarium is an open-source, AI-native headless content repository. It consists of:
1. **`rosmarium-server` (Node.js)**: The core API server using Fastify, Mercurius (GraphQL), and Drizzle ORM (PostgreSQL). Handles the primary CRUD operations, authentication, RBAC, and webhooks.
2. **`rosmarium-admin` (React/Vite)**: The admin dashboard interface built with TanStack Router and MUI v6.
3. **`rosmarium-ai-worker` (Python/FastAPI)**: The background asynchronous worker that handles vector embeddings, text chunking, graph analytics, and AI intelligence tagging.

## Technology Stack
- **Monorepo**: pnpm workspaces + Turborepo
- **Database**: PostgreSQL with `pgvector`. Schema managed by Drizzle ORM (`apps/rosmarium-server/src/db/schema`).
- **Cache & Queue**: Redis with BullMQ (for asynchronous tasks like embedding and webhooks).
- **Storage**: S3-compatible blob storage (MinIO for local dev).
- **AI Models**: Designed to support OpenAI, Ollama, Cohere, and Hugging Face cross-encoders.

## Important Directories & Scripts
- `apps/rosmarium-server/`: Node.js Fastify API. Run `pnpm dev` here.
- `apps/rosmarium-admin/`: React frontend. Run `pnpm dev` here.
- `apps/rosmarium-ai-worker/`: Python FastAPI worker. Handled via `uv`.
- `PHASE.md`: Tracks the high-level roadmap and completion status of project phases.
- `package.json` scripts: Use `pnpm infra:up`, `pnpm db:migrate`, and `pnpm db:seed` for infrastructure and database management.

## Guidelines for AI Agents
1. **Code Standards**: 
   - **TypeScript**: Use strict typing. Prefer `.ts` and `.tsx` files. Use explicit imports with `.js` extensions for Node.js ES modules.
   - **Python**: Use strict typing, `mypy`, and `ruff` for linting.
   - **React**: Use functional components, hooks, and MUI v6. Note: MUI v6 `Grid` uses `size={{ xs: 12 }}` instead of `xs={12}`.
2. **Database Changes**: Always update the Drizzle schema in `apps/rosmarium-server/src/db/schema/` and generate migrations using `pnpm db:generate`.
3. **Agent Skills**: Custom, project-specific agent instructions and operational scripts (e.g., custom prompts or workflow instructions) are located in the `.agent/skills/` directory.
4. **Documentation & Screenshots**: Whenever there are functional or API changes, the documentation located in `apps/rosmarium-www/src/content/docs/` must be refreshed and amended accordingly. **CRITICAL RULE**: Documentation shall use screenshots taken ONLY using `chrome-devtools` MCP. No synthetic generations or placeholders are allowed. Ensure `README.md` is updated if necessary.

## Custom Agent Skills
To further extend AI agent capabilities for this project, check the `.agent/skills/` directory. When working on specific architectural domains (e.g., the Graph Database layer, Vector Embeddings, or Webhooks), please consult the relevant skill markdown files stored there if they exist.
