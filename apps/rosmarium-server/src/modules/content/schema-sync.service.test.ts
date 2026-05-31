import { describe, it, expect, vi, beforeEach } from "vitest";
import { schemaSyncService } from "./schema-sync.service.js";
import { registry } from "./registry.js";

// Mock the registry singleton to avoid DB calls
vi.mock("./registry.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./registry.js")>();
    return {
        ...actual,
        registry: {
            getAll: vi.fn(),
            register: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        }
    };
});

describe("schema-sync.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should export all non-system schemas as yaml", () => {
        const mockSchema: any = {
            id: "1",
            name: "test",
            displayName: "Test",
            isSystem: false,
            settings: {},
            fields: []
        };
        const sysSchema: any = {
            id: "2",
            name: "sys",
            displayName: "Sys",
            isSystem: true,
            settings: {},
            fields: []
        };
        
        vi.mocked(registry.getAll).mockReturnValue([mockSchema, sysSchema]);
        
        const files = schemaSyncService.exportAll();
        expect(files).toHaveLength(1);
        expect(files[0].filename).toBe("test.yml");
        expect(files[0].content).toContain("name: test");
    });

    it("should apply diff correctly to registry", async () => {
        const diff = {
            added: [{ name: "added_schema", displayName: "Added", fields: [] }],
            removed: [{ id: "rem1", name: "removed_schema", displayName: "Removed", fields: [], isSystem: false, isComponent: false, settings: {}, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), createdBy: "sys" }],
            updated: [{
                original: { id: "upd1", name: "updated_schema", displayName: "Updated", fields: [], isSystem: false, isComponent: false, settings: {}, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), createdBy: "sys" },
                incoming: { name: "updated_schema", displayName: "Updated New", fields: [] },
                changes: []
            }]
        };

        await schemaSyncService.applyDiff(diff);

        expect(registry.delete).toHaveBeenCalledWith("rem1");
        expect(registry.update).toHaveBeenCalledWith("upd1", expect.objectContaining({ displayName: "Updated New" }));
        expect(registry.register).toHaveBeenCalledWith(expect.objectContaining({ name: "added_schema" }));
    });
});
