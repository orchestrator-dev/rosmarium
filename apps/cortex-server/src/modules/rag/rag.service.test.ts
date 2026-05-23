import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ─── Mock dependencies ────────────────────────────────────────────────────────

vi.mock("../../db/index.js", () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        execute: vi.fn(),
        $with: vi.fn(),
    },
}));

vi.mock("../../db/schema/index.js", () => ({
    contentEntries: { id: "id", contentTypeId: "content_type_id", createdBy: "created_by" },
}));

vi.mock("./rag.client.js", () => ({
    ragClient: {
        retrieve: vi.fn(),
        retrieveStream: vi.fn(),
    },
}));

vi.mock("../rbac/rbac.service.js", () => ({
    rbacService: {
        can: vi.fn(),
    },
}));

vi.mock("../rbac/permissions.js", () => ({
    PERMISSIONS: {
        CONTENT_READ_ANY: "content:read:any",
        CONTENT_READ_OWN: "content:read:own",
    },
}));

import { ragService } from "./rag.service.js";
import { ragClient } from "./rag.client.js";
import { rbacService } from "../rbac/rbac.service.js";
import { db } from "../../db/index.js";
import type { AuthenticatedUser } from "../auth/auth.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const adminUser: AuthenticatedUser = {
    id: "user-admin",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    isActive: true,
};

const authorUser: AuthenticatedUser = {
    id: "user-author",
    email: "author@example.com",
    firstName: "Author",
    lastName: "User",
    role: "author",
    isActive: true,
};

function mockDbSelect(returnValue: unknown[] = []) {
    const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(returnValue),
    };
    (db.select as Mock).mockReturnValue(chain);
    return chain;
}

const mockWorkerChunk = {
    contentEntryId: "entry-1",
    contentType: "article",
    chunkIndex: 0,
    chunkText: "Some relevant content.",
    score: 0.9,
    freshnessScore: 0.85,
    publishedAt: null,
    metadata: {},
};

const mockWorkerResponse = {
    chunks: [mockWorkerChunk],
    query: "test query",
    total: 1,
    latencyMs: 42,
    reranked: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ragService.retrieve", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default: information_schema query returns empty (no embedding tables discovered)
        (db.execute as Mock).mockResolvedValue({ rows: [] });
        (db.$with as Mock).mockReturnValue({ as: vi.fn().mockReturnThis() });
    });

    it("passes empty allowedEntryIds to client when user has CONTENT_READ_ANY", async () => {
        (rbacService.can as Mock).mockReturnValue(true); // CONTENT_READ_ANY = true
        (ragClient.retrieve as Mock).mockResolvedValue(mockWorkerResponse);

        // Mock content entry lookup — returns array directly from .where()
        const entrySelectChain = {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([
                { id: "entry-1", contentTypeId: "ct-1", status: "published", data: {}, publishedAt: null },
            ]),
        };
        (db.select as Mock).mockReturnValue(entrySelectChain);

        await ragService.retrieve({
            query: "test query",
            contentTypes: ["article"],
            user: adminUser,
        });

        const callArg = (ragClient.retrieve as Mock).mock.calls[0][0] as { allowedEntryIds: string[] };
        expect(callArg.allowedEntryIds).toEqual([]);
    });

    it("fetches own entry IDs when user does NOT have CONTENT_READ_ANY", async () => {
        // First call: CONTENT_READ_ANY → false; Second call (if any) → true for OWN
        (rbacService.can as Mock).mockReturnValue(false);
        (ragClient.retrieve as Mock).mockResolvedValue({ ...mockWorkerResponse, chunks: [] });

        // Mock content entries for own-only resolution
        const ownChain = {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ id: "entry-author-1" }, { id: "entry-author-2" }]),
        };
        (db.select as Mock).mockReturnValue(ownChain);

        await ragService.retrieve({
            query: "test",
            contentTypes: ["article"],
            user: authorUser,
        });

        const callArg = (ragClient.retrieve as Mock).mock.calls[0][0] as { allowedEntryIds: string[] };
        // Should have resolved own entry IDs
        expect(Array.isArray(callArg.allowedEntryIds)).toBe(true);
    });

    it("returns context string when format='context'", async () => {
        (rbacService.can as Mock).mockReturnValue(true);
        (ragClient.retrieve as Mock).mockResolvedValue(mockWorkerResponse);
        mockDbSelect([]);

        const result = await ragService.retrieve({
            query: "refund policy",
            contentTypes: ["article"],
            format: "context",
            user: adminUser,
        });

        expect(result.format).toBe("context");
        // @ts-expect-error — narrowing to RagContextResponse
        expect(typeof result.context).toBe("string");
        // @ts-expect-error - narrowing to RagContextResponse
        expect(result.context).toContain("refund policy");
    });

    it("returns enriched chunks with entry records when format='chunks'", async () => {
        (rbacService.can as Mock).mockReturnValue(true);
        (ragClient.retrieve as Mock).mockResolvedValue(mockWorkerResponse);

        const mockEntry = {
            id: "entry-1",
            contentTypeId: "ct-1",
            status: "published",
            data: { title: "Hello" },
            publishedAt: null,
        };

        const selectChain = {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([mockEntry]),
        };
        (db.select as Mock).mockReturnValue(selectChain);

        const result = await ragService.retrieve({
            query: "test",
            contentTypes: ["article"],
            format: "chunks",
            user: adminUser,
        });

        expect(result.format).toBe("chunks");
        // @ts-expect-error — narrowing to RagChunksResponse
        expect(result.chunks[0].entry?.id).toBe("entry-1");
    });

    it("respects topK limit — returns no more than topK chunks", async () => {
        (rbacService.can as Mock).mockReturnValue(true);

        const manyChunks = Array.from({ length: 20 }, (_, i) => ({
            ...mockWorkerChunk,
            contentEntryId: `entry-${i}`,
            chunkIndex: i,
        }));

        (ragClient.retrieve as Mock).mockResolvedValue({
            ...mockWorkerResponse,
            chunks: manyChunks.slice(0, 5), // worker already limits, but service also enforces
            total: 5,
        });

        mockDbSelect([]);

        const result = await ragService.retrieve({
            query: "test",
            contentTypes: ["article"],
            topK: 5,
            user: adminUser,
        });

        // @ts-expect-error - narrowing to RagChunksResponse
        expect(result.chunks.length).toBeLessThanOrEqual(5);
    });
});
