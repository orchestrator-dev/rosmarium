/**
 * Search service — orchestrates hybrid BM25 + pgvector search.
 *
 * Flow:
 *  1. Validate input
 *  2. Get query embedding from ai-worker (with graceful fallback to fulltext-only)
 *  3. Run BM25 fulltext + vector searches in parallel (Promise.all)
 *  4. Apply RBAC filter to fulltext results
 *  5. Fuse with Reciprocal Rank Fusion
 *  6. Fetch full entry records for top results (single inArray query)
 *  7. Return ranked list with scores and snippets
 */

import { sql, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { contentEntries } from "../../db/schema/index.js";
import { logger } from "../../lib/logger.js";
import { registry } from "../content/registry.js";
import { rbacService } from "../rbac/rbac.service.js";
import type { AuthenticatedUser } from "../auth/auth.service.js";
import { aiWorkerClient, SearchEmbeddingError } from "./ai-worker.client.js";
import { fulltextSearch } from "./fulltext.search.js";
import { vectorSearch } from "./vector.search.js";
import { reciprocalRankFusion } from "./rrf.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchMatchType = "fulltext" | "vector" | "hybrid";

export interface SearchResultItem {
    id: string;
    contentType: string;
    data: Record<string, unknown>;
    status: string;
    publishedAt: string | null;
    score: number;
    matchType: SearchMatchType;
    snippet: string | null;
    chunkText: string | null;
}

export interface SearchResponse {
    data: SearchResultItem[];
    meta: {
        query: string;
        total: number;
        alpha: number;
        contentTypes: string[];
        latencyMs: number;
        embeddingProvider: string | null;
    };
}

// ─── Validation ───────────────────────────────────────────────────────────────

const MAX_QUERY_LENGTH = 500;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_ALPHA = 0.5;
const RRF_OVERSCAN = 3; // fetch limit*3 candidates before fusing

// ─── Service ──────────────────────────────────────────────────────────────────

export const searchService = {
    /**
     * Hybrid search: BM25 + pgvector with Reciprocal Rank Fusion.
     */
    async search(opts: {
        query: string;
        contentType?: string;
        locale?: string;
        status?: string;
        alpha?: number;
        limit?: number;
        cursor?: string;
        user: AuthenticatedUser;
    }): Promise<SearchResponse> {
        const start = Date.now();

        // --- 1. Validate ---
        const query = opts.query?.trim() ?? "";
        if (!query) {
            return emptyResponse(query, opts.alpha ?? DEFAULT_ALPHA, start);
        }
        if (query.length > MAX_QUERY_LENGTH) {
            throw new Error(`Query too long — max ${MAX_QUERY_LENGTH} characters`);
        }

        const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
        const alpha = Math.min(1, Math.max(0, opts.alpha ?? DEFAULT_ALPHA));
        const status = opts.status ?? "published";

        // --- 2. Determine which content types to search ---
        const allTypes = registry.getAll();
        const typesToSearch = opts.contentType
            ? allTypes.filter((t) => t.name === opts.contentType)
            : allTypes;

        const contentTypeNames = typesToSearch.map((t) => t.name);
        const contentTypeIds = typesToSearch.map((t) => t.id);
        // Suppress unused-variable lint — used as fallback downstream
        void contentTypeIds[0];

        // --- 3. Get query embedding (with graceful fallback) ---
        let embedding: number[] | null = null;
        let embeddingModel: string | null = null;
        let effectiveAlpha = alpha;

        try {
            const embedResult = await aiWorkerClient.embedQuery(query);
            embedding = embedResult.embedding;
            embeddingModel = embedResult.model;
        } catch (err) {
            if (err instanceof SearchEmbeddingError) {
                logger.warn({
                    msg: "search_embedding_unavailable_fallback_to_fulltext",
                    error: err.code,
                });
                // Graceful degradation — fulltext only
                effectiveAlpha = 0;
            } else {
                throw err;
            }
        }

        // --- 4. Run searches in parallel ---
        const candidateLimit = limit * RRF_OVERSCAN;

        const [fulltextResults, vectorResults] = await Promise.all([
            fulltextSearch({
                query,
                contentTypeId: contentTypeIds.length === 1 ? contentTypeIds[0] : undefined,
                locale: opts.locale,
                status,
                limit: candidateLimit,
            }),
            embedding && contentTypeNames.length > 0
                ? vectorSearch({
                      embedding,
                      contentType: contentTypeNames[0] ?? "",
                      limit: candidateLimit,
                  })
                : Promise.resolve([]),
        ]);

        // --- 5. Apply RBAC filter to fulltext results ---
        const allowedFulltextResults = fulltextResults.filter((entry) =>
            rbacService.canAccessEntry(
                opts.user,
                entry as unknown as Parameters<typeof rbacService.canAccessEntry>[1],
                "read"
            )
        );

        // --- 6. Fuse with RRF ---
        const fused = reciprocalRankFusion({
            fulltextResults: allowedFulltextResults,
            vectorResults,
            alpha: effectiveAlpha,
            limit,
        });

        if (fused.length === 0) {
            return emptyResponse(query, effectiveAlpha, start, contentTypeNames, embeddingModel);
        }

        // --- 7. Fetch full entry records (single inArray query) ---
        const topIds = fused.map((r) => r.entryId);
        const entries = await db
            .select()
            .from(contentEntries)
            .where(inArray(contentEntries.id, topIds));

        // Build a lookup map so we can preserve RRF order
        const entryMap = new Map(entries.map((e) => [e.id, e]));

        // Build content type name lookup by id
        const typeNameById = new Map(allTypes.map((t) => [t.id, t.name]));

        // --- 8. Build response ---
        const resultItems: SearchResultItem[] = [];
        for (const fusedItem of fused) {
            const entry = entryMap.get(fusedItem.entryId);
            if (!entry) continue; // shouldn't happen, but guard

            const hasFulltext = fusedItem.fulltextRank !== undefined;
            const hasVector = fusedItem.vectorRank !== undefined;
            const matchType: SearchMatchType =
                hasFulltext && hasVector ? "hybrid" : hasFulltext ? "fulltext" : "vector";

            resultItems.push({
                id: entry.id,
                contentType: typeNameById.get(entry.contentTypeId) ?? entry.contentTypeId,
                data: (entry.data as Record<string, unknown>) ?? {},
                status: entry.status,
                publishedAt: entry.publishedAt?.toISOString() ?? null,
                score: fusedItem.rrfScore,
                matchType,
                snippet: fusedItem.snippet ?? null,
                chunkText: fusedItem.vectorChunkText ?? null,
            });
        }

        const latencyMs = Date.now() - start;

        return {
            data: resultItems,
            meta: {
                query,
                total: resultItems.length,
                alpha: effectiveAlpha,
                contentTypes: contentTypeNames,
                latencyMs,
                embeddingProvider: embeddingModel,
            },
        };
    },

    /**
     * Quick prefix suggestions for autocomplete.
     * Queries title field only — no embedding needed.
     */
    async suggest(opts: {
        query: string;
        contentType?: string;
        limit?: number;
    }): Promise<string[]> {
        const query = opts.query?.trim() ?? "";
        if (!query) return [];

        const limit = Math.min(opts.limit ?? 5, 20);

        const rows = await db.execute(sql`
            SELECT DISTINCT data->>'title' AS title
            FROM content_entries
            WHERE
                data->>'title' IS NOT NULL
                AND data->>'title' ILIKE ${query + "%"}
                ${opts.contentType
                    ? sql`AND content_type_id = (
                        SELECT id FROM content_types WHERE name = ${opts.contentType} LIMIT 1
                      )`
                    : sql``}
            LIMIT ${limit}
        `);

        return rows
            .map((r) => r["title"])
            .filter((t): t is string => typeof t === "string" && t.length > 0);
    },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function emptyResponse(
    query: string,
    alpha: number,
    startMs: number,
    contentTypes: string[] = [],
    embeddingProvider: string | null = null
): SearchResponse {
    return {
        data: [],
        meta: {
            query,
            total: 0,
            alpha,
            contentTypes,
            latencyMs: Date.now() - startMs,
            embeddingProvider,
        },
    };
}
