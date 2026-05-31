import { describe, it, expect } from "vitest";
import { exportSchemaToYaml, parseYamlToSchema } from "./schema-serializer.js";
import { type ParsedContentType } from "./registry.js";

describe("schema-serializer", () => {
    const mockSchema: ParsedContentType = {
        id: "mock-id",
        name: "test_type",
        displayName: "Test Type",
        description: "A test content type",
        isSystem: false,
        isComponent: false,
        settings: {
            aiIntelligence: { enabled: true }
        },
        fields: [
            {
                name: "title",
                type: "text",
                label: "Title",
                required: true,
            }
        ],
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "system"
    };

    it("should serialize to clean YAML without system fields", () => {
        const yaml = exportSchemaToYaml(mockSchema);
        expect(yaml).toContain("name: test_type");
        expect(yaml).toContain("displayName: Test Type");
        expect(yaml).toContain("description: A test content type");
        expect(yaml).toContain("isComponent: false");
        expect(yaml).toContain("aiIntelligence:");
        expect(yaml).not.toContain("mock-id");
        expect(yaml).not.toContain("archivedAt");
        expect(yaml).not.toContain("createdAt");
    });

    it("should parse valid YAML back to CreateContentTypeInput", () => {
        const yaml = exportSchemaToYaml(mockSchema);
        const parsed = parseYamlToSchema(yaml);
        
        expect(parsed.name).toBe("test_type");
        expect(parsed.displayName).toBe("Test Type");
        expect(parsed.description).toBe("A test content type");
        expect(parsed.isComponent).toBe(false);
        expect(parsed.settings).toEqual({ aiIntelligence: { enabled: true } });
        expect(parsed.fields).toHaveLength(1);
        expect(parsed.fields[0].name).toBe("title");
    });

    it("should throw on invalid YAML missing required fields", () => {
        const invalidYaml = `
description: missing name
fields: []
`;
        expect(() => parseYamlToSchema(invalidYaml)).toThrow("missing name, displayName, or fields");
    });
});
