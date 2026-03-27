import { db } from "../../db/index.js";
import { apiKeys, users, auditLog } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import { sha256Hex } from "./password.js";
import type { ApiKey } from "../../db/schema/index.js";
import type { AuthenticatedUser } from "./auth.service.js";
import { createId } from "@paralleldrive/cuid2";

export class ApiKeyError extends Error {
    constructor(
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = "ApiKeyError";
    }
}

/**
 * Generate a raw API key with format: ctx_live_{32-char hex}
 */
function generateRawKey(): string {
    // 16 random bytes → 32 hex chars
    const randomPart = createId() + createId(); // two cuid2 IDs as entropy
    const hex = Buffer.from(randomPart).toString("hex").slice(0, 32);
    return `ctx_live_${hex}`;
}

export const apiKeyService = {
    /**
     * Create a new API key.
     * The rawKey is returned ONCE — it is never retrievable again.
     */
    async create(input: {
        name: string;
        userId: string;
        scopes: string[];
        expiresAt?: Date;
    }): Promise<{ apiKey: ApiKey; rawKey: string }> {
        const rawKey = generateRawKey();
        const keyHash = await sha256Hex(rawKey);
        // First 12 chars e.g. "ctx_live_a8f" — safe to display in UI
        const keyPrefix = rawKey.slice(0, 12);

        const [apiKey] = await db
            .insert(apiKeys)
            .values({
                name: input.name,
                keyHash,
                keyPrefix,
                userId: input.userId,
                scopes: input.scopes,
                expiresAt: input.expiresAt,
            })
            .returning();

        if (!apiKey) {
            throw new Error("Failed to create API key");
        }

        // Write audit log
        try {
            await db.insert(auditLog).values({
                userId: input.userId,
                action: "api_key.created",
                resourceType: "api_key",
                resourceId: apiKey.id,
                metadata: { name: input.name, scopes: input.scopes },
            });
        } catch {
            // Audit failures must not block key creation
        }

        return { apiKey, rawKey };
    },

    /**
     * Validate an API key presented in a Bearer token.
     * Updates lastUsedAt non-blocking.
     */
    async validate(rawKey: string): Promise<{
        valid: boolean;
        apiKey?: ApiKey;
        user?: AuthenticatedUser;
    }> {
        const keyHash = await sha256Hex(rawKey);

        const rows = await db
            .select({
                apiKey: apiKeys,
                user: users,
            })
            .from(apiKeys)
            .innerJoin(users, eq(apiKeys.userId, users.id))
            .where(eq(apiKeys.keyHash, keyHash))
            .limit(1);

        const row = rows[0];

        if (!row) {
            return { valid: false };
        }

        const { apiKey, user } = row;

        // Check expiry
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            return { valid: false };
        }

        // Check user is active
        if (!user.isActive) {
            return { valid: false };
        }

        // Update lastUsedAt non-blocking
        db.update(apiKeys)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKeys.id, apiKey.id))
            .catch(() => undefined);

        const authenticatedUser: AuthenticatedUser = {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role as AuthenticatedUser["role"],
            isActive: user.isActive,
        };

        return { valid: true, apiKey, user: authenticatedUser };
    },

    /**
     * Revoke (delete) an API key.
     */
    async revoke(id: string, revokedBy: string): Promise<void> {
        await db.delete(apiKeys).where(eq(apiKeys.id, id));

        try {
            await db.insert(auditLog).values({
                userId: revokedBy,
                action: "api_key.revoked",
                resourceType: "api_key",
                resourceId: id,
            });
        } catch {
            // Audit failures must not block revocation
        }
    },

    /**
     * List API keys for a user.
     * Returns keys with prefix visible, hash NEVER exposed.
     */
    async list(userId: string): Promise<Omit<ApiKey, "keyHash">[]> {
        const rows = await db
            .select({
                id: apiKeys.id,
                name: apiKeys.name,
                keyPrefix: apiKeys.keyPrefix,
                userId: apiKeys.userId,
                scopes: apiKeys.scopes,
                expiresAt: apiKeys.expiresAt,
                lastUsedAt: apiKeys.lastUsedAt,
                createdAt: apiKeys.createdAt,
            })
            .from(apiKeys)
            .where(eq(apiKeys.userId, userId));

        return rows;
    },
};
