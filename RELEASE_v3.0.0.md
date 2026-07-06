# Release Notes: v3.0.0 (MCP Server & AI Agent Infrastructure)

We are thrilled to announce **Rosmarium COS v3.0.0**! This milestone release marks the completion of **V3 Phase 0**, officially transforming Rosmarium into an **AI-native, agent-ready Headless Content Orchestration System**. By embedding a native **Model Context Protocol (MCP)** server directly into our core architecture, Rosmarium now bridges the gap between structured enterprise content and autonomous AI coding assistants, agents, and IDEs (such as Cursor, Claude Desktop, and Google Antigravity).

---

## 🌟 Key Highlights

### 1. Native Model Context Protocol (MCP) Server
Rosmarium now ships with an integrated MCP server built on `@modelcontextprotocol/sdk@^1.29.0` utilizing standard input/output (`StdioServerTransport`). This allows external AI agents to directly query your content repository, inspect schemas, traverse graph relationships, execute AI tasks, and trigger publishing workflows in real time.

### 2. 21 Built-in MCP Tools Across 5 Domain Groups
We have implemented and verified 21 production-grade tools designed specifically for AI agent workflows:
* **Content CRUD (`content_*`)**:
  * `content_list`: Query paginated content entries with advanced filtering, sorting, status, and locale support.
  * `content_get`: Retrieve complete structured data for single entries with optional relationship population.
  * `content_create`, `content_update`, `content_delete`: Full lifecycle management with Zod runtime validation.
  * `content_publish`, `content_unpublish`: Trigger editorial status transitions directly from your agent.
* **Schema Inspection (`schema_*`)**:
  * `schema_list`: Enumerate all registered content types in the workspace.
  * `schema_get`: Retrieve detailed field definitions, validation rules, and localization settings for exact agent context priming.
* **Search & Knowledge Graph (`search_*`)**:
  * `search_hybrid`: Execute BM25 full-text + pgvector semantic hybrid search with customizable alpha weighting (`searchService.search`).
  * `search_graph`: Traverse multi-directional knowledge graph edges (`outbound`, `inbound`, `both`) to discover related content entities (`graphService.getEdgesForEntry`).
* **AI Intelligence Layer (`ai_*`)**:
  * `ai_summarize`: Generate brief, detailed, or bulleted summaries of content entries.
  * `ai_tag`: Zero-shot semantic classification against candidate label arrays.
  * `ai_translate`: Trigger asynchronous translations via the Python/FastAPI AI worker.
  * `ai_generate`: Execute generative content creation prompts with contextual grounding.
* **Workflow & Scheduling (`workflow_*`, `schedule_*`)**:
  * `workflow_status`, `workflow_transition`, `workflow_list`: Inspect audit trails and advance entries through custom state machines.
  * `schedule_publish`, `schedule_cancel`, `schedule_list`: Manage BullMQ time-based publishing jobs.

### 3. MCP Resources for Context Priming
To help AI agents understand your workspace without burning tool calls, Rosmarium exposes three standard read-only MCP resources:
* `rosmarium://content-types`: Complete registry of all content types and their schemas.
* `rosmarium://locales`: Configured locales and fallback chains.
* `rosmarium://workflows`: Active workflow state definitions and transition rules.

### 4. MCP Plugin Bridge (G28 Extensibility)
Rosmarium's plugin engine has been upgraded to support MCP extensions! Third-party plugins can now define custom MCP tools via the new `mcpTools` property on the `RosmariumPlugin` interface in `@orchestrator.dev/types`. When loaded, the server automatically registers these tools under the namespace `plugin_<pluginName>_<toolName>`, enabling boundless ecosystem growth.

### 5. Robust Security & Authentication
The new `mcpAuth` module provides secure environment-based API key validation (`MCP_API_KEY`) and injects tenant and user execution contexts (`MCP_USER_ID`, `MCP_TENANT_ID`) into all MCP operations, ensuring strict multi-tenancy and RBAC compliance.

---

## 🛠 Under the Hood & Code Quality
* **100% Clean Typecheck**: Resolved all subpath module resolution issues, Zod shape definitions, and Fastify parameter typings across the entire monorepo. `tsc --noEmit` passes with 0 errors.
* **Comprehensive Test Coverage**: Added `src/mcp/mcp.test.ts` verifying all 21 tool handlers, 3 resources, auth rules, and the plugin bridge with Vitest.
* **CLI Integration**: Updated `rosmarium-cli` with dynamic ESM import resolution to launch the MCP server via `npx rosmarium mcp`.

---

## 🚀 Upgrade Instructions
To upgrade your workspace to **v3.0.0**, pull the latest changes, reinstall dependencies, and restart your infrastructure:

```bash
# 1. Install dependencies across all packages and apps
pnpm install

# 2. Run database migrations (if any schema updates apply)
pnpm db:migrate

# 3. Rebuild types and core packages
pnpm --filter @orchestrator.dev/types build
pnpm build

# 4. Launch your development servers
pnpm dev
```

To connect an external AI agent or IDE (such as Cursor or Claude Desktop), add the following configuration to your MCP settings:
```json
{
  "mcpServers": {
    "rosmarium": {
      "command": "npx",
      "args": ["rosmarium", "mcp"],
      "env": {
        "MCP_API_KEY": "your-secret-api-key",
        "MCP_USER_ID": "admin-agent",
        "MCP_TENANT_ID": "default"
      }
    }
  }
}
```

Welcome to the future of AI-native Content Orchestration! 🌿✨
