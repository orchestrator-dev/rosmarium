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

import { findShortestPath } from "./path.finder.js";
import { db } from "../../../db/index.js";

const selectWhere = vi.fn();
const selectFrom = vi.fn(() => ({ where: selectWhere }));

describe("findShortestPath()", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(db.execute).mockResolvedValue([]);
        vi.mocked(db.select).mockReturnValue({ from: selectFrom } as ReturnType<typeof db.select>);
        selectFrom.mockReturnValue({ where: selectWhere });
        selectWhere.mockResolvedValue([]);
    });

    it("returns found=false immediately when from === to", async () => {
        const result = await findShortestPath("entry-a", "entry-a");

        expect(result.found).toBe(false);
        expect(result.hopCount).toBe(0);
        expect(result.path).toHaveLength(0);
        expect(result.edges).toHaveLength(0);
        expect(db.execute).not.toHaveBeenCalled();
    });

    it("returns found=false when no path exists in db", async () => {
        vi.mocked(db.execute).mockResolvedValue([]);

        const result = await findShortestPath("entry-a", "entry-z");

        expect(result.found).toBe(false);
        expect(result.path).toHaveLength(0);
    });

    it("returns found=true with correct hopCount when path exists", async () => {
        vi.mocked(db.execute).mockResolvedValue([
            { path: ["entry-a", "entry-b"], edge_path: ["edge-1"], depth: 1 },
        ]);

        selectWhere
            .mockResolvedValueOnce([
                { id: "entry-a", contentTypeId: "article", data: {} },
                { id: "entry-b", contentTypeId: "article", data: {} },
            ])
            .mockResolvedValueOnce([
                { id: "edge-1", fromEntryId: "entry-a", toEntryId: "entry-b", edgeType: "RELATED_TO", weight: 1.0 },
            ]);

        const result = await findShortestPath("entry-a", "entry-b");

        expect(result.found).toBe(true);
        expect(result.hopCount).toBe(1);
        expect(result.path).toHaveLength(2);
        expect(result.edges).toHaveLength(1);
        expect(result.path[0]?.entryId).toBe("entry-a");
        expect(result.path[1]?.entryId).toBe("entry-b");
    });

    it("clamps maxDepth to 5 without throwing", async () => {
        await expect(
            findShortestPath("entry-a", "entry-z", { maxDepth: 100 }),
        ).resolves.toMatchObject({ found: false });
    });

    it("propagates db errors", async () => {
        vi.mocked(db.execute).mockRejectedValue(new Error("DB timeout"));

        await expect(findShortestPath("a", "b")).rejects.toThrow("DB timeout");
    });
});
