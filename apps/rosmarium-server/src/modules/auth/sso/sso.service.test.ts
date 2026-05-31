import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../../../db/index", () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("../../../db/schema/users", () => ({
    users: { id: "id", email: "email", role: "role", firstName: "firstName", lastName: "lastName" },
}));

vi.mock("../../../db/schema/sso-providers", () => ({
    ssoProviders: { id: "id", isActive: "isActive" },
}));

import { ssoService } from "./sso.service";
import { db } from "../../../db/index";

function mockDbSelect(returnValue: unknown[] = []) {
    const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(returnValue),
        then: function(resolve: any) { resolve(returnValue); }
    };
    (db.select as Mock).mockReturnValue(chain);
    return chain;
}

function mockDbInsert(returnValue: unknown[] = []) {
    const chain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(returnValue),
    };
    (db.insert as Mock).mockReturnValue(chain);
    return chain;
}

function mockDbUpdate(returnValue: unknown[] = []) {
    const chain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(returnValue),
    };
    (db.update as Mock).mockReturnValue(chain);
    return chain;
}

describe("ssoService.processSSOLogin", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    const mockProvider = {
        id: "prov1",
        providerId: "google",
        type: "oauth2",
        name: "Google",
        isActive: true,
        config: {},
        roleMapping: { "admins": "admin", "editors": "editor" },
        createdAt: new Date(),
        updatedAt: new Date(),
        tenantId: null
    };

    it("throws if no email is provided", async () => {
        await expect(ssoService.processSSOLogin(mockProvider as any, { email: "" }))
            .rejects.toThrow("SSO profile missing email");
    });

    it("auto-provisions a new user if not found", async () => {
        mockDbSelect([]); // No existing user
        mockDbInsert([{ id: "user1", email: "test@example.com", role: "viewer" }]);

        const user = await ssoService.processSSOLogin(mockProvider as any, {
            email: "test@example.com",
            firstName: "Test",
            lastName: "User"
        });

        expect(db.insert).toHaveBeenCalled();
        expect(user.id).toBe("user1");
    });

    it("maps roles based on groups during auto-provisioning", async () => {
        mockDbSelect([]); // No existing user
        mockDbInsert([{ id: "user1", email: "admin@example.com", role: "admin" }]);

        const user = await ssoService.processSSOLogin(mockProvider as any, {
            email: "admin@example.com",
            groups: ["unknown", "admins"]
        });

        expect(user.role).toBe("admin");
    });

    it("updates existing user role if mapped groups change", async () => {
        mockDbSelect([{ id: "user1", email: "editor@example.com", role: "viewer" }]);
        mockDbUpdate([{ id: "user1", email: "editor@example.com", role: "editor" }]);

        const user = await ssoService.processSSOLogin(mockProvider as any, {
            email: "editor@example.com",
            groups: ["editors"]
        });

        expect(db.update).toHaveBeenCalled();
        expect(user.role).toBe("editor");
    });

    it("does not update existing user if role matches", async () => {
        mockDbSelect([{ id: "user1", email: "editor@example.com", role: "editor" }]);
        
        const user = await ssoService.processSSOLogin(mockProvider as any, {
            email: "editor@example.com",
            groups: ["editors"]
        });

        expect(db.update).not.toHaveBeenCalled();
        expect(user.id).toBe("user1");
    });
});
