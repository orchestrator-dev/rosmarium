import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ─── Mock dependencies before importing the module under test ─────────────────

vi.mock("../../db/index.js", () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("./lucia.js", () => ({
    lucia: {
        createSession: vi.fn(),
        createSessionCookie: vi.fn(),
        validateSession: vi.fn(),
        invalidateSession: vi.fn(),
        invalidateUserSessions: vi.fn(),
    },
}));

vi.mock("./password.js", () => ({
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
}));

vi.mock("../../db/schema/index.js", () => ({
    users: { id: "id", email: "email" },
    auditLog: {},
}));

import { authService, AuthError, AUTH_ERRORS } from "./auth.service.js";
import { lucia } from "./lucia.js";
import { hashPassword, verifyPassword } from "./password.js";
import { db } from "../../db/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUser = {
    id: "user_1",
    email: "test@example.com",
    passwordHash: "hashed_pw",
    firstName: "Test",
    lastName: "User",
    role: "editor" as const,
    isActive: true,
    lastLoginAt: null,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const mockSession = {
    id: "session_1",
    userId: "user_1",
    expiresAt: new Date(Date.now() + 86400000),
    fresh: false,
};

function mockDbSelect(returnValue: unknown[] = []) {
    const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(returnValue),
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

function mockDbUpdate() {
    const chain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
    };
    (db.update as Mock).mockReturnValue(chain);
    return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("authService.register", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("creates a user with a hashed password (raw !== stored)", async () => {
        mockDbSelect([]); // no existing user
        (hashPassword as Mock).mockResolvedValue("hashed_pw");
        mockDbInsert([mockUser]);
        mockDbUpdate();
        (lucia.createSession as Mock).mockResolvedValue(mockSession);
        (lucia.createSessionCookie as Mock).mockReturnValue({ serialize: () => "" });

        const { user } = await authService.register({
            email: "test@example.com",
            password: "plaintext123",
        });

        expect(hashPassword).toHaveBeenCalledWith("plaintext123");
        expect(user.passwordHash).not.toBe("plaintext123");
        expect(user.id).toBe("user_1");
    });

    it("throws EMAIL_TAKEN if email already exists", async () => {
        mockDbSelect([{ id: "existing" }]);

        await expect(
            authService.register({ email: "test@example.com", password: "pass1234" })
        ).rejects.toThrow(AuthError);

        const call = authService
            .register({ email: "test@example.com", password: "pass1234" })
            .catch((e: AuthError) => e);

        const err = await call;
        expect((err as AuthError).code).toBe(AUTH_ERRORS.EMAIL_TAKEN);
    });
});

describe("authService.login", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns a session cookie on valid credentials", async () => {
        mockDbSelect([mockUser]);
        (verifyPassword as Mock).mockResolvedValue(true);
        mockDbUpdate();
        (lucia.createSession as Mock).mockResolvedValue(mockSession);
        (lucia.createSessionCookie as Mock).mockReturnValue({
            name: "auth_session",
            value: "token123",
            serialize: () => "auth_session=token123",
        });
        // Second db.insert call for audit log
        mockDbInsert([]);

        const result = await authService.login({
            email: "test@example.com",
            password: "correctpassword",
        });

        expect(result.sessionCookie).toBeDefined();
        expect(result.user.email).toBe("test@example.com");
    });

    it("throws INVALID_CREDENTIALS for wrong password", async () => {
        mockDbSelect([mockUser]);
        (verifyPassword as Mock).mockResolvedValue(false);

        await expect(
            authService.login({ email: "test@example.com", password: "wrongpass" })
        ).rejects.toMatchObject({ code: AUTH_ERRORS.INVALID_CREDENTIALS });
    });

    it("throws INVALID_CREDENTIALS for unknown email (same error, no enumeration)", async () => {
        mockDbSelect([]); // no user found
        (verifyPassword as Mock).mockResolvedValue(false); // dummy hash verification

        await expect(
            authService.login({ email: "nobody@example.com", password: "pass" })
        ).rejects.toMatchObject({ code: AUTH_ERRORS.INVALID_CREDENTIALS });
    });

    it("throws ACCOUNT_DISABLED for inactive user", async () => {
        mockDbSelect([{ ...mockUser, isActive: false }]);
        (verifyPassword as Mock).mockResolvedValue(true);

        await expect(
            authService.login({ email: "test@example.com", password: "correctpass" })
        ).rejects.toMatchObject({ code: AUTH_ERRORS.ACCOUNT_DISABLED });
    });
});

describe("authService.logout", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("invalidates the session", async () => {
        (lucia.validateSession as Mock).mockResolvedValue({
            session: { ...mockSession },
            user: mockUser,
        });
        (lucia.invalidateSession as Mock).mockResolvedValue(undefined);
        mockDbInsert([]);

        await authService.logout("session_1");

        expect(lucia.invalidateSession).toHaveBeenCalledWith("session_1");
    });
});

describe("authService.changePassword", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("invalidates all existing sessions after password change", async () => {
        mockDbSelect([mockUser]);
        (verifyPassword as Mock).mockResolvedValue(true);
        (hashPassword as Mock).mockResolvedValue("new_hashed_pw");
        mockDbUpdate();
        (lucia.invalidateUserSessions as Mock).mockResolvedValue(undefined);
        mockDbInsert([]);

        await authService.changePassword("user_1", {
            currentPassword: "oldpass",
            newPassword: "newpass1234",
        });

        expect(lucia.invalidateUserSessions).toHaveBeenCalledWith("user_1");
    });
});
