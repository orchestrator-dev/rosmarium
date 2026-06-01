import { describe, it, expect, beforeEach } from "vitest";
import { PluginRegistry } from "./plugin-registry.js";
import type { RosmariumPlugin } from "@orchestrator.dev/types";

describe("PluginRegistry", () => {
    let registry: PluginRegistry;

    beforeEach(() => {
        registry = new PluginRegistry();
    });

    it("registers a valid plugin", () => {
        const plugin: RosmariumPlugin = {
            name: "test-plugin",
            version: "1.0.0",
        };

        registry.register(plugin);
        expect(registry.get("test-plugin")).toBe(plugin);
        expect(registry.getAll().length).toBe(1);
    });

    it("throws when registering plugin without name or version", () => {
        const invalidPlugin = {
            name: "test-plugin",
        } as RosmariumPlugin;

        expect(() => registry.register(invalidPlugin)).toThrow();
    });

    it("ignores duplicate plugin registration", () => {
        const plugin: RosmariumPlugin = {
            name: "test-plugin",
            version: "1.0.0",
        };

        registry.register(plugin);
        registry.register(plugin);

        expect(registry.getAll().length).toBe(1);
    });

    it("registers custom field types", () => {
        const plugin: RosmariumPlugin = {
            name: "test-plugin-fields",
            version: "1.0.0",
            fieldTypes: [
                {
                    name: "Stripe Product",
                    type: "stripeProduct",
                    component: "StripeProductEditor",
                    validate: (val) => typeof val === "string" && val.startsWith("prod_")
                }
            ]
        };

        registry.register(plugin);
        const ft = registry.getFieldType("stripeProduct");
        expect(ft).toBeDefined();
        expect(ft?.name).toBe("Stripe Product");
        expect(ft?.validate?.("prod_123")).toBe(true);
        expect(ft?.validate?.("invalid")).toBe(false);
    });
});
