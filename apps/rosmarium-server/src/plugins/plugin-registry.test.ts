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
});
