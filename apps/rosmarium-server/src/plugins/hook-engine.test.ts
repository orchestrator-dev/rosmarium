/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
import { describe, it, expect, beforeEach } from "vitest";
import { HookEngine } from "./hook-engine.js";

describe("HookEngine", () => {
    let engine: HookEngine;

    beforeEach(() => {
        engine = new HookEngine();
    });

    it("executes hooks in priority order", async () => {
        const callOrder: string[] = [];

        engine.register("plugin1", "content:beforeCreate" as any, async () => {
            callOrder.push("plugin1");
        }, 100);

        engine.register("plugin2", "content:beforeCreate" as any, async () => {
            callOrder.push("plugin2");
        }, 10);

        engine.register("plugin3", "content:beforeCreate" as any, async () => {
            callOrder.push("plugin3");
        }, 50);

        await engine.execute("content:beforeCreate" as any, {} as any);

        expect(callOrder).toEqual(["plugin2", "plugin3", "plugin1"]);
    });

    it("isolates errors so one plugin doesn't break others", async () => {
        const callOrder: string[] = [];

        engine.register("pluginA", "content:afterUpdate" as any, async () => {
            callOrder.push("pluginA-start");
            throw new Error("Plugin A failed");
        }, 10);

        engine.register("pluginB", "content:afterUpdate" as any, async () => {
            callOrder.push("pluginB");
        }, 20);

        await engine.execute("content:afterUpdate" as any, {} as any);

        expect(callOrder).toEqual(["pluginA-start", "pluginB"]);
    });
});
