-- Migration: add created_by index to content_entries
-- Speeds up RBAC own-only retrieval (ragService.resolveAllowedEntryIds)

CREATE INDEX IF NOT EXISTS content_entries_created_by_idx
    ON content_entries (created_by);
