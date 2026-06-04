# Release Notes: v2.1.0 (Ingestor Evolution)

We are thrilled to announce Rosmarium v2.1.0! This release brings a massive evolution to our autonomous content ingestion pipeline, transforming it from a simple web crawler into a fully-fledged, multi-source Data Extraction Engine.

## Multi-Source Ingestion Architecture
The Ingestor is no longer limited to just web pages! You can now seamlessly pull unstructured or semi-structured data from a variety of sources directly into Rosmarium:
- **Web Crawling**: Recursively scrape entire websites with advanced URL pattern filtering and depth controls.
- **Local File System**: Point Rosmarium to a directory or a specific file containing JSON arrays, XML, or raw text and watch it become structured content.
- **Database Extraction**: Connect directly to your PostgreSQL or MongoDB databases, execute queries, and pipe the result sets into the AI pipeline for structuring.
- **Cloud Storage Integration**: Pull objects natively from Amazon S3 or self-hosted MinIO buckets.

## AI Configuration & Custom Prompts
We know that generic extraction doesn't fit every use case. In v2.1.0, we have introduced deep control over the AI workers driving the intelligence layer:
- **Hardware-Aware Model Selection**: Instantly query your running AI worker for available models and pick the right one for the job. You can now effortlessly switch from `gpt-4o-mini` to local Ollama models directly from the Ingestor UI!
- **Override Prompts**: Customize how the AI classifies and maps your data by supplying custom System and User prompts. This ensures the extracted content strictly follows your unique business terminology and edge-case instructions.

## UI Improvements
The Admin Dashboard has been updated to support these incredible new features.
- A streamlined Tab interface allows you to pick your ingestion source and provide relevant parameters (DB connection strings, file paths, etc.).
- A brand new **Advanced options & AI Overrides** expandable section houses granular crawl settings, model selection, and the custom prompt configuration.

## Under the Hood
- Implemented the `ExtractorFactory` pattern in `rosmarium-ai-worker` to modularize and decouple source extraction from the classification and mapping phases.
- Refactored `IngestorConfig` schema in both TypeScript and Python to use strongly-typed discriminated unions, ensuring type safety and consistency across the Node.js Server and the FastAPI Worker boundaries.

## Upgrade Instructions
As always, update your dependencies via `pnpm install`, run `pnpm db:migrate` to ensure your database is up to date, and restart your servers with `pnpm dev`.

Happy Orchestrating!
