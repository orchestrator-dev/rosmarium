-- Migration 0006: Add GIN index on content_entries.metadata->'ai' for fast AI result queries
-- Part of Month 8 — AI Metadata Intelligence

CREATE INDEX IF NOT EXISTS content_entries_metadata_ai_idx
    ON content_entries USING gin((metadata->'ai'));
