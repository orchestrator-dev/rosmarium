import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../db/index.js", () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
}));

vi.mock("./password.js", () => ({
    sha256Hex: vi.fn(),
    hashPassword: vi.fn(),
    verifyPassword: vi.fn(),
}));

vi.mock("../../db/schema/index.js", () => ({
    apiKeys: {},
    users: {},
    auditLog: {},
}));

vi.mock("@paralleldrive/cuid2", () => ({
    createId: vi.fn().mockReturnValue("mockedCuidValue0123"),
}));

import { apiKeyService } from "./api-key.service.js";
import { sha256Hex } from "./password.js";
import { db } from "../../db/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUser = {
    id: "user_1",
    email: "user@example.com",
    firstName: "Test",
    lastName: "User",
    role: "editor" as const,
    isActive: true,
    lastLoginAt: null,
    avatarUrl: null,
    passwordHash: "hash",
    createdAt: new Date(),
    updatedAt: new Date(),
};

const storedHash = "sha256_stored_hash";

const mockApiKey = {
    id: "key_1",
    name: "My Key",
    keyHash: storedHash,
    keyPrefix: "ctx_live_moc",
    userId: "user_1",
    scopes: ["content:read:any"],
    expiresAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
};

function mockDbInsert(returnValue: unknown[] = []) {
    const chain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(returnValue),
    };
    (db.insert as Mock).mockReturnValue(chain);
    return chain;
}

function mockDbSelect(returnValue: unknown[] = []) {
    const chain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(returnValue),
    };
    (db.select as Mock).mockReturnValue(chain);
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

function mockDbDelete() {
    const chain = { where: vi.fn().mockResolvedValue(undefined) };
    (db.delete as Mock).mockReturnValue(chain);
    return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("apiKeyService.create", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns rawKey once and stores only the hash", async () => {
        (sha256Hex as Mock).mockResolvedValue(storedHash);

        // First call: insert api key → returns the stored key
        const apiKeyChain = {
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([mockApiKey]),
        };
        // Second call: insert audit log → empty result
        const auditChain = {
            values: vi.fn().mockReturnThis(),
            returning: vi.fn().mockResolvedValue([]),
        };
        (db.insert as Mock)
            .mockReturnValueOnce(apiKeyChain)
            .mockReturnValueOnce(auditChain);

        const { apiKey, rawKey } = await apiKeyService.create({
            name: "My Key",
            userId: "user_1",
            scopes: ["content:read:any"],
        });

        // rawKey must start with ctx_live_
        expect(rawKey).toMatch(/^ctx_live_/);
        // stored hash must differ from raw key
        expect(rawKey).not.toBe(apiKey.keyHash);
        // sha256Hex was called with the raw key to produce the hash
        expect(sha256Hex).toHaveBeenCalledWith(rawKey);
    });
});

describe("apiKeyService.validate", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("returns valid=true and user for a valid, non-expired key", async () => {
        (sha256Hex as Mock).mockResolvedValue(storedHash);
        mockDbSelect([{ apiKey: mockApiKey, user: mockUser }]);
        mockDbUpdate(); // lastUsedAt update

        const result = await apiKeyService.validate("ctx_live_rawtext");

        expect(result.valid).toBe(true);
        expect(result.user?.id).toBe("user_1");
    });

    it("returns valid=false for an expired key", async () => {
        (sha256Hex as Mock).mockResolvedValue(storedHash);
        mockDbSelect([
            {
                apiKey: { ...mockApiKey, expiresAt: new Date(Date.now() - 1000) },
                user: mockUser,
            },
        ]);

        const result = await apiKeyService.validate("ctx_live_rawtext");

        expect(result.valid).toBe(false);
    });

    it("returns valid=false when key is not found", async () => {
        (sha256Hex as Mock).mockResolvedValue("nonexistent_hash");
        mockDbSelect([]); // no rows found

        const result = await apiKeyService.validate("ctx_live_unknown");

        expect(result.valid).toBe(false);
    });

    it("updates lastUsedAt non-blocking (does not throw on DB failure)", async () => {
        (sha256Hex as Mock).mockResolvedValue(storedHash);
        mockDbSelect([{ apiKey: mockApiKey, user: mockUser }]);

        // Simulate update failure — should not propagate
        const failChain = {
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockRejectedValue(new Error("DB timeout")),
        };
        (db.update as Mock).mockReturnValue(failChain);

        const result = await apiKeyService.validate("ctx_live_rawtext");

        // Validation still succeeds despite update failure
        expect(result.valid).toBe(true);
    });
});

describe("apiKeyService.revoke", () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it("deletes the API key", async () => {
        const deleteChain = mockDbDelete();
        mockDbInsert([]); // audit log

        await apiKeyService.revoke("key_1", "user_1");

        expect(db.delete).toHaveBeenCalled();
        expect(deleteChain.where).toHaveBeenCalled();
    });
});
