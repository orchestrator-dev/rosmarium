import { describe, it, expect, vi, beforeEach } from "vitest";
import { rosmariumEvents } from "../../lib/events.js";

// Must be defined at module level AND referenced in vi.mock factories
// Using vi.hoisted to safely initialize before hoisting
const { mockEntry, mockDb } = vi.hoisted(() => {
    const entry = {
        id: "entry-1",
        contentTypeId: "ct-1",
        locale: "en",
        status: "draft" as const,
        data: { title: "Hello World" },
        publishedAt: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const returning = vi.fn().mockResolvedValue([entry]);
    const where = vi.fn().mockReturnValue({ returning, limit: vi.fn().mockResolvedValue([entry]) });
    const set = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{
                ...entry,
                status: "published" as const,
                publishedAt: new Date(),
            }]),
        }),
    });
    const values = vi.fn().mockReturnValue({ returning });
    const from = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([entry]),
            orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([entry]) }),
        }),
        limit: vi.fn().mockResolvedValue([entry]),
    });

    const db = {
        select: vi.fn().mockReturnValue({ from }),
        insert: vi.fn().mockReturnValue({ values }),
        update: vi.fn().mockReturnValue({ set }),
        delete: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: "entry-1" }]),
            }),
        }),
    };

    return { mockEntry: entry, mockDb: db };
});

vi.mock("../../db/index.js", () => ({ db: mockDb }));

vi.mock("./registry.js", () => ({
    registry: {
        get: vi.fn().mockReturnValue({
            id: "ct-1",
            name: "article",
            displayName: "Article",
            fields: [
                { type: "text", name: "title", label: "Title", required: true, unique: false, localised: false },
                { type: "slug", name: "slug", label: "Slug", required: false, unique: false, localised: false, generatedFrom: "title" },
            ],
        }),
        validateEntry: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    },
    ContentTypeRegistry: vi.fn(),
}));

import { contentCrudService } from "./crud.service.js";

describe("contentCrudService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-wire the insert mock after clear
        mockDb.insert.mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([mockEntry]),
            }),
        });
        mockDb.select.mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([mockEntry]),
                }),
            }),
        });
        mockDb.update.mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{
                        ...mockEntry,
                        status: "published",
                        publishedAt: new Date(),
                    }]),
                }),
            }),
        });
        mockDb.delete.mockReturnValue({
            where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: "entry-1" }]),
            }),
        });
    });

    it("create should validate data before inserting", async () => {
        const { registry } = await import("./registry.js");
        vi.mocked(registry.validateEntry).mockReturnValueOnce({
            valid: false,
            errors: [{ field: "title", message: "Field 'title' is required" }],
        });

        await expect(
            contentCrudService.create({
                contentTypeName: "article",
                data: {},
                createdBy: "user-1",
            }),
        ).rejects.toThrow("Validation failed");
    });

    it("create should insert and return entry", async () => {
        const entry = await contentCrudService.create({
            contentTypeName: "article",
            data: { title: "Hello World Article" },
            createdBy: "user-1",
        });

        expect(mockDb.insert).toHaveBeenCalled();
        expect(entry).toBeDefined();
        expect(entry.id).toBe("entry-1");
    });

    it("create should emit content.created event", async () => {
        const listener = vi.fn();
        rosmariumEvents.on("content.created", listener);

        await contentCrudService.create({
            contentTypeName: "article",
            data: { title: "Event Test" },
            createdBy: "user-1",
        });

        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: "entry-1" }));
        rosmariumEvents.off("content.created", listener);
    });

    it("publish should set status to published and emit event", async () => {
        const listener = vi.fn();
        rosmariumEvents.on("content.published", listener);

        const entry = await contentCrudService.publish("entry-1", "user-1");

        expect(entry.status).toBe("published");
        expect(entry.publishedAt).toBeDefined();
        expect(listener).toHaveBeenCalled();

        rosmariumEvents.off("content.published", listener);
    });

    it("delete should emit content.deleted event", async () => {
        const listener = vi.fn();
        rosmariumEvents.on("content.deleted", listener);

        await contentCrudService.delete("entry-1", "article", "user-1");

        expect(listener).toHaveBeenCalledWith("entry-1", "article");
        rosmariumEvents.off("content.deleted", listener);
    });

    it("update should call db.update and return entry", async () => {
        mockDb.select
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([mockEntry]),
                    }),
                }),
            })
            // For createVersion select
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([mockEntry]),
                    }),
                }),
            })
            // For version count select
            .mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([{ value: 0 }]),
                    }),
                }),
            });

        mockDb.update.mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{
                        ...mockEntry,
                        data: { title: "Hello World", subtitle: "New field" },
                    }]),
                }),
            }),
        });

        const entry = await contentCrudService.update({
            id: "entry-1",
            contentTypeName: "article",
            data: { subtitle: "New field" },
            updatedBy: "user-1",
        });

        expect(entry).toBeDefined();
    });
});
