# Rosmarium Discovery Demo Dataset

The **Rosmarium Discovery** demo dataset provides a pre-configured environment packed with realistic data to showcase the full power of Rosmarium CMS. It demonstrates everything from foundational content management to advanced AI intelligence and graph capabilities out-of-the-box.

## Features Showcased

1. **Intelligent Content Management**
   - 3 structured content types: `Article`, `Concept`, and `Person`.
   - 50 pre-populated entries logically distributed across 5 technical clusters (Vector Search, RAG, CMS/APIs, Graphs, DevOps).

2. **AI Intelligence Pipelines**
   - **Auto-Tagging**: Articles and Concepts are automatically categorized with relevant tags using a predefined AI taxonomy.
   - **Named Entity Recognition (NER)**: Entities like technologies and organizations are extracted from rich text bodies.
   - **Deduplication**: Semantically similar content entries are flagged to maintain knowledge base hygiene.

3. **Graph Data Model & Analytics**
   - **Auto-Inferred Edges**: Similarity edges are built from vector embeddings (cosine-similarity), and co-mention edges are generated from NER results.
   - **Manual Edges**: Explicit references (`References`, `Related To`, `Works With`) are pre-created to show curated relationships.
   - **Graph Analytics**: Pre-computed PageRank scores and community detection clusters, making it easy to identify the most authoritative articles and related concepts.

4. **Hybrid Search**
   - Demonstrates the combination of BM25 text search and vector embeddings (pgvector) using Reciprocal Rank Fusion (RRF), allowing robust querying capabilities out-of-the-box.

## Usage

You can initialize and populate the demo dataset using the provided NPM scripts.

### Running the Demo Seed

To populate an existing, empty Rosmarium environment:

```bash
pnpm demo:seed
```

This command will:
- Register the required content types.
- Insert and publish all 50 entries (triggering the AI worker).
- Poll the embedding jobs until complete.
- Provision manual graph edges and compute analytics.

### Resetting the Environment

If you want to start completely fresh from a clean slate (destroys existing DB data):

```bash
pnpm demo:reset
```

This will:
- Tear down existing Docker/Podman containers (`infra:reset`).
- Bring up fresh containers (`infra:up` and `infra:init`).
- Run database migrations (`db:migrate`).
- Create the default admin user (`db:seed`).
- Seed the demo dataset (`demo:seed`).

> [!NOTE]
> The seed script relies on the AI Worker to generate embeddings. Depending on your local hardware setup (CPU vs GPU), embedding generation may take up to 120 seconds. The script will automatically poll and wait for completion before proceeding to graph operations.
