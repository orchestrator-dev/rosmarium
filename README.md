<p align="center">
  <img src="docs/hero.svg" alt="Rosmarium COS" width="100%" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/node-22%20LTS-green" alt="Node" />
  <img src="https://img.shields.io/badge/python-3.12-blue" alt="Python" />
  <img src="https://img.shields.io/badge/postgresql-16%20+%20pgvector-336791" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/version-v2.0.0-brightgreen" alt="Version" />
  <img src="https://img.shields.io/badge/status-V2%20Release%20%C2%B7%20v2.0.0-brightgreen" alt="Status" />
  [![CI](https://github.com/orchestrator-dev/rosmarium/actions/workflows/ci.yml/badge.svg)](https://github.com/orchestrator-dev/rosmarium/actions/workflows/ci.yml)
</p>

---

## What is Rosmarium?

**[🚀 Try the Interactive Demo](https://demo.rosmarium.com)** | **[📚 Read the Documentation](https://rosmarium.com/docs)** | **[🌐 Visit Website](https://rosmarium.com)**

Most headless CMS tools treat AI as a plugin. Rosmarium treats it as infrastructure, acting as a true Content Orchestration System (COS). Built on a split-stack architecture, a TypeScript/Fastify core handles content branching, visual live previews, auth, REST/GraphQL, and a knowledge graph layer. A Python/FastAPI background worker handles LLM embeddings, RAG pipelines, semantic search, auto-tagging, NER, and graph analytics. Both components share PostgreSQL with `pgvector` extension natively.

## Documentation

We maintain exhaustive documentation similar to FastAPI and Swagger at **[rosmarium.com/docs](https://rosmarium.com/docs)**.

Please refer to the site for detailed guides on:
- 🚀 **[Getting Started](https://rosmarium.com/docs/getting-started)**: Installation and Docker compose.
- 🏗️ **[Architecture](https://rosmarium.com/docs/architecture)**: Understanding the Node/Python decoupled structure.
- 🧩 **[Content Modeling](https://rosmarium.com/docs/content-modeling)**: Building composite and nested structures using blocks.
- 🌳 **[Content Branching](https://rosmarium.com/docs/branching)**: Safe collaboration and three-way merging.
- 👁️ **[Visual Live Preview](https://rosmarium.com/docs/live-preview)**: Real-time iframe SDK previews.
- 🔌 **[API Reference](https://rosmarium.com/docs/api-reference)**: Comprehensive endpoints for REST and GraphQL.
- 🤖 **[AI Pipeline](https://rosmarium.com/docs/ai-pipeline)**: Deep dive into chunking, vector embeddings, and semantic tagging.
- 🕸️ **[Knowledge Graph](https://rosmarium.com/docs/knowledge-graph)**: Typed edges, Cypher queries, and graph analytics.

## Lore: The 42nd Element

If you inspect the Rosmarium favicon or project assets closely, you might notice references to **Atomic Number 42** and **Atomic Weight 284.14**. 

In the official lore of the project, "Rosmarium" (Rs) is the newly synthesized foundational element of modern Content Orchestration:
- **Atomic Number 42**: A direct nod to Douglas Adams' *The Hitchhiker's Guide to the Galaxy*. Rosmarium is designed to be the ultimate answer to the chaotic universe of headless CMS sprawl.
- **Atomic Weight 284.14**: Measured playfully in "Content-Daltons," this represents the exact stabilized atomic weight of a perfectly structured JSON payload bound with Python AI embeddings. (It's also suspiciously close to the molecular weight of certain robust organic compounds found in actual Rosemary extracts!)

## Quick Start

```bash
# Clone and install
git clone https://github.com/orchestrator-dev/rosmarium
cd rosmarium && pnpm install

# Start infrastructure (PostgreSQL, Redis, MinIO)
pnpm infra:up && pnpm infra:init

# Configure environment and run migrations
cp .env.example .env
pnpm db:migrate
pnpm db:seed

# Start the servers in separate terminals
pnpm --filter @orchestrator.dev/server dev
cd apps/rosmarium-ai-worker && uv run uvicorn rosmarium_ai_worker.main:app --app-dir src --port 8001
pnpm --filter @orchestrator.dev/admin dev
```

## Contributing & Licence

Rosmarium is Apache 2.0 licensed. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved and the codebase conventions.
