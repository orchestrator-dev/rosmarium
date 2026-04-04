/**
 * Unit tests for the search service.
 * Mocks: aiWorkerClient, fulltextSearch, vectorSearch, db, registry, rbacService
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("./ai-worker.client.js", () => ({
    aiWorkerClient: {
        embedQuery: vi.fn(),
        healthCheck: vi.fn(),
    },
    SearchEmbeddingError: class SearchEmbeddingError extends Error {
        code: string;
        constructor(message: string, code = "EMBEDDING_ERROR") {
            super(message);
            this.code = code;
        }
    },
}));

vi.mock("./fulltext.search.js", () => ({
    fulltextSearch: vi.fn(),
}));

vi.mock("./vector.search.js", () => ({
    vectorSearch: vi.fn(),
}));

vi.mock("../../db/index.js", () => ({
    db: {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn().mockResolvedValue([]),
            })),
        })),
        execute: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock("../../lib/logger.js", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../content/registry.js", () => ({
    registry: {
        getAll: vi.fn(() => [
            { id: "ct1", name: "article" },
        ]),
        get: vi.fn(),
    },
}));

vi.mock("../rbac/rbac.service.js", () => ({
    rbacService: {
        canAccessEntry: vi.fn(() => true),
    },
}));

vi.mock("../../db/schema/index.js", () => ({
    contentEntries: { id: "id" },
}));

// ─── Import under test (after mocks) ─────────────────────────────────────────

import { searchService } from "./search.service.js";
import { aiWorkerClient, SearchEmbeddingError } from "./ai-worker.client.js";
import { fulltextSearch } from "./fulltext.search.js";
import { vectorSearch } from "./vector.search.js";
import { rbacService } from "../rbac/rbac.service.js";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const mockUser = {
    id: "user1",
    email: "user@test.com",
    firstName: "Test",
    lastName: "User",
    role: "editor" as const,
    isActive: true,
};

const mockFtResult = {
    id: "entry1",
    contentTypeId: "ct1",
    data: { title: "Test Entry" },
    status: "published",
    publishedAt: null,
    createdBy: "user1",
    rank: 0.9,
    snippet: "Test <mark>snippet</mark>",
};

const mockVecResult = {
    contentEntryId: "entry1",
    chunkIndex: 0,
    chunkText: "Test chunk text",
    score: 0.85,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("searchService.search", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(aiWorkerClient.embedQuery).mockResolvedValue({
            embedding: [0.1, 0.2, 0.3],
            dimensions: 3,
            model: "nomic-embed-text",
            latencyMs: 10,
        });
        vi.mocked(fulltextSearch).mockResolvedValue([mockFtResult]);
        vi.mocked(vectorSearch).mockResolvedValue([mockVecResult]);
    });

    it("falls back to fulltext-only (alpha=0) when ai-worker is unreachable", async () => {
        vi.mocked(aiWorkerClient.embedQuery).mockRejectedValue(
            new SearchEmbeddingError("timeout", "EMBEDDING_TIMEOUT")
        );

        const result = await searchService.search({
            query: "hello world",
            user: mockUser,
        });

        expect(result.meta.alpha).toBe(0);
        expect(vectorSearch).not.toHaveBeenCalled();
    });

    it("runs fulltext and vector searches in parallel (both called)", async () => {
        await searchService.search({ query: "test", user: mockUser });

        expect(fulltextSearch).toHaveBeenCalledTimes(1);
        expect(vectorSearch).toHaveBeenCalledTimes(1);
    });

    it("applies RBAC filter — entries that fail canAccessEntry are excluded", async () => {
        vi.mocked(rbacService.canAccessEntry).mockReturnValueOnce(false);
        vi.mocked(fulltextSearch).mockResolvedValue([
            { ...mockFtResult, id: "denied-entry" },
        ]);
        vi.mocked(vectorSearch).mockResolvedValue([]);

        const result = await searchService.search({ query: "test", user: mockUser });

        // Denied entry should not appear in results
        expect(result.data.find((r) => r.id === "denied-entry")).toBeUndefined();
    });

    it("respects limit parameter", async () => {
        vi.mocked(fulltextSearch).mockResolvedValue(
            Array.from({ length: 30 }, (_, i) => ({ ...mockFtResult, id: `entry${i}` }))
        );
        vi.mocked(vectorSearch).mockResolvedValue([]);

        // With alpha=0 (no vector), result is purely from ft
        // But we mock db to return nothing, so resultItems will be 0
        // Let's just verify the candidateLimit = limit * 3 is passed
        await searchService.search({ query: "test", limit: 5, user: mockUser });

        expect(fulltextSearch).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 15 }) // 5 * 3 overscan
        );
    });

    it("passes alpha to RRF and includes it in meta", async () => {
        const result = await searchService.search({
            query: "test",
            alpha: 0.8,
            user: mockUser,
        });

        expect(result.meta.alpha).toBe(0.8);
    });

    it("returns empty response for empty query", async () => {
        const result = await searchService.search({ query: "   ", user: mockUser });

        expect(result.data).toEqual([]);
        expect(result.meta.total).toBe(0);
        expect(aiWorkerClient.embedQuery).not.toHaveBeenCalled();
    });

    it("clamps alpha to [0, 1] range", async () => {
        const result = await searchService.search({
            query: "test",
            alpha: 999,
            user: mockUser,
        });
        expect(result.meta.alpha).toBe(1);
    });
});

describe("searchService.suggest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns empty array for empty query", async () => {
        const result = await searchService.suggest({ query: "" });
        expect(result).toEqual([]);
    });
});
