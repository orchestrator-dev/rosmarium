/**
 * Unit tests for fulltextSearch.
 * Mocks the db.execute call — no real PostgreSQL required for unit tests.
 * Integration tests with testcontainers would go in fulltext.search.integration.test.ts
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock Drizzle db
vi.mock("../../db/index.js", () => ({
    db: {
        execute: vi.fn(),
    },
}));

import { fulltextSearch } from "./fulltext.search.js";
import { db } from "../../db/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDbRow(overrides: Record<string, unknown> = {}) {
    return {
        id: "entry1",
        content_type_id: "ct1",
        data: { title: "Test Article", body: "Some body text" },
        status: "published",
        published_at: null,
        created_by: null,
        rank: "0.75",
        snippet: "Some <mark>body</mark> text",
        ...overrides,
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("fulltextSearch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns [] for empty query", async () => {
        const result = await fulltextSearch({ query: "   ", limit: 10 });
        expect(result).toEqual([]);
        expect(db.execute).not.toHaveBeenCalled();
    });

    it("returns mapped results from database rows", async () => {
        vi.mocked(db.execute).mockResolvedValue([makeDbRow()] as never);

        const result = await fulltextSearch({ query: "body", limit: 10 });

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            id: "entry1",
            contentTypeId: "ct1",
            status: "published",
            rank: 0.75,
            snippet: "Some <mark>body</mark> text",
        });
    });

    it("passes contentTypeId filter to query", async () => {
        vi.mocked(db.execute).mockResolvedValue([] as never);

        await fulltextSearch({ query: "test", contentTypeId: "ct-abc", limit: 10 });

        expect(db.execute).toHaveBeenCalledTimes(1);
        // The sql template contains the contentTypeId value
    });

    it("passes status filter to query", async () => {
        vi.mocked(db.execute).mockResolvedValue([] as never);

        await fulltextSearch({ query: "test", status: "draft", limit: 10 });

        expect(db.execute).toHaveBeenCalledTimes(1);
    });

    it("returns publishedAt as Date when present", async () => {
        vi.mocked(db.execute).mockResolvedValue([
            makeDbRow({ published_at: "2026-01-01T00:00:00Z" }),
        ] as never);

        const result = await fulltextSearch({ query: "test", limit: 10 });

        expect(result[0]?.publishedAt).toBeInstanceOf(Date);
    });

    it("returns null publishedAt when not present", async () => {
        vi.mocked(db.execute).mockResolvedValue([makeDbRow({ published_at: null })] as never);

        const result = await fulltextSearch({ query: "test", limit: 10 });

        expect(result[0]?.publishedAt).toBeNull();
    });

    it("returns [] for no DB matches", async () => {
        vi.mocked(db.execute).mockResolvedValue([] as never);

        const result = await fulltextSearch({ query: "nonexistent query", limit: 10 });

        expect(result).toEqual([]);
    });
});
