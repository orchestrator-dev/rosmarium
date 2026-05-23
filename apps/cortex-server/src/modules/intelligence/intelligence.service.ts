/**
 * Intelligence service — on-demand calls to the AI worker with
 * optional persistence to content_entries.metadata JSONB.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contentEntries } from "../../db/schema/index.js";
import {
    intelligenceClient,
    type DuplicateCandidate,
    type DuplicatePair,
    type SummaryResult,
    type TagResult,
} from "./intelligence.client.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Merge AI results into content_entries.metadata under the 'ai' key.
 * Uses raw SQL JSONB merge since 'metadata' is not in the Drizzle schema.
 */
async function persistAiMetadata(
    entryId: string,
    patch: Record<string, unknown>
): Promise<void> {
    await db.execute(
        sql`UPDATE content_entries
            SET metadata = COALESCE(metadata, '{}') || ${JSON.stringify({ ai: patch })}::jsonb,
                updated_at = now()
            WHERE id = ${entryId}`
    );
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const intelligenceService = {
    /**
     * Tag a content entry on-demand.
     * Writes tags to entry metadata if save=true.
     */
    async tagEntry(opts: {
        entryId: string;
        text: string;
        labels: string[];
        save?: boolean;
        threshold?: number;
    }): Promise<{ tags: TagResult[]; latencyMs: number }> {
        const result = await intelligenceClient.tag(opts.text, opts.labels, opts.threshold);

        if (opts.save && result.tags.length > 0) {
            await persistAiMetadata(opts.entryId, { tags: result.tags });
        }

        return { tags: result.tags, latencyMs: result.latencyMs };
    },

    /**
     * Extract named entities from a content entry.
     * Always persists result to metadata (entities are cheap to store).
     */
    async extractEntities(opts: {
        entryId: string;
        text: string;
    }): Promise<{ entities: Record<string, string[]>; latencyMs: number }> {
        const result = await intelligenceClient.extractEntities(opts.text);
        await persistAiMetadata(opts.entryId, { entities: result.entities });
        return { entities: result.entities, latencyMs: result.latencyMs };
    },

    /**
     * Summarize a content entry.
     * Writes to metadata if save=true.
     */
    async summarize(opts: {
        entryId: string;
        text: string;
        save?: boolean;
        maxWords?: number;
        style?: "brief" | "detailed" | "bullet";
    }): Promise<SummaryResult> {
        const result = await intelligenceClient.summarize(opts.text, {
            maxWords: opts.maxWords,
            style: opts.style,
        });

        if (opts.save) {
            await persistAiMetadata(opts.entryId, {
                summary: result.summary,
                summaryMeta: {
                    wordCount: result.word_count,
                    compressionRatio: result.compression_ratio,
                    model: result.model,
                    generatedAt: result.generated_at,
                },
            });
        }

        return result;
    },

    /**
     * Find duplicate entries for a given entry.
     */
    async findDuplicates(
        entryId: string,
        contentType: string
    ): Promise<{ candidates: DuplicateCandidate[]; latencyMs: number }> {
        const result = await intelligenceClient.findDuplicates(entryId, contentType);
        return { candidates: result.candidates, latencyMs: result.latencyMs };
    },

    /**
     * Scan an entire collection for duplicate pairs.
     */
    async scanDuplicates(contentType: string): Promise<{ pairs: DuplicatePair[]; total: number }> {
        return intelligenceClient.scanDuplicates(contentType);
    },
};
