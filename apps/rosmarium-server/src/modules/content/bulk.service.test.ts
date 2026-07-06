import { describe, it, expect, vi, beforeEach } from "vitest";
import { contentBulkService } from "./bulk.service.js";
import { db } from "../../db/index.js";
import { intelligenceService } from "../intelligence/intelligence.service.js";

vi.mock("../../db/index.js", () => ({
    db: {
        select: vi.fn(),
        transaction: vi.fn(),
    },
}));

vi.mock("../intelligence/intelligence.service.js", () => ({
    intelligenceService: {
        tagEntry: vi.fn(),
        summarize: vi.fn(),
    },
}));

describe("contentBulkService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return early if no entryIds", async () => {
        const res = await contentBulkService.executeBulkAction({
            action: "publish",
            entryIds: [],
            userId: "user1",
        });
        expect(res.successCount).toBe(0);
        expect(res.errors[0]).toBe("No entries selected");
    });

    it("should process publish action successfully", async () => {
        const mockEntries = [{ id: "e1", data: {} }];
        db.select.mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(mockEntries),
            }),
        });

        db.transaction.mockImplementation(async (cb) => {
            await cb({
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returning: vi.fn().mockResolvedValue([{ id: "e1" }]),
                        }),
                    }),
                }),
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockResolvedValue([{ id: "audit-1" }]),
                }),
            });
        });

        const res = await contentBulkService.executeBulkAction({
            action: "publish",
            entryIds: ["e1"],
            userId: "user1",
        });

        expect(res.successCount).toBe(1);
        expect(res.errors.length).toBe(0);
    });

    it("should process delete action successfully", async () => {
        const mockEntries = [{ id: "e1", data: {} }];
        db.select.mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(mockEntries),
            }),
        });

        db.transaction.mockImplementation(async (cb) => {
            await cb({
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{ id: "e1" }]),
                    }),
                }),
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockResolvedValue([{ id: "audit-1" }]),
                }),
            });
        });

        const res = await contentBulkService.executeBulkAction({
            action: "delete",
            entryIds: ["e1"],
            userId: "user1",
        });

        expect(res.successCount).toBe(1);
    });

    it("should process tag action successfully", async () => {
        const mockEntries = [{ id: "e1", data: { text: "hello" } }];
        db.select.mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(mockEntries),
            }),
        });

        const res = await contentBulkService.executeBulkAction({
            action: "tag",
            entryIds: ["e1"],
            userId: "user1",
        });

        expect(intelligenceService.tagEntry).toHaveBeenCalled();
        expect(res.successCount).toBe(1);
    });

    it("should process summarize action successfully", async () => {
        const mockEntries = [{ id: "e1", data: { text: "hello" } }];
        db.select.mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(mockEntries),
            }),
        });

        const res = await contentBulkService.executeBulkAction({
            action: "summarize",
            entryIds: ["e1"],
            userId: "user1",
        });

        expect(intelligenceService.summarize).toHaveBeenCalled();
        expect(res.successCount).toBe(1);
    });
});
