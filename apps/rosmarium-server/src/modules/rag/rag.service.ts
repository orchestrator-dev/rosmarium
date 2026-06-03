/**
 * RAG service — orchestrates retrieval from AI worker with RBAC resolution
 * and content entry enrichment.
 *
 * Consumed by routes/rag.ts.
 */

import { db } from "../../db/index.js";
import { contentEntries } from "../../db/schema/index.js";
import { inArray } from "drizzle-orm";
import { ragClient } from "./rag.client.js";
import type {
    RagChunk,
    RagChunkEvent,
    RagDoneEvent,
    RagErrorEvent,
    RagStreamEvent,
} from "./rag.client.js";
import { rbacService } from "../rbac/rbac.service.js";
import { PERMISSIONS } from "../rbac/permissions.js";
import type { AuthenticatedUser } from "../auth/auth.service.js";
import type { ContentEntry } from "../../db/schema/index.js";
import { graphEdges } from "../../db/schema/index.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RagFormat = "chunks" | "context" | "json";

export interface EnrichedChunk extends RagChunk {
    entry: Pick<ContentEntry, "id" | "contentTypeId" | "status" | "data" | "publishedAt"> | null;
}

export interface RagChunksResponse {
    format: "chunks";
    chunks: EnrichedChunk[];
    meta: RagMeta;
}

export interface RagContextResponse {
    format: "context";
    context: string;
    chunks: number;
    tokens: number;
    meta: RagMeta;
}

export interface RagJsonResponse {
    format: "json";
    chunks: Record<string, unknown>[];
    meta: RagMeta;
}

export interface RagMeta {
    query: string;
    total: number;
    latencyMs: number;
    reranked: boolean;
    format: RagFormat;
}

export type RagResponse = RagChunksResponse | RagContextResponse | RagJsonResponse;

export type { RagChunkEvent, RagDoneEvent, RagErrorEvent, RagStreamEvent };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve which content types have embedding tables.
 * Queries information_schema to find tables matching the rosmarium_*_embeddings pattern.
 */
