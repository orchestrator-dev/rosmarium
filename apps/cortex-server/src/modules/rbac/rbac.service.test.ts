import { describe, it, expect } from "vitest";
import { rbacService } from "./rbac.service.js";
import { PERMISSIONS } from "./permissions.js";
import type { AuthenticatedUser } from "../auth/auth.service.js";
import type { ContentEntry, ContentTypeWithSettings } from "./rbac.service.js";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const makeUser = (role: AuthenticatedUser["role"], id = "user_1"): AuthenticatedUser => ({
    id,
    email: `${role}@example.com`,
    firstName: null,
    lastName: null,
    role,
    isActive: true,
});

const makeEntry = (createdBy: string): ContentEntry => ({
    id: "entry_1",
    createdBy,
});

const contentType: ContentTypeWithSettings = {
    name: "post",
    settings: {
        fieldPermissions: {
            secretField: { read: ["super_admin", "admin"], write: ["super_admin"] },
            publicField: { read: [], write: [] }, // empty means open
        },
    },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("rbacService.can", () => {
    it("super_admin can do everything", () => {
        const admin = makeUser("super_admin");
        for (const perm of Object.values(PERMISSIONS)) {
            expect(rbacService.can(admin, perm)).toBe(true);
        }
    });

    it("viewer cannot create content", () => {
        const viewer = makeUser("viewer");
        expect(rbacService.can(viewer, PERMISSIONS.CONTENT_CREATE)).toBe(false);
    });

    it("viewer can read content", () => {
        const viewer = makeUser("viewer");
        expect(rbacService.can(viewer, PERMISSIONS.CONTENT_READ_ANY)).toBe(true);
    });

    it("author can update own content", () => {
        const author = makeUser("author");
        expect(rbacService.can(author, PERMISSIONS.CONTENT_UPDATE_OWN)).toBe(true);
    });

    it("author cannot update any content", () => {
        const author = makeUser("author");
        expect(rbacService.can(author, PERMISSIONS.CONTENT_UPDATE_ANY)).toBe(false);
    });

    it("editor can update any content", () => {
        const editor = makeUser("editor");
        expect(rbacService.can(editor, PERMISSIONS.CONTENT_UPDATE_ANY)).toBe(true);
    });
});

describe("rbacService.canOrThrow", () => {
    it("throws ForbiddenError when permission missing", () => {
        const viewer = makeUser("viewer");
        expect(() =>
            rbacService.canOrThrow(viewer, PERMISSIONS.CONTENT_CREATE)
        ).toThrow();
    });

    it("does not throw when permission present", () => {
        const admin = makeUser("admin");
        expect(() =>
            rbacService.canOrThrow(admin, PERMISSIONS.CONTENT_CREATE)
        ).not.toThrow();
    });
});

describe("rbacService.canAccessEntry", () => {
    it("author can update own entry", () => {
        const author = makeUser("author", "user_1");
        const ownEntry = makeEntry("user_1");
        expect(rbacService.canAccessEntry(author, ownEntry, "update")).toBe(true);
    });

    it("author cannot update someone else's entry", () => {
        const author = makeUser("author", "user_1");
        const otherEntry = makeEntry("user_2");
        expect(rbacService.canAccessEntry(author, otherEntry, "update")).toBe(false);
    });

    it("editor can update any entry (including others')", () => {
        const editor = makeUser("editor", "user_1");
        const otherEntry = makeEntry("user_2");
        expect(rbacService.canAccessEntry(editor, otherEntry, "update")).toBe(true);
    });

    it("viewer cannot delete any entry", () => {
        const viewer = makeUser("viewer", "user_1");
        const ownEntry = makeEntry("user_1");
        expect(rbacService.canAccessEntry(viewer, ownEntry, "delete")).toBe(false);
    });

    it("respects own vs any scope correctly", () => {
        const author = makeUser("author", "user_1");
        const ownEntry = makeEntry("user_1");
        const otherEntry = makeEntry("user_99");

        expect(rbacService.canAccessEntry(author, ownEntry, "delete")).toBe(true);
        expect(rbacService.canAccessEntry(author, otherEntry, "delete")).toBe(false);
    });
});

describe("rbacService.filterFields", () => {
    it("removes fields user does not have read access to", () => {
        const viewer = makeUser("viewer");
        const data = { publicField: "visible", secretField: "hidden" };
        const result = rbacService.filterFields(viewer, contentType, data);
        expect(result).toHaveProperty("publicField");
        expect(result).not.toHaveProperty("secretField");
    });

    it("includes all fields for super_admin", () => {
        const admin = makeUser("super_admin");
        const data = { publicField: "visible", secretField: "visible too" };
        const result = rbacService.filterFields(admin, contentType, data);
        expect(result).toHaveProperty("publicField");
        expect(result).toHaveProperty("secretField");
    });

    it("includes field when there is no restriction", () => {
        const viewer = makeUser("viewer");
        const ct: ContentTypeWithSettings = { name: "blog", settings: {} };
        const data = { title: "Hello", body: "World" };
        const result = rbacService.filterFields(viewer, ct, data);
        expect(result).toEqual(data);
    });
});

describe("rbacService.scopeApiKey", () => {
    const baseApiKey = {
        id: "key_1",
        name: "test",
        keyHash: "hash",
        keyPrefix: "ctx_live_",
        userId: "user_1",
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
    };

    it("returns true when permission is in scopes", () => {
        const key = { ...baseApiKey, scopes: ["content:read:any"] };
        expect(rbacService.scopeApiKey(key, PERMISSIONS.CONTENT_READ_ANY)).toBe(true);
    });

    it("returns false when permission is not in scopes", () => {
        const key = { ...baseApiKey, scopes: ["content:read:any"] };
        expect(rbacService.scopeApiKey(key, PERMISSIONS.CONTENT_CREATE)).toBe(false);
    });
});
