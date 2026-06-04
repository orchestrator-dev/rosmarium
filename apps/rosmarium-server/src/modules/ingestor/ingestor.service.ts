/**
 * Ingestor service — manages content set records and dispatches ingestion jobs to BullMQ.
 *
 * Jobs are enqueued to the 'ingestion-jobs' Redis queue consumed by rosmarium-ai-worker.
 * SSE live progress is delivered via Redis pub/sub subscription from the route handler.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import Redis from "ioredis";
import { db } from "../../db/index.js";
import { contentSets, contentSetItems, contentEntries } from "../../db/schema/index.js";
import { config } from "../../config.js";
import type { ContentSet, ContentSetItem } from "../../db/schema/index.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SourceConfig =
    | { type: "web"; startUrl: string; maxDepth: number; includePatterns: string[]; excludePatterns: string[]; respectRobotsTxt: boolean; }
    | { type: "file"; path: string; format: "json" | "xml" | "text"; }
    | { type: "database"; provider: "postgres" | "mongo"; connectionString: string; queryOrCollection: string; }
    | { type: "cloud"; provider: "s3"; bucket: string; prefix?: string; endpoint?: string; };

export interface IngestorJobConfig {
    source: SourceConfig;
    maxPages: number;
    targetContentType?: string | null;
    importAs: "draft" | "published";
    tenantId?: string | null;
    contentSetName: string;
    apiKey: string;
    apiBaseUrl: string;
    duplicateThreshold: number;
    classificationModel?: string;
    systemPrompt?: string | null;
    userPrompt?: string | null;
}

export interface CreateJobOpts {
    config: IngestorJobConfig;
    userId: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const ingestorService = {
    /**
     * Create a content set record + enqueue BullMQ ingestion job.
     */
    async createJob(opts: CreateJobOpts): Promise<{ jobId: string; contentSetId: string }> {
        const jobId = createId();

        const sourceStr = opts.config.source.type === 'web' ? opts.config.source.startUrl :
            opts.config.source.type === 'file' ? opts.config.source.path :
            opts.config.source.type === 'database' ? `db://${opts.config.source.provider}` :
            `cloud://${opts.config.source.provider}/${opts.config.source.bucket}`;

        // Create content_sets record
        const [set] = await db
            .insert(contentSets)
            .values({
                name: opts.config.contentSetName,
                description: null,
                sourceUrl: sourceStr,
                jobId,
                status: "queued",
                config: opts.config as unknown as Record<string, unknown>,
                stats: {},
                tenantId: opts.config.tenantId ?? null,
                createdBy: opts.userId,
            })
            .returning();

        if (!set) throw new Error("Failed to create content set record");

        // Dispatch BullMQ job to ingestion-jobs queue
        await this._enqueueJob(jobId, set.id, opts.config);

        return { jobId, contentSetId: set.id };
    },

    /**
     * List content sets, newest first, paginated.
     */
    async listJobs(opts: {
        limit?: number;
        offset?: number;
        tenantId?: string | null;
    }): Promise<{ data: ContentSet[]; total: number }> {
        const limit = opts.limit ?? 20;
        const offset = opts.offset ?? 0;

        const conditions = opts.tenantId
            ? [eq(contentSets.tenantId, opts.tenantId)]
            : [];

        const [rows, totalResult] = await Promise.all([
            db
                .select()
                .from(contentSets)
                .where(conditions.length > 0 ? and(...conditions) : undefined)
                .orderBy(desc(contentSets.createdAt))
                .limit(limit)
                .offset(offset),
            db
                .select({ value: sql<number>`count(*)::int` })
                .from(contentSets)
                .where(conditions.length > 0 ? and(...conditions) : undefined),
        ]);

        return { data: rows, total: totalResult[0]?.value ?? 0 };
    },

    /**
     * Get a single content set by jobId, including recent items preview.
     */
    async getJob(jobId: string): Promise<ContentSet | null> {
        const [row] = await db
            .select()
            .from(contentSets)
            .where(eq(contentSets.jobId, jobId))
            .limit(1);
        return row ?? null;
    },

    /**
     * Cancel a running job: set Redis cancellation flag + update DB status.
     */
    async cancelJob(jobId: string): Promise<void> {
        // Set Redis cancellation flag (pipeline.py checks this per-page)
        const redis = new Redis(config.REDIS_URL);
        try {
            await redis.set(`ingestor:cancel:${jobId}`, "1", "EX", 86400);
        } finally {
            await redis.quit();
        }

        // Update DB status immediately (pipeline will also update async)
        await db
            .update(contentSets)
            .set({ status: "cancelled", completedAt: new Date() })
            .where(eq(contentSets.jobId, jobId));
    },

    /**
     * Rollback all imported entries for a content set.
     * Deletes all content_entries linked via content_set_items.
     */
    async rollbackJob(jobId: string): Promise<number> {
        const [set] = await db
            .select()
            .from(contentSets)
            .where(eq(contentSets.jobId, jobId))
            .limit(1);

        if (!set) return 0;

        // Fetch all entry IDs in the content set
        const items = await db
            .select({ entryId: contentSetItems.entryId })
            .from(contentSetItems)
            .where(
                and(
                    eq(contentSetItems.contentSetId, set.id),
                    eq(contentSetItems.status, "imported"),
                )
            );

        const entryIds = items.map((i) => i.entryId).filter(Boolean) as string[];

        if (entryIds.length > 0) {
            // Delete entries in bulk
            for (const entryId of entryIds) {
                await db.delete(contentEntries).where(eq(contentEntries.id, entryId));
            }
        }

        // Delete the content set (cascades to content_set_items)
        await db.delete(contentSets).where(eq(contentSets.id, set.id));

        return entryIds.length;
    },

    /**
     * Publish all draft entries in a content set.
     */
    async publishAll(jobId: string, updatedBy: string): Promise<number> {
        const [set] = await db
            .select()
            .from(contentSets)
            .where(eq(contentSets.jobId, jobId))
            .limit(1);

        if (!set) return 0;

        const items = await db
            .select({ entryId: contentSetItems.entryId })
            .from(contentSetItems)
            .where(
                and(
                    eq(contentSetItems.contentSetId, set.id),
                    eq(contentSetItems.status, "imported"),
                )
            );

        const entryIds = items.map((i) => i.entryId).filter(Boolean) as string[];
        let published = 0;

        for (const entryId of entryIds) {
            const [updated] = await db
                .update(contentEntries)
                .set({ status: "published", publishedAt: new Date(), updatedBy, updatedAt: new Date() })
                .where(and(eq(contentEntries.id, entryId), eq(contentEntries.status, "draft")))
                .returning({ id: contentEntries.id });
            if (updated) published++;
        }

        return published;
    },

    /**
     * Get paginated items for a content set, with optional status/type filters.
     */
    async getItems(
        jobId: string,
        opts: {
            limit?: number;
            offset?: number;
            status?: "imported" | "skipped" | "failed";
            contentType?: string;
        }
    ): Promise<{ data: ContentSetItem[]; total: number }> {
        const [set] = await db
            .select()
            .from(contentSets)
            .where(eq(contentSets.jobId, jobId))
            .limit(1);

        if (!set) return { data: [], total: 0 };

        const limit = opts.limit ?? 50;
        const offset = opts.offset ?? 0;

        const conditions = [eq(contentSetItems.contentSetId, set.id)];
        if (opts.status) conditions.push(eq(contentSetItems.status, opts.status));
        if (opts.contentType) conditions.push(eq(contentSetItems.contentType, opts.contentType));

        const [rows, totalResult] = await Promise.all([
            db
                .select()
                .from(contentSetItems)
                .where(and(...conditions))
                .orderBy(desc(contentSetItems.createdAt))
                .limit(limit)
                .offset(offset),
            db
                .select({ value: sql<number>`count(*)::int` })
                .from(contentSetItems)
                .where(and(...conditions)),
        ]);

        return { data: rows, total: totalResult[0]?.value ?? 0 };
    },

    /**
     * Remove a single item + delete its associated entry.
     */
    async deleteItem(itemId: string): Promise<void> {
        const [item] = await db
            .select()
            .from(contentSetItems)
            .where(eq(contentSetItems.id, itemId))
            .limit(1);

        if (!item) throw new Error(`Item '${itemId}' not found`);

        if (item.entryId) {
            await db.delete(contentEntries).where(eq(contentEntries.id, item.entryId));
        }
        await db.delete(contentSetItems).where(eq(contentSetItems.id, itemId));
    },

    // ── Private helpers ────────────────────────────────────────────────────────

    async _enqueueJob(
        jobId: string,
        contentSetId: string,
        config_: IngestorJobConfig
    ): Promise<void> {
        const redis = new Redis(config.REDIS_URL);
        try {
            const jobHash: Record<string, string> = {
                id: jobId,
                name: "ingest-website",
                data: JSON.stringify({ jobId, contentSetId, config: config_ }),
                opts: "{}",
                timestamp: String(Date.now()),
            };
            await redis.hset(`bull:ingestion-jobs:${jobId}`, jobHash);
            await redis.lpush("bull:ingestion-jobs:waiting", jobId);
        } finally {
            await redis.quit();
        }
    },
};
