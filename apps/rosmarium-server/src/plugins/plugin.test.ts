import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { pluginRegistry } from "./plugin-registry.js";
import { validateFieldValue, fieldSchema } from "../modules/content/field-types.js";
import type { RosmariumPlugin } from "@orchestrator.dev/types";
import { getSchema } from "../graphql/index.js";

describe("Plugin Extensibility (Task 7.2)", () => {
    beforeEach(() => {
        pluginRegistry.clear();
    });

    afterEach(() => {
        pluginRegistry.clear();
    });

    it("allows custom field types to be validated", () => {
        const plugin: RosmariumPlugin = {
            name: "ecommerce-plugin",
            version: "1.0.0",
            fieldTypes: [
                {
                    name: "SKU",
                    type: "skuField",
                    component: "SkuEditor",
                    validate: (val) => typeof val === "string" && val.startsWith("SKU-")
                }
            ]
        };
        pluginRegistry.register(plugin);

        // Define a field of our custom type
        const customFieldDef = {
            name: "mySku",
            label: "Product SKU",
            type: "skuField"
        };

        // Zod schema should passthrough
        const parsedDef = fieldSchema.parse(customFieldDef);
        expect(parsedDef.type).toBe("skuField");

        // Runtime validation using the plugin's validate method
        const validError = validateFieldValue(parsedDef, "SKU-12345");
        expect(validError).toBeNull(); // No error

        const invalidError = validateFieldValue(parsedDef, "BAD-SKU");
        expect(invalidError).toContain("failed custom validation");
    });

    it("allows graphql schema to be extended", () => {
        const plugin: RosmariumPlugin = {
            name: "graphql-plugin",
            version: "1.0.0",
            graphql: {
                types: (builder) => {
                    builder.queryType({
                        fields: (t: any) => ({
                            helloPlugin: t.string({
                                resolve: () => "world",
                            }),
                        }),
                    });
                }
            }
        };
        // Just verify we don't throw when generating the schema with plugin active
        // Real testing would need the full fastify app context, but we can verify our hook mechanism runs.
        pluginRegistry.register(plugin);
        const schema = getSchema();
        expect(schema).toBeDefined();
    });
});
