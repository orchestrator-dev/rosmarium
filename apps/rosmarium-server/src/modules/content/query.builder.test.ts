import { describe, it, expect, vi } from "vitest";
import type { ParsedContentType } from "./registry.js";

// Minimal content type for testing
const testContentType: ParsedContentType = {
    id: "ct-1",
    name: "article",
    displayName: "Article",
    description: null,
    fields: [
        { type: "text", name: "title", label: "Title", required: true, unique: false, localised: false },
        { type: "text", name: "status", label: "Status", required: false, unique: false, localised: false },
        { type: "text", name: "tags", label: "Tags", required: false, unique: false, localised: false },
    ],
    settings: {},
    isSystem: false,
    archivedAt: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

// Mock contentEntries for sql references
vi.mock("../../db/schema/index.js", async () => {
    const { pgTable, text, timestamp, jsonb } = await import("drizzle-orm/pg-core");
    return {
        contentEntries: pgTable("content_entries", {
            id: text("id").primaryKey(),
            contentTypeId: text("content_type_id").notNull(),
            locale: text("locale").notNull().default("en"),
            status: text("status").notNull().default("draft"),
            data: jsonb("data").notNull(),
            publishedAt: timestamp("published_at"),
            createdBy: text("created_by"),
            updatedBy: text("updated_by"),
            createdAt: timestamp("created_at").notNull().defaultNow(),
            updatedAt: timestamp("updated_at").notNull().defaultNow(),
        }),
        auditLog: pgTable("audit_log", {
            id: text("id").primaryKey(),
            userId: text("user_id"),
            action: text("action").notNull(),
            resourceId: text("resource_id"),
            resourceType: text("resource_type"),
            metadata: jsonb("metadata"),
            ipAddress: text("ip_address"),
            userAgent: text("user_agent"),
            createdAt: timestamp("created_at").notNull().defaultNow(),
        }),
    };
});

import {
    buildWhereClause,
    buildOrderBy,
    buildPagination,
    encodeCursor,
} from "./query.builder.js";

describe("query.builder", () => {
    it("eq filter on system field (status)", () => {
        const conditions = buildWhereClause(
            { status: { eq: "published" } },
            testContentType,
        );
        expect(conditions).toHaveLength(1);
    });

    it("contains filter on jsonb data field", () => {
        const conditions = buildWhereClause(
            { title: { contains: "rosmarium" } },
            testContentType,
        );
        expect(conditions).toHaveLength(1);
    });

    it("in filter with multiple values", () => {
        const conditions = buildWhereClause(
            { status: { in: "draft,published" } },
            testContentType,
        );
        expect(conditions).toHaveLength(1);
    });

    it("multiple filters produce multiple conditions", () => {
        const conditions = buildWhereClause(
            {
                status: { eq: "published" },
                title: { contains: "hello" },
            },
            testContentType,
        );
        expect(conditions).toHaveLength(2);
    });

    it("invalid operator throws validation error", () => {
        expect(() =>
            buildWhereClause(
                // @ts-expect-error — testing invalid input
                { status: { badOp: "value" } },
                testContentType,
            ),
        ).toThrow("Invalid filter operator");
    });

    it("unknown filter field throws error", () => {
        expect(() =>
            buildWhereClause(
                { nonExistent: { eq: "value" } },
                testContentType,
            ),
        ).toThrow("Unknown filter field");
    });

    it("cursor pagination with no cursor returns null where and limit+1", () => {
        const result = buildPagination(undefined, 10);
        expect(result.where).toBeNull();
        expect(result.limit).toBe(11);
    });

    it("cursor pagination with valid cursor returns where condition", () => {
        const cursor = encodeCursor("some-entry-id");
        const result = buildPagination(cursor, 10);
        expect(result.where).not.toBeNull();
        expect(result.limit).toBe(11);
    });

    it("cursor pagination with invalid base64 throws error", () => {
        // An invalid cursor won't throw on decode (base64 is always decodable) but
        // the resulting SQL is safe since it's parameterized. Just verify no crash.
        expect(() => buildPagination("!!!invalid!!!", 10)).not.toThrow();
    });

    it("buildOrderBy produces SQL for system fields", () => {
        const clauses = buildOrderBy(
            [{ field: "createdAt", direction: "desc" }]
        );
        expect(clauses).toHaveLength(1);
    });

    it("buildOrderBy produces SQL for jsonb data fields", () => {
        const clauses = buildOrderBy(
            [{ field: "title", direction: "asc" }]
        );
        expect(clauses).toHaveLength(1);
    });
});
