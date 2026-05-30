---
title: "Introducing Rosmarium COS: The AI-Native Content Infrastructure"
description: "How we built a headless CMS that brings native RAG, vector search, and Auto-tagging to your frontend without the headache."
author: "The Rosmarium Team"
date: "2026-05-29"
---

# Introducing Rosmarium COS: The AI-Native Content Infrastructure

For years, building an application that leverages AI has required juggling a disjointed stack: a relational database for your core data, a separate vector database for semantic search, an embedding pipeline built in Python, and a headless CMS to actually manage the editorial content. 

Today, we are thrilled to introduce **Rosmarium COS** — the open-source headless CMS that unifies these layers into a single, high-performance infrastructure.

## Why We Built Rosmarium

We love building modern frontends using React, Vue, and Svelte. But every time we wanted to add "smart" features—like semantic search, automatic tagging, or a Retrieval-Augmented Generation (RAG) chatbot—we found ourselves building the same complex pipelines over and over.

We built Rosmarium to give developers an out-of-the-box solution:
1. **A beautiful, Headless Admin UI** to model your content and manage roles.
2. **PostgreSQL + pgvector** under the hood, ensuring your relational data and embeddings live in perfect sync.
3. **An integrated AI Worker** (built in FastAPI) that automatically chunks text, generates embeddings (via Ollama, OpenAI, or Cohere), and extracts named entities as soon as you hit "Publish".

## Features You'll Actually Use

- **Hybrid Search out of the box:** Rosmarium seamlessly combines BM25 full-text search with pgvector cosine similarity, ranking the results using Reciprocal Rank Fusion (RRF) for unparalleled search accuracy.
- **Auto-Tagging & NER:** Watch as your content is automatically tagged and analyzed for Named Entities (People, Organizations, Locations) without writing a single line of NLP code.
- **Graph Traversal APIs:** Built-in Cypher-lite querying allows you to traverse relationships and build recommendation engines effortlessly.
- **Deeply Typed SDKs:** A strictly typed `@rosmarium/client` SDK makes fetching content and running RAG pipelines a breeze in your frontend.

## Get Started in 5 Minutes

You can spin up the entire Rosmarium ecosystem (Fastify server, FastAPI worker, Admin UI, PostgreSQL, and Redis) locally using our Docker Compose configuration:

```bash
git clone https://github.com/orchestrator-dev/rosmarium
cd rosmarium
pnpm install
pnpm infra:up
pnpm dev
```

Visit `http://localhost:5173` to access the Admin panel and start modeling your AI-native content.

## What's Next?

We just shipped `v1.1.0`! Join our community on GitHub, check out our interactive documentation, and let us know what you build.

> **Star us on GitHub:** [orchestrator-dev/rosmarium](https://github.com/orchestrator-dev/rosmarium)
