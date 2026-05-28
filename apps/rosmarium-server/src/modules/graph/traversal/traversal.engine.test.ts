import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../config.js", () => ({
    config: {
        DATABASE_URL: "postgresql://test:test@localhost:5432/test",
        REDIS_URL: "redis://localhost:6379",
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
    graphEdges: { id: "id", fromEntryId: "from_entry_id", toEntryId: "to_entry_id", edgeType: "edge_type", weight: "weight" },
    contentEntries: { id: "id", contentTypeId: "content_type_id", data: "data" },
}));

import { traverse } from "./traversal.engine.js";
import { db } from "../../../db/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        from_entry_id: "entry-a",
        to_entry_id: "entry-b",
        from_content_type: "article",
        to_content_type: "article",
        edge_type: "RELATED_TO",
        weight: 1.0,
        edge_id: "edge-1",
        depth: 1,
        ...overrides,
    };
}

const selectWhere = vi.fn();
const selectFrom = vi.fn(() => ({ where: selectWhere }));

describe("traverse()", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(db.execute).mockResolvedValue([]);
        vi.mocked(db.select).mockReturnValue({ from: selectFrom } as ReturnType<typeof db.select>);
        selectFrom.mockReturnValue({ where: selectWhere });
        selectWhere.mockResolvedValue([]);
    });

    it("returns empty result when no edges found", async () => {
        const result = await traverse({
            fromEntryId: "entry-a",
            direction: "outbound",
            maxDepth: 2,
            limit: 50,
        });

        expect(result.nodes).toHaveLength(0);
        expect(result.edges).toHaveLength(0);
        expect(result.rootEntryId).toBe("entry-a");
        expect(result.totalNodes).toBe(0);
        expect(typeof result.latencyMs).toBe("number");
    });

    it("maps node depths correctly from CTE results", async () => {
        vi.mocked(db.execute).mockResolvedValue([
            makeRow({ depth: 1, to_entry_id: "entry-b" }),
            makeRow({ depth: 2, to_entry_id: "entry-c", edge_id: "edge-2", from_entry_id: "entry-b" }),
        ]);
        selectWhere.mockResolvedValue([]);

        const result = await traverse({ fromEntryId: "entry-a", direction: "outbound", maxDepth: 2 });

        const depthB = result.nodes.find((n) => n.entryId === "entry-b")?.depth;
        const depthC = result.nodes.find((n) => n.entryId === "entry-c")?.depth;
        expect(depthB).toBe(1);
        expect(depthC).toBe(2);
    });

    it("deduplicates nodes — unique entryId", async () => {
        vi.mocked(db.execute).mockResolvedValue([makeRow(), makeRow({ edge_id: "edge-2", weight: 0.8 })]);

        const result = await traverse({ fromEntryId: "entry-a", direction: "outbound", maxDepth: 2 });

        const ids = result.nodes.map((n) => n.entryId);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("clamps maxDepth to 5", async () => {
        const result = await traverse({ fromEntryId: "x", direction: "outbound", maxDepth: 99 });
        expect(result.maxDepth).toBe(5);
    });

    it("records latencyMs ≥ 0", async () => {
        const result = await traverse({ fromEntryId: "entry-a", direction: "outbound", maxDepth: 1 });
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("propagates db errors", async () => {
        vi.mocked(db.execute).mockRejectedValue(new Error("DB connection lost"));

        await expect(
            traverse({ fromEntryId: "entry-a", direction: "outbound", maxDepth: 2 }),
        ).rejects.toThrow("DB connection lost");
    });
});
