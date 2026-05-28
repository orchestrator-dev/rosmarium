import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../config.js", () => ({
    config: {
        DATABASE_URL: "postgresql://test:test@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
        AI_WORKER_URL: "http://localhost:8001",
        AI_WORKER_SECRET: "test-secret",
        EMBEDDING_PROVIDER: "ollama",
        EMBEDDING_MODEL: "nomic-embed-text",
        OLLAMA_BASE_URL: "http://localhost:11434",
    },
}));

vi.mock("../../../db/index.js", () => ({
    db: {
        execute: vi.fn(),
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        transaction: vi.fn(),
    },
}));

vi.mock("../../../db/schema/index.js", () => ({
    graphEdges: { id: "id" },
    contentEntries: { id: "id", contentTypeId: "content_type_id", data: "data" },
}));

vi.mock("./traversal.engine.js", () => ({
    traverse: vi.fn(),
}));

vi.mock("../../search/vector.search.js", () => ({
    vectorSearch: vi.fn(),
}));

vi.mock("../../rbac/rbac.service.js", () => ({
    rbacService: {
        hasPermission: vi.fn().mockReturnValue(true),
        can: vi.fn().mockReturnValue(true),
        canAccessEntry: vi.fn().mockReturnValue(true),
        canOrThrow: vi.fn(),
        filterFields: vi.fn((_, __, data: unknown) => data),
    },
}));

import { getRecommendations } from "./recommender.js";
import { traverse } from "./traversal.engine.js";
import { vectorSearch } from "../../search/vector.search.js";
import { db } from "../../../db/index.js";
import type { AuthenticatedUser } from "../../auth/auth.service.js";

const testUser = {
    id: "user-1",
    email: "test@example.com",
    role: "editor",
} as unknown as AuthenticatedUser;

const emptyTraversal = { nodes: [], edges: [] };

describe("getRecommendations()", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(db.execute).mockResolvedValue([]);
        vi.mocked(traverse).mockResolvedValue(emptyTraversal as Awaited<ReturnType<typeof traverse>>);
        vi.mocked(vectorSearch).mockResolvedValue([]);
    });

    it("returns empty array when no graph or semantic candidates", async () => {
        const results = await getRecommendations({
            entryId: "entry-a",
            contentType: "article",
            user: testUser,
        });

        expect(results).toEqual([]);
    });

    it("returns graph candidates with graphScore > 0", async () => {
        vi.mocked(traverse).mockResolvedValue({
            nodes: [
                { entryId: "entry-a", contentType: "article", depth: 0 }, // root — excluded
                { entryId: "entry-b", contentType: "article", depth: 1 },
                { entryId: "entry-c", contentType: "article", depth: 2 },
            ],
            edges: [
                { id: "e1", fromEntryId: "entry-a", toEntryId: "entry-b", edgeType: "RELATED_TO", weight: 1, depth: 1 },
            ],
        } as Awaited<ReturnType<typeof traverse>>);

        const results = await getRecommendations({
            entryId: "entry-a",
            contentType: "article",
            user: testUser,
            limit: 10,
        });

        const entryB = results.find((r) => r.entryId === "entry-b");
        expect(entryB).toBeDefined();
        expect(entryB?.graphScore).toBeGreaterThan(0);
        expect(entryB?.combinedScore).toBeGreaterThan(0);

        const entryC = results.find((r) => r.entryId === "entry-c");
        if (entryC) {
            expect(entryC.graphScore).toBeLessThan(entryB!.graphScore);
        }
    });

    it("respects the limit parameter", async () => {
        const manyNodes = Array.from({ length: 20 }, (_, i) => ({
            entryId: `entry-${i}`,
            contentType: "article",
            depth: 1,
        }));
        vi.mocked(traverse).mockResolvedValue({
            nodes: manyNodes,
            edges: [],
        } as Awaited<ReturnType<typeof traverse>>);

        const results = await getRecommendations({
            entryId: "entry-root",
            contentType: "article",
            user: testUser,
            limit: 3,
        });

        expect(results.length).toBeLessThanOrEqual(3);
    });

    it("blends graph and semantic scores into combinedScore", async () => {
        vi.mocked(traverse).mockResolvedValue({
            nodes: [{ entryId: "entry-b", contentType: "article", depth: 1 }],
            edges: [],
        } as Awaited<ReturnType<typeof traverse>>);

        // First db.execute → return a fake embedding so the semantic path runs
        vi.mocked(db.execute).mockResolvedValueOnce([
            { embedding: "[0.1,0.2,0.3]" },
        ]);

        // vectorSearch returns entry-b with high semantic similarity
        vi.mocked(vectorSearch).mockResolvedValueOnce([
            { contentEntryId: "entry-b", chunkIndex: 0, chunkText: "sample", score: 0.9 },
        ]);

        const results = await getRecommendations({
            entryId: "entry-a",
            contentType: "article",
            user: testUser,
        });

        const entryB = results.find((r) => r.entryId === "entry-b");
        expect(entryB?.semanticScore).toBeGreaterThan(0);
        // combinedScore = 0.6 * graphScore + 0.4 * semanticScore — always > 0
        expect(entryB?.combinedScore).toBeGreaterThan(0);
        // And the semantic contribution should be reflected (not pure graph-only)
        expect(entryB?.combinedScore).toBeLessThanOrEqual(
            (entryB?.graphScore ?? 0) + (entryB?.semanticScore ?? 0),
        );
    });

    it("propagates traverse errors", async () => {
        vi.mocked(traverse).mockRejectedValue(new Error("Graph traversal failed"));

        await expect(
            getRecommendations({ entryId: "a", contentType: "article", user: testUser }),
        ).rejects.toThrow("Graph traversal failed");
    });
});
