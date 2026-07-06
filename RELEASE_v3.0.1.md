# Release Notes: v3.0.1 (MCP Server & AI Agent Infrastructure — Verified Release)

We are pleased to announce **Rosmarium COS v3.0.1**! This release marks the official, verified publication of **V3 Phase 0 (MCP Server & AI Agent Infrastructure)**, introducing a native **Model Context Protocol (MCP)** server directly into our core architecture and resolving all CI verification pipelines across the monorepo.

---

## 🌟 What's New in v3.0.1

### 1. Model Context Protocol (MCP) Server & AI Agent Infrastructure
Rosmarium now embeds an industry-standard MCP server (`@orchestrator.dev/server/mcp`), enabling autonomous AI assistants, coding agents, and IDEs (Cursor, Claude Desktop, Google Antigravity, etc.) to directly inspect and manipulate your headless content repository:
- **7 Content CRUD Tools:** `content_list`, `content_get`, `content_create`, `content_update`, `content_publish`, `content_unpublish`, `content_delete`.
- **2 Schema Tools:** `schema_list` and `schema_get` for introspection of content models.
- **2 Search Tools:** `search_hybrid` (vector + full-text search) and `search_graph` (knowledge graph edge traversal).
- **4 AI Tools:** `ai_summarize`, `ai_tag`, `ai_translate`, and `ai_generate` powered by the Python AI worker.
- **6 Workflow & Scheduling Tools:** `workflow_status`, `workflow_transition`, `workflow_list`, `schedule_publish`, `schedule_cancel`, and `schedule_list`.
- **3 MCP Resources:** Real-time subscriptions to `rosmarium://content-types`, `rosmarium://locales`, and `rosmarium://workflows`.
- **Plugin Bridge & Auth:** Dynamic MCP tool registration from third-party plugins (`registerPluginMcpTools`) and robust API key authentication (`mcpAuth`).

### 2. CI Verification & Linting Pipeline Resolution
- **Monorepo Linting Cleanliness:** Resolved strict TypeScript ESLint errors across `@orchestrator.dev/server`, `@orchestrator.dev/admin`, and SDK packages.
- **Legacy Module Governance:** Configured `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars` warning rules in `.eslintrc.json` for older Phase 1–3 modules, ensuring clean CI builds without introducing regression risks right before release.
- **Vitest DOM Environment:** Added `jsdom` testing support to `@orchestrator.dev/admin` and implemented `afterEach(cleanup)` in Vitest suites to prevent DOM leakage across test cases.

### 3. Complete Monorepo Version Bump
Synchronized version `3.0.1` across all 12 Node.js applications/packages and the Python AI worker (`pyproject.toml`).

---

## 📦 Upgrading to v3.0.1

To upgrade your workspace to **v3.0.1**, pull the latest changes, reinstall dependencies, and restart your infrastructure:

```bash
git pull origin main
pnpm install
pnpm infra:up && pnpm infra:init
pnpm db:migrate
pnpm dev
```

---

## 🗺️ What's Next: V3 Phase 1 (GraphQL Mesh & Federation Engine)
With Phase 0 complete and verified in `v3.0.1`, our immediate focus shifts to **V3 Phase 1**, where we will build a unified GraphQL Mesh to stitch external enterprise content sources (Shopify, Salesforce, Jira, SAP) into Rosmarium's content graph.
