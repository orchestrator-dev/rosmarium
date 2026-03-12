import { describe, it, expect } from "vitest";
import * as schema from "./index.js";

describe("Schema exports", () => {
    it("exports users table", () => {
        expect(schema.users).toBeDefined();
        expect(schema.users.id).toBeDefined();
        expect(schema.users.email).toBeDefined();
        expect(schema.users.role).toBeDefined();
        expect(schema.users.isActive).toBeDefined();
        expect(schema.users.createdAt).toBeDefined();
        expect(schema.users.updatedAt).toBeDefined();
    });

    it("exports sessions table", () => {
        expect(schema.sessions).toBeDefined();
        expect(schema.sessions.id).toBeDefined();
        expect(schema.sessions.userId).toBeDefined();
        expect(schema.sessions.expiresAt).toBeDefined();
    });

    it("exports apiKeys table", () => {
        expect(schema.apiKeys).toBeDefined();
        expect(schema.apiKeys.keyHash).toBeDefined();
        expect(schema.apiKeys.keyPrefix).toBeDefined();
        expect(schema.apiKeys.scopes).toBeDefined();
    });

    it("exports contentTypes table", () => {
        expect(schema.contentTypes).toBeDefined();
        expect(schema.contentTypes.name).toBeDefined();
        expect(schema.contentTypes.displayName).toBeDefined();
        expect(schema.contentTypes.fields).toBeDefined();
        expect(schema.contentTypes.settings).toBeDefined();
    });

    it("exports contentEntries table", () => {
        expect(schema.contentEntries).toBeDefined();
        expect(schema.contentEntries.contentTypeId).toBeDefined();
        expect(schema.contentEntries.locale).toBeDefined();
        expect(schema.contentEntries.status).toBeDefined();
        expect(schema.contentEntries.data).toBeDefined();
    });

    it("exports auditLog table", () => {
        expect(schema.auditLog).toBeDefined();
        expect(schema.auditLog.action).toBeDefined();
        expect(schema.auditLog.resourceId).toBeDefined();
        expect(schema.auditLog.metadata).toBeDefined();
    });
});
