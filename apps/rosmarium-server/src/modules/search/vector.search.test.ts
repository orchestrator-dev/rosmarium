/**
 * Unit tests for vectorSearch.
 * Mocks the db.execute call — no real PostgreSQL/pgvector required for unit tests.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Drizzle db
vi.mock("../../db/index.js", () => ({
    db: {
        execute: vi.fn(),
    },
}));

// Mock logger
vi.mock("../../lib/logger.js", () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { vectorSearch } from "./vector.search.js";
import { db } from "../../db/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_EMBEDDING = [0.1, 0.2, 0.3];

function makeVecRow(overrides: Record<string, unknown> = {}) {
    return {
        content_entry_id: "entry1",
        chunk_index: 0,
        chunk_text: "Some chunk text",
        score: "0.85",
        ...overrides,
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("vectorSearch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns results ordered by cosine similarity (highest score first from DB)", async () => {
        vi.mocked(db.execute).mockResolvedValue([
            makeVecRow({ content_entry_id: "e1", score: "0.9" }),
            makeVecRow({ content_entry_id: "e2", score: "0.7" }),
        ] as never);

        const result = await vectorSearch({
            embedding: MOCK_EMBEDDING,
            contentType: "article",
            limit: 10,
        });

        expect(result).toHaveLength(2);
        expect(result[0]?.contentEntryId).toBe("e1");
        expect(result[0]?.score).toBe(0.9);
        expect(result[1]?.contentEntryId).toBe("e2");
    });

    it("returns [] when allowedEntryIds is an empty array (no RBAC matches possible)", async () => {
        const result = await vectorSearch({
            embedding: MOCK_EMBEDDING,
            contentType: "article",
            allowedEntryIds: [],
            limit: 10,
        });

        expect(result).toEqual([]);
        expect(db.execute).not.toHaveBeenCalled();
    });

    it("returns [] gracefully when the embeddings table does not exist (42P01)", async () => {
        const pgError = new Error("relation does not exist");
        (pgError as unknown as { code: string }).code = "42P01";
        vi.mocked(db.execute).mockRejectedValue(pgError);

        const result = await vectorSearch({
            embedding: MOCK_EMBEDDING,
            contentType: "nonexistent_type",
            limit: 10,
        });

        expect(result).toEqual([]);
    });

    it("re-throws non-42P01 errors", async () => {
        const dbError = new Error("connection lost");
        (dbError as unknown as { code: string }).code = "08006";
        vi.mocked(db.execute).mockRejectedValue(dbError);

        await expect(
            vectorSearch({ embedding: MOCK_EMBEDDING, contentType: "article", limit: 10 })
        ).rejects.toThrow("connection lost");
    });

    it("throws on invalid content type name (injection prevention)", async () => {
        await expect(
            vectorSearch({
                embedding: MOCK_EMBEDDING,
                contentType: "article; DROP TABLE users; --",
                limit: 10,
            })
        ).rejects.toThrow("Invalid content type name");
    });

    it("maps result rows correctly — converts strings to numbers", async () => {
        vi.mocked(db.execute).mockResolvedValue([
            makeVecRow({ chunk_index: "2", score: "0.77" }),
        ] as never);

        const result = await vectorSearch({
            embedding: MOCK_EMBEDDING,
            contentType: "article",
            limit: 10,
        });

        expect(result[0]).toMatchObject({
            contentEntryId: "entry1",
            chunkIndex: 2,
            chunkText: "Some chunk text",
            score: 0.77,
        });
    });
});
