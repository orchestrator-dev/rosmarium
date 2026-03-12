import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedContentType } from "./registry.js";

// Mock the db module to avoid real DB connections
vi.mock("../../db/index.js", () => ({
    db: {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
            }),
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                    {
                        id: "test-id-1",
                        name: "article",
                        displayName: "Article",
                        description: null,
                        fields: [
                            { type: "text", name: "title", label: "Title", required: true, unique: false, localised: false },
                            { type: "slug", name: "slug", label: "Slug", required: false, unique: false, localised: false, generatedFrom: "title" },
                        ],
                        settings: {},
                        isSystem: false,
                        archivedAt: null,
                        createdBy: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ]),
            }),
        }),
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([
                        {
                            id: "test-id-1",
                            name: "article",
                            displayName: "Article Updated",
                            description: null,
                            fields: [],
                            settings: {},
                            isSystem: false,
                            archivedAt: null,
                            createdBy: null,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        },
                    ]),
                }),
            }),
        }),
    },
}));

import { ContentTypeRegistry } from "./registry.js";

describe("ContentTypeRegistry", () => {
    let reg: ContentTypeRegistry;

    beforeEach(() => {
        reg = new ContentTypeRegistry();
    });

    it("should register a content type and retrieve it from cache", async () => {
        const ct = await reg.register({
            name: "article",
            displayName: "Article",
            fields: [
                { type: "text", name: "title", label: "Title", required: true, unique: false, localised: false },
            ],
        });

        expect(ct.name).toBe("article");
        expect(ct.displayName).toBe("Article");
        expect(reg.get("article")).toBeDefined();
        expect(reg.get("article")?.name).toBe("article");
    });

    it("should reject duplicate content type names", async () => {
        await reg.register({
            name: "article",
            displayName: "Article",
            fields: [],
        });

        await expect(
            reg.register({ name: "article", displayName: "Another Article", fields: [] }),
        ).rejects.toThrow("already exists");
    });

    it("should reject invalid field names (non-camelCase)", async () => {
        await expect(
            reg.register({
                name: "post",
                displayName: "Post",
                fields: [
                    // @ts-expect-error — intentionally invalid
                    { type: "text", name: "My Field", label: "My Field", required: false },
                ],
            }),
        ).rejects.toThrow(/[Ii]nvalid field/);
    });

    it("should reject duplicate field names within a content type", async () => {
        await expect(
            reg.register({
                name: "post",
                displayName: "Post",
                fields: [
                    { type: "text", name: "title", label: "Title", required: false, unique: false, localised: false },
                    { type: "text", name: "title", label: "Title 2", required: false, unique: false, localised: false },
                ],
            }),
        ).rejects.toThrow("Duplicate field name");
    });

    it("validateEntry should reject missing required fields", () => {
        // Manually seed the cache
        const ct: ParsedContentType = {
            id: "ct-1",
            name: "article",
            displayName: "Article",
            description: null,
            fields: [
                { type: "text", name: "title", label: "Title", required: true, unique: false, localised: false },
            ],
            settings: {},
            isSystem: false,
            archivedAt: null,
            createdBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        // Access private cache via type cast for testing
        (reg as unknown as { cache: Map<string, ParsedContentType> }).cache.set("article", ct);

        const result = reg.validateEntry("article", { body: "no title here" });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.field === "title")).toBe(true);
    });

    it("validateEntry should pass valid data", () => {
        const ct: ParsedContentType = {
            id: "ct-1",
            name: "article",
            displayName: "Article",
            description: null,
            fields: [
                { type: "text", name: "title", label: "Title", required: true, unique: false, localised: false, maxLength: 255 },
                { type: "number", name: "views", label: "Views", required: false, unique: false, localised: false, integer: true },
            ],
            settings: {},
            isSystem: false,
            archivedAt: null,
            createdBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        (reg as unknown as { cache: Map<string, ParsedContentType> }).cache.set("article", ct);

        const result = reg.validateEntry("article", { title: "Hello World", views: 42 });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("validateEntry should catch field type constraint violations", () => {
        const ct: ParsedContentType = {
            id: "ct-1",
            name: "article",
            displayName: "Article",
            description: null,
            fields: [
                { type: "text", name: "title", label: "Title", required: true, unique: false, localised: false, maxLength: 5 },
            ],
            settings: {},
            isSystem: false,
            archivedAt: null,
            createdBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        (reg as unknown as { cache: Map<string, ParsedContentType> }).cache.set("article", ct);

        const result = reg.validateEntry("article", { title: "This title is too long" });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.field === "title")).toBe(true);
    });

    it("getAll should return all registered types", async () => {
        await reg.register({ name: "article", displayName: "Article", fields: [] });
        expect(reg.getAll()).toHaveLength(1);
        expect(reg.getAll()[0]?.name).toBe("article");
    });
});