async function resolveContentTypes(requested?: string[]): Promise<string[]> {
    if (requested && requested.length > 0) return requested;

    try {
        // Use raw SQL to query information_schema for embedding tables
        const client = db as unknown as {
            execute: (sql: string) => Promise<Array<{ table_name: string }>>;
        };
        const rows = await client.execute(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'rosmarium_%_embeddings'`
        );
        if (Array.isArray(rows) && rows.length > 0) {
            return rows.map((r) =>
                (r.table_name ?? "").replace(/^rosmarium_/, "").replace(/_embeddings$/, "")
            );
        }
    } catch {
        // Fall through — no embedding tables found or DB unavailable
    }

    return [];
}

/**
 * Resolve the allowedEntryIds list for RBAC.
 * - CONTENT_READ_ANY  → return [] (no filter — all entries accessible)
 * - CONTENT_READ_OWN  → query content_entries WHERE created_by = user.id
 */
async function resolveAllowedEntryIds(user: AuthenticatedUser): Promise<string[]> {
    if (rbacService.can(user, PERMISSIONS.CONTENT_READ_ANY)) {
        return []; // empty = no ACL restriction
    }

    // Fetch only entries created by this user
    const rows = await db
        .select({ id: contentEntries.id })
        .from(contentEntries)
        .where(inArray(contentEntries.createdBy as Parameters<typeof inArray>[0], [user.id]));

    return rows.map((r) => r.id);
}

/**
 * Format retrieved chunks as a numbered LLM context string.
 */
function formatAsContext(chunks: RagChunk[], query: string, maxTokens: number): string {
    const CHARS_PER_TOKEN = 4;
    const budget = maxTokens * CHARS_PER_TOKEN;

    const header = `RETRIEVED CONTEXT\nQuery: ${query}\n\n`;
    const footer =
        "\nUse this context to answer the query accurately.\n" +
        "If the context does not contain enough information, say so.";

    let used = header.length + footer.length;
    const sections: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        const section =
            `[${i + 1}] Source: ${chunk.contentType}/${chunk.contentEntryId}\n` +
            `    Score: ${chunk.freshnessScore.toFixed(4)}\n` +
            `    ---\n` +
            `    ${chunk.chunkText}\n\n`;

        if (used + section.length > budget) {
            const remaining = budget - used - (section.length - chunk.chunkText.length);
            if (remaining > 40) {
                const truncated = chunk.chunkText.slice(0, remaining) + "…";
                sections.push(
                    `[${i + 1}] Source: ${chunk.contentType}/${chunk.contentEntryId}\n` +
                        `    Score: ${chunk.freshnessScore.toFixed(4)}\n` +
                        `    ---\n` +
                        `    ${truncated}\n\n`
                );
            }
            break;
        }

        sections.push(section);
        used += section.length;
    }

    return header + sections.join("") + footer;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const ragService = {
    /**
     * Retrieve content chunks with RBAC-aware filtering.
     *
     * @param opts.query         - User search query (max 1000 chars)
     * @param opts.contentTypes  - Content types to search (default: all with embeddings)
     * @param opts.topK          - Max results (1–50, default 10)
     * @param opts.rerank        - Enable Cohere rerank (default false)
     * @param opts.format        - Response format: 'chunks' | 'context' | 'json'
     * @param opts.maxTokens     - Token budget for context format (default 4000)
     * @param opts.enhanceWithGraph - Blend vector with graph neighbors (default false)
     * @param opts.user          - Authenticated user (for RBAC)
     */
    async retrieve(opts: {
        query: string;
        contentTypes?: string[];
        topK?: number;
        rerank?: boolean;
        format?: RagFormat;
        maxTokens?: number;
        enhanceWithGraph?: boolean;
        user: AuthenticatedUser;
    }): Promise<RagResponse> {
        const { query, user } = opts;
        const topK = Math.min(Math.max(opts.topK ?? 10, 1), 50);
        const format: RagFormat = opts.format ?? "chunks";
        const maxTokens = opts.maxTokens ?? 4000;

        if (!query || !query.trim()) {
            throw new Error("Query is required");
        }
        if (query.length > 1000) {
            throw new Error("Query exceeds maximum length of 1000 characters");
        }

        // Resolve content types and RBAC
        const [contentTypes, allowedEntryIds] = await Promise.all([
            resolveContentTypes(opts.contentTypes),
            resolveAllowedEntryIds(user),
        ]);

        if (contentTypes.length === 0) {
            const emptyMeta = { query, total: 0, latencyMs: 0, reranked: false, format };
            if (format === "chunks") return { format: "chunks", chunks: [], meta: emptyMeta };
            if (format === "json") return { format: "json", chunks: [], meta: emptyMeta };
            return { format: "context", context: "RETRIEVED CONTEXT\nQuery: " + query + "\n\nNo content found.", chunks: 0, tokens: 0, meta: emptyMeta };
        }

        const workerResponse = await ragClient.retrieve({
            query,
            contentTypes,
            allowedEntryIds,
            topK,
            rerank: opts.rerank ?? false,
        });

        if (opts.enhanceWithGraph && workerResponse.chunks.length > 0) {
            // Find graph neighbors of top 5 results
            const baseEntryIds = [...new Set(workerResponse.chunks.map(c => c.contentEntryId))].slice(0, 5);
            const edges = await db.select().from(graphEdges).where(inArray(graphEdges.fromEntryId, baseEntryIds));
            const neighborIds = edges.map(e => e.toEntryId);
            
            if (neighborIds.length > 0) {
                // Fetch chunks from neighbors to enhance context
                const neighborResponse = await ragClient.retrieve({
                    query,
                    contentTypes,
                    allowedEntryIds: neighborIds,
                    topK: 5,
                    rerank: false
                });

                for (const nc of neighborResponse.chunks) {
                    if (!workerResponse.chunks.some(c => c.contentEntryId === nc.contentEntryId && c.chunkIndex === nc.chunkIndex)) {
                        nc.score = nc.score * 0.9; // Apply graph discount
                        workerResponse.chunks.push(nc);
                    }
                }
                // Re-sort and truncate
                workerResponse.chunks.sort((a, b) => b.score - a.score);
                workerResponse.chunks = workerResponse.chunks.slice(0, topK);
            }
        }

        const meta: RagMeta = {
            query: workerResponse.query,
            total: workerResponse.total,
            latencyMs: workerResponse.latencyMs,
            reranked: workerResponse.reranked,
            format,
        };

        // Enrich chunks with full content entry records (single query)
        const entryIds = [...new Set(workerResponse.chunks.map((c) => c.contentEntryId))];
        const entryMap = new Map<string, ContentEntry>();

        if (entryIds.length > 0) {
            const entries = await db
                .select()
                .from(contentEntries)
                .where(inArray(contentEntries.id, entryIds));
            for (const entry of entries) {
                entryMap.set(entry.id, entry);
            }
        }

        const enrichedChunks: EnrichedChunk[] = workerResponse.chunks.map((c) => {
            const entry = entryMap.get(c.contentEntryId) ?? null;
            return {
                ...c,
                entry: entry
                    ? {
                          id: entry.id,
                          contentTypeId: entry.contentTypeId,
                          status: entry.status,
                          data: entry.data as Record<string, unknown>,
                          publishedAt: entry.publishedAt,
                      }
                    : null,
            };
        });

        // Apply requested format
        if (format === "context") {
            const contextStr = formatAsContext(workerResponse.chunks, query, maxTokens);
            return {
                format: "context",
                context: contextStr,
                chunks: enrichedChunks.length,
                tokens: Math.ceil(contextStr.length / 4),
                meta,
            } satisfies RagContextResponse;
        }

        if (format === "json") {
            return {
                format: "json",
                chunks: enrichedChunks.map((c) => ({
                    contentEntryId: c.contentEntryId,
                    contentType: c.contentType,
                    chunkIndex: c.chunkIndex,
                    chunkText: c.chunkText,
                    score: c.score,
                    freshnessScore: c.freshnessScore,
                    publishedAt: c.publishedAt,
                    metadata: c.metadata,
                    entry: c.entry,
                })),
                meta,
            } satisfies RagJsonResponse;
        }

        // Default: chunks format
        return {
            format: "chunks",
            chunks: enrichedChunks,
            meta,
        } satisfies RagChunksResponse;
    },

    /**
     * Stream RAG retrieval as Server-Sent Events.
     *
     * Yields RagStreamEvent objects from the AI worker stream after RBAC resolution.
     */
    async *retrieveStream(opts: {
        query: string;
        contentTypes?: string[];
        topK?: number;
        user: AuthenticatedUser;
    }): AsyncGenerator<RagStreamEvent> {
        const [contentTypes, allowedEntryIds] = await Promise.all([
            resolveContentTypes(opts.contentTypes),
            resolveAllowedEntryIds(opts.user),
        ]);

        if (contentTypes.length === 0) {
            yield { type: "done", total: 0, latencyMs: 0, reranked: false };
            return;
        }

        yield* ragClient.retrieveStream({
            query: opts.query,
            contentTypes,
            allowedEntryIds,
            topK: opts.topK,
        });
    },
};
