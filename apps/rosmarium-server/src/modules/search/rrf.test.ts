/**
 * Unit tests for Reciprocal Rank Fusion — pure function, no DB required.
 */

import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "./rrf.js";
import type { SearchResult } from "./fulltext.search.js";
import type { VectorSearchResult } from "./vector.search.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFtResult(id: string, rank = 1): SearchResult {
    return {
        id,
        contentTypeId: "ct1",
        data: { title: `Entry ${id}` },
        status: "published",
        publishedAt: null,
        createdBy: null,
        rank,
        snippet: `Snippet for ${id}`,
    };
}

function makeVecResult(id: string, score = 0.9): VectorSearchResult {
    return {
        contentEntryId: id,
        chunkIndex: 0,
        chunkText: `Chunk for ${id}`,
        score,
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("reciprocalRankFusion", () => {
    it("returns [] when both lists are empty", () => {
        const result = reciprocalRankFusion({
            fulltextResults: [],
            vectorResults: [],
            alpha: 0.5,
            limit: 10,
        });
        expect(result).toEqual([]);
    });

    it("returns results when only fulltext list is populated", () => {
        const ft = [makeFtResult("a"), makeFtResult("b")];
        const result = reciprocalRankFusion({
            fulltextResults: ft,
            vectorResults: [],
            alpha: 0.5,
            limit: 10,
        });
        expect(result).toHaveLength(2);
        // Both get penalised vector rank (limit+1 = 11), but still ranked by ft rank
        expect(result[0]?.entryId).toBe("a"); // rank=1 beats rank=2
        expect(result[0]?.fulltextRank).toBe(1);
        expect(result[0]?.vectorRank).toBeUndefined();
    });

    it("returns results when only vector list is populated", () => {
        const vec = [makeVecResult("x"), makeVecResult("y")];
        const result = reciprocalRankFusion({
            fulltextResults: [],
            vectorResults: vec,
            alpha: 0.5,
            limit: 10,
        });
        expect(result).toHaveLength(2);
        expect(result[0]?.entryId).toBe("x");
        expect(result[0]?.vectorRank).toBe(1);
        expect(result[0]?.fulltextRank).toBeUndefined();
    });

    it("document appearing in both lists ranks above document in one list", () => {
        const ft = [makeFtResult("shared"), makeFtResult("ft-only")];
        const vec = [makeVecResult("shared"), makeVecResult("vec-only")];
        const result = reciprocalRankFusion({
            fulltextResults: ft,
            vectorResults: vec,
            alpha: 0.5,
            limit: 10,
        });
        // "shared" appears in both; should rank first
        expect(result[0]?.entryId).toBe("shared");
    });

    it("alpha=0 means fulltext dominates ranking (vector weight = 0)", () => {
        // With alpha=0: rrf = 0 * vec + 1 * ft → fulltext only
        const ft = [makeFtResult("ft1"), makeFtResult("ft2")];
        const vec = [makeVecResult("vec1"), makeVecResult("vec2")];
        const result = reciprocalRankFusion({
            fulltextResults: ft,
            vectorResults: vec,
            alpha: 0,
            limit: 10,
        });
        // ft1 and ft2 should rank above vec-only results
        const top2Ids = result.slice(0, 2).map((r) => r.entryId);
        expect(top2Ids).toContain("ft1");
        expect(top2Ids).toContain("ft2");
    });

    it("alpha=1 means vector dominates ranking (fulltext weight = 0)", () => {
        // With alpha=1: rrf = 1 * vec + 0 * ft → vector only
        const ft = [makeFtResult("ft1"), makeFtResult("ft2")];
        const vec = [makeVecResult("vec1"), makeVecResult("vec2")];
        const result = reciprocalRankFusion({
            fulltextResults: ft,
            vectorResults: vec,
            alpha: 1,
            limit: 10,
        });
        const top2Ids = result.slice(0, 2).map((r) => r.entryId);
        expect(top2Ids).toContain("vec1");
        expect(top2Ids).toContain("vec2");
    });

    it("alpha=0.5 means balanced — doc in both lists ranks above docs in one list", () => {
        const ft = [makeFtResult("shared"), makeFtResult("ft-only")];
        const vec = [makeVecResult("shared"), makeVecResult("vec-only")];
        const result = reciprocalRankFusion({
            fulltextResults: ft,
            vectorResults: vec,
            alpha: 0.5,
            limit: 5,
        });
        expect(result[0]?.entryId).toBe("shared");
        // Penalty for single-list docs makes them rank lower
        const sharedScore = result[0]!.rrfScore;
        const ftOnlyScore = result.find((r) => r.entryId === "ft-only")!.rrfScore;
        const vecOnlyScore = result.find((r) => r.entryId === "vec-only")!.rrfScore;
        expect(sharedScore).toBeGreaterThan(ftOnlyScore);
        expect(sharedScore).toBeGreaterThan(vecOnlyScore);
    });

    it("higher k constant → flatter score distribution (smaller range between top and bottom)", () => {
        const ft = [makeFtResult("a"), makeFtResult("b"), makeFtResult("c")];
        const vec = [makeVecResult("a"), makeVecResult("b"), makeVecResult("c")];

        const lowK = reciprocalRankFusion({ fulltextResults: ft, vectorResults: vec, alpha: 0.5, k: 1, limit: 5 });
        const highK = reciprocalRankFusion({ fulltextResults: ft, vectorResults: vec, alpha: 0.5, k: 60, limit: 5 });

        const rangeLowK = lowK[0]!.rrfScore - lowK[lowK.length - 1]!.rrfScore;
        const rangeHighK = highK[0]!.rrfScore - highK[highK.length - 1]!.rrfScore;

        expect(rangeLowK).toBeGreaterThan(rangeHighK);
    });

    it("respects the limit parameter", () => {
        const ft = Array.from({ length: 20 }, (_, i) => makeFtResult(`ft${i}`));
        const vec = Array.from({ length: 20 }, (_, i) => makeVecResult(`vec${i}`));
        const result = reciprocalRankFusion({ fulltextResults: ft, vectorResults: vec, alpha: 0.5, limit: 5 });
        expect(result).toHaveLength(5);
    });

    it("handles duplicate entry IDs across vector chunks (uses best rank per entry)", () => {
        const vec: VectorSearchResult[] = [
            { contentEntryId: "entry1", chunkIndex: 0, chunkText: "chunk 0", score: 0.9 },
            { contentEntryId: "entry1", chunkIndex: 1, chunkText: "chunk 1", score: 0.7 },
            { contentEntryId: "entry2", chunkIndex: 0, chunkText: "chunk 0", score: 0.8 },
        ];
        const result = reciprocalRankFusion({ fulltextResults: [], vectorResults: vec, alpha: 1, limit: 5 });
        // entry1 appears twice in vec — should count as rank 1
        expect(result[0]?.entryId).toBe("entry1");
        expect(result[0]?.vectorRank).toBe(1); // best rank wins
        // Total unique entries should be 2
        expect(result).toHaveLength(2);
    });
});
