/**
 * Reciprocal Rank Fusion (RRF) — pure function, no database calls.
 *
 * Merges full-text (BM25) and vector (cosine) result lists into a single
 * ranked list using the RRF formula:
 *
 *   rrf_score = alpha * (1 / (k + vector_rank))
 *             + (1 - alpha) * (1 / (k + fulltext_rank))
 *
 * Documents missing from one list are penalised with rank = (limit + 1).
 *
 * References:
 *   Cormack, Clarke, Buettcher (2009) — "Reciprocal Rank Fusion outperforms
 *   Condorcet and individual Rank Learning Methods"
 */

import type { SearchResult } from "./fulltext.search.js";
import type { VectorSearchResult } from "./vector.search.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FusedResult {
    entryId: string;
    rrfScore: number;
    fulltextRank?: number;
    vectorRank?: number;
    snippet?: string | null;
    vectorChunkText?: string | null;
}

// ─── RRF ──────────────────────────────────────────────────────────────────────

export function reciprocalRankFusion(opts: {
    fulltextResults: SearchResult[];
    vectorResults: VectorSearchResult[];
    alpha: number;
    k?: number;
    limit: number;
}): FusedResult[] {
    const { fulltextResults, vectorResults, alpha, k = 60, limit } = opts;

    // --- 1. Build rank maps (1-indexed) ---
    const ftRankMap = new Map<string, number>();
    fulltextResults.forEach((r, idx) => {
        ftRankMap.set(r.id, idx + 1);
    });

    const vecRankMap = new Map<string, number>();
    // Vector results: one entry may appear multiple times (different chunks)
    // Use the best (lowest) rank per entry.
    vectorResults.forEach((r, idx) => {
        const existingRank = vecRankMap.get(r.contentEntryId);
        if (existingRank === undefined) {
            vecRankMap.set(r.contentEntryId, idx + 1);
        }
    });

    // Snippet and chunk text lookup
    const ftSnippetMap = new Map<string, string | null>();
    fulltextResults.forEach((r) => ftSnippetMap.set(r.id, r.snippet ?? null));

    const vecChunkMap = new Map<string, string>();
    vectorResults.forEach((r) => {
        if (!vecChunkMap.has(r.contentEntryId)) {
            vecChunkMap.set(r.contentEntryId, r.chunkText);
        }
    });

    // --- 2. Union all unique entry IDs ---
    const allEntryIds = new Set<string>([
        ...ftRankMap.keys(),
        ...vecRankMap.keys(),
    ]);

    // Penalty rank for documents missing from one list
    const missingRankPenalty = limit + 1;

    // --- 3. Compute RRF scores ---
    const scored: FusedResult[] = [];

    for (const entryId of allEntryIds) {
        const ftRank = ftRankMap.get(entryId) ?? missingRankPenalty;
        const vecRank = vecRankMap.get(entryId) ?? missingRankPenalty;

        const rrfScore =
            alpha * (1 / (k + vecRank)) +
            (1 - alpha) * (1 / (k + ftRank));

        scored.push({
            entryId,
            rrfScore,
            fulltextRank: ftRankMap.has(entryId) ? ftRank : undefined,
            vectorRank: vecRankMap.has(entryId) ? vecRank : undefined,
            snippet: ftSnippetMap.get(entryId) ?? null,
            vectorChunkText: vecChunkMap.get(entryId) ?? null,
        });
    }

    // --- 4. Sort by RRF score descending, return top {limit} ---
    scored.sort((a, b) => b.rrfScore - a.rrfScore);
    return scored.slice(0, limit);
}
