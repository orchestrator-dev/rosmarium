# cortex-ai-worker — Core

Path: `apps/cortex-ai-worker/`  
Package: `cortex-ai-worker`  
Runtime: Python 3.12, FastAPI, uvicorn on port **8001**

## Entry point
`src/cortex_ai_worker/main.py` — FastAPI app, registers routers

## Config
`src/cortex_ai_worker/config.py` — pydantic-settings class  
Key settings: `worker_secret`, `database_url`, `redis_url`, `embedding_provider`, `embedding_model`, `ollama_base_url`

## API Routes (all in `api/routes/`)
- `health.py` — GET /health, GET /ready
- `search.py` — POST /search/embed, POST /search/embed-batch  
  Auth: `X-Worker-Secret` header validation (403 if missing/wrong)
- `rag.py` — POST /rag/retrieve, POST /rag/retrieve/stream (SSE)
- `intelligence.py` — /intelligence/{tag,ner,summarize,duplicates,scan-duplicates}

## Embedding
- `embedding/base.py` — `EmbeddingProvider` ABC with `embed_one(text, input_type)` and `embed_batch(texts, input_type)`
- `embedding/registry.py` — `get_provider()` factory
- Adapters: `ollama.py` (default dev), `openai.py`, `cohere.py`
- Cohere: `input_type` matters — pass `"search_query"` or `"search_document"`

## Workers (BullMQ consumers)
- `workers/consumer.py` — main consumer entry
- `workers/embedding_worker.py` — processes `embedding-jobs` queue
- `workers/intelligence_worker.py` — processes `intelligence-jobs` queue

## Chunking
- `chunking/registry.py` — `get_chunker()` factory  
- `chunking/fixed.py` — FixedSizeChunker (backwards-compat adapter)
- `chunking/sentence.py` — SentenceChunker (spaCy sentencizer)
- `chunking/section.py` — SectionChunker (markdown/HTML headings)

## RAG
- `rag/pipeline.py` — RAGPipeline (parallel multi-type retrieval, RBAC, freshness scoring)
- `rag/retriever.py` — LlamaIndex retrieval, Cohere rerank
- `rag/formatter.py` — ContextFormatter (token-budgeted context string)

## Intelligence
- `intelligence/tagger.py` — AutoTagger (zero-shot, NLI model)
- `intelligence/ner.py` — NERExtractor (spaCy en_core_web_sm)
- `intelligence/summarizer.py` — ContentSummarizer (Ollama LLM + extractive fallback)
- `intelligence/duplicate_detector.py` — DuplicateDetector (pgvector cosine)

## Vector
- `vector/index_manager.py` — ensure_table, upsert, delete, search for pgvector tables

## Security invariant
Never log actual query text or user content (PII). Log latency + model only.
