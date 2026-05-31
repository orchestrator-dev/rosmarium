import { describe, it, expect, vi } from "vitest";

vi.mock("../../config.js", () => ({
    config: {
        DATABASE_URL: "postgres://fake:fake@localhost:5432/rosmarium",
        NODE_ENV: "test"
    }
}));
import { evaluateConditions } from "./registry.js";
import type { FieldCondition } from "@orchestrator.dev/types";

describe("evaluateConditions", () => {
    const data = {
        type: "event",
        score: 10,
        tags: ["featured", "new"],
        title: "Hello World",
        emptyField: "",
        nullField: null,
    };

    it("should return true when no conditions exist", () => {
        expect(evaluateConditions([], data)).toBe(true);
    });

    it("should evaluate eq and neq correctly", () => {
        expect(evaluateConditions([{ field: "type", operator: "eq", value: "event" }], data)).toBe(true);
        expect(evaluateConditions([{ field: "type", operator: "eq", value: "article" }], data)).toBe(false);
        expect(evaluateConditions([{ field: "type", operator: "neq", value: "article" }], data)).toBe(true);
    });

    it("should evaluate contains correctly", () => {
        expect(evaluateConditions([{ field: "tags", operator: "contains", value: "featured" }], data)).toBe(true);
        expect(evaluateConditions([{ field: "tags", operator: "contains", value: "old" }], data)).toBe(false);
        expect(evaluateConditions([{ field: "title", operator: "contains", value: "World" }], data)).toBe(true);
    });

    it("should evaluate gt and lt correctly", () => {
        expect(evaluateConditions([{ field: "score", operator: "gt", value: 5 }], data)).toBe(true);
        expect(evaluateConditions([{ field: "score", operator: "gt", value: 15 }], data)).toBe(false);
        expect(evaluateConditions([{ field: "score", operator: "lt", value: 20 }], data)).toBe(true);
    });

    it("should evaluate exists and empty correctly", () => {
        expect(evaluateConditions([{ field: "type", operator: "exists" }], data)).toBe(true);
        expect(evaluateConditions([{ field: "missing", operator: "exists" }], data)).toBe(false);
        expect(evaluateConditions([{ field: "emptyField", operator: "empty" }], data)).toBe(true);
        expect(evaluateConditions([{ field: "nullField", operator: "empty" }], data)).toBe(true);
    });

    it("should evaluate AND logic by default (implicit)", () => {
        const conditions: FieldCondition[] = [
            { field: "type", operator: "eq", value: "event" },
            { field: "score", operator: "gt", value: 5 },
        ];
        expect(evaluateConditions(conditions, data)).toBe(true);
    });

    it("should evaluate OR logic when specified", () => {
        const conditions: FieldCondition[] = [
            { field: "type", operator: "eq", value: "article" }, // false
            { field: "score", operator: "gt", value: 5, logic: "or" }, // true
        ];
        expect(evaluateConditions(conditions, data)).toBe(true);
    });
});
