-- Migration: 0004_hybrid_search_vector
-- Adds tsvector generated column and GIN index to content_entries
-- for full-text search support (Part B of hybrid search, Month 6)

ALTER TABLE "content_entries"
ADD COLUMN "search_vector" tsvector
GENERATED ALWAYS AS (
  to_tsvector('english',
    COALESCE(data->>'title', '') || ' ' ||
    COALESCE(data->>'body', '') || ' ' ||
    COALESCE(data->>'description', ''))
) STORED;
--> statement-breakpoint
CREATE INDEX "content_entries_search_vector_idx"
  ON "content_entries" USING gin("search_vector");
