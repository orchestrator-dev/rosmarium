import { describe, it, expect } from "vitest";
import { diffSchemas } from "./schema-diff.js";
import { type ParsedContentType, type CreateContentTypeInput } from "./registry.js";

describe("schema-diff", () => {
    const current: ParsedContentType = {
        id: "c1",
        name: "article",
        displayName: "Article",
        description: "Blog post",
        isSystem: false,
        isComponent: false,
        settings: {},
        fields: [{ name: "title", type: "text", label: "Title" }],
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "system"
    };

    it("should detect added schemas", () => {
        const incoming: CreateContentTypeInput = {
            name: "new_type",
            displayName: "New Type",
            fields: []
        };

        const result = diffSchemas([current], [incoming]);
        expect(result.added).toHaveLength(1);
        expect(result.added[0].name).toBe("new_type");
        expect(result.removed).toHaveLength(1);
        expect(result.removed[0].name).toBe("article");
        expect(result.updated).toHaveLength(0);
    });

    it("should detect updated schemas and compute correct delta", () => {
        const incoming: CreateContentTypeInput = {
            name: "article",
            displayName: "Article Updated",
            fields: [
                { name: "title", type: "text", label: "Title Edited" },
                { name: "slug", type: "slug", label: "Slug" }
            ]
        };

        const result = diffSchemas([current], [incoming]);
        expect(result.added).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
        expect(result.updated).toHaveLength(1);
        
        const update = result.updated[0];
        expect(update.changes).toContain('Display name changed from "Article" to "Article Updated"');
        expect(update.changes).toContain("Modified field: title");
        expect(update.changes).toContain("Added field: slug (slug)");
    });

    it("should ignore system schemas during removal", () => {
        const systemType: ParsedContentType = {
            ...current,
            id: "s1",
            name: "system_config",
            isSystem: true
        };

        const result = diffSchemas([systemType], []);
        expect(result.removed).toHaveLength(0); // Should not be marked for removal
    });
});
