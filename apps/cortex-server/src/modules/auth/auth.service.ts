import { lucia } from "./lucia.js";
import { hashPassword, verifyPassword } from "./password.js";
import { db } from "../../db/index.js";
import { users, auditLog } from "../../db/schema/index.js";
import { eq } from "drizzle-orm";
import type { User } from "../../db/schema/index.js";
import type { Session, Cookie } from "lucia";

export type UserRole = "super_admin" | "admin" | "editor" | "author" | "viewer";

export type AuthenticatedUser = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
    isActive: boolean;
};

// ─── Error codes ──────────────────────────────────────────────────────────────

export class AuthError extends Error {
    constructor(
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = "AuthError";
    }
}

export const AUTH_ERRORS = {
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
    EMAIL_TAKEN: "EMAIL_TAKEN",
    WRONG_PASSWORD: "WRONG_PASSWORD",
    SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
} as const;

// ─── Audit log helper ─────────────────────────────────────────────────────────

async function writeAuditLog(
    action: string,
    userId: string | null,
    metadata: Record<string, unknown> = {}
): Promise<void> {
    try {
        await db.insert(auditLog).values({
            userId,
            action,
            resourceType: "user",
            resourceId: userId ?? undefined,
            metadata,
        });
    } catch {
        // Audit log failures must never block auth operations
    }
}

// ─── Auth service ─────────────────────────────────────────────────────────────

export const authService = {
    /**
     * Register a new user.
     * Throws EMAIL_TAKEN if the email is already in use.
     */
    async register(input: {
        email: string;
        password: string;
        firstName?: string;
        lastName?: string;
        role?: UserRole;
    }): Promise<{ user: User; session: Session }> {
        const existing = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, input.email.toLowerCase()))
            .limit(1);

        if (existing.length > 0) {
            throw new AuthError(AUTH_ERRORS.EMAIL_TAKEN, "Email already registered");
        }

        const passwordHash = await hashPassword(input.password);

        const [user] = await db
            .insert(users)
            .values({
                email: input.email.toLowerCase(),
                passwordHash,
                firstName: input.firstName,
                lastName: input.lastName,
                role: input.role ?? "viewer",
            })
            .returning();

        if (!user) {
            throw new Error("Failed to create user");
        }

        const session = await lucia.createSession(user.id, {});

        await writeAuditLog("user.registered", user.id);

        return { user, session };
    },

    /**
     * Authenticate a user with email + password.
     * Always throws INVALID_CREDENTIALS for both wrong password and unknown email
     * to prevent email enumeration via timing attacks.
     */
    async login(input: {
        email: string;
        password: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<{ user: User; session: Session; sessionCookie: Cookie }> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, input.email.toLowerCase()))
            .limit(1);

        // Always run verification (even on a dummy hash) to prevent timing attacks
        const dummyHash =
            "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA$dummy";
        const hashToVerify = user?.passwordHash ?? dummyHash;
        const isValid = await verifyPassword(hashToVerify, input.password);

        if (!user || !isValid) {
            throw new AuthError(AUTH_ERRORS.INVALID_CREDENTIALS, "Invalid email or password");
        }

        if (!user.isActive) {
            throw new AuthError(AUTH_ERRORS.ACCOUNT_DISABLED, "Account is disabled");
        }

        // Update last login timestamp (non-blocking)
        db.update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, user.id))
            .catch(() => undefined);

        const session = await lucia.createSession(user.id, {});
        const sessionCookie = lucia.createSessionCookie(session.id);

        await writeAuditLog("user.login", user.id, {
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });

        return { user, session, sessionCookie };
    },

    /**
     * Invalidate a session (logout).
     */
    async logout(sessionId: string): Promise<void> {
        const { session } = await lucia.validateSession(sessionId);
        if (session) {
            await writeAuditLog("user.logout", session.userId);
        }
        await lucia.invalidateSession(sessionId);
    },

    /**
     * Validate a session ID. Extends the session if it is close to expiry (Lucia handles this).
     */
    async validateSession(
        sessionId: string
    ): Promise<{ user: AuthenticatedUser | null; session: Session | null }> {
        const result = await lucia.validateSession(sessionId);

        if (!result.user || !result.session) {
            return { user: null, session: null };
        }

        const authenticatedUser: AuthenticatedUser = {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            role: result.user.role as UserRole,
            isActive: result.user.isActive,
        };

        return { user: authenticatedUser, session: result.session };
    },

    /**
     * Refresh a session — creates a new session and invalidates the old one.
     */
    async refreshSession(sessionId: string): Promise<Session> {
        const { session } = await lucia.validateSession(sessionId);
        if (!session) {
            throw new AuthError(AUTH_ERRORS.SESSION_NOT_FOUND, "Session not found");
        }
        await lucia.invalidateSession(sessionId);
        return lucia.createSession(session.userId, {});
    },

    /**
     * Change a user's password.
     * Verifies the current password, then invalidates ALL sessions to force re-login.
     */
    async changePassword(
        userId: string,
        input: { currentPassword: string; newPassword: string }
    ): Promise<void> {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user || !user.passwordHash) {
            throw new AuthError(AUTH_ERRORS.INVALID_CREDENTIALS, "Invalid credentials");
        }

        const isValid = await verifyPassword(user.passwordHash, input.currentPassword);
        if (!isValid) {
            throw new AuthError(AUTH_ERRORS.WRONG_PASSWORD, "Current password is incorrect");
        }

        const newHash = await hashPassword(input.newPassword);

        await db
            .update(users)
            .set({ passwordHash: newHash })
            .where(eq(users.id, userId));

        // Invalidate ALL existing sessions for this user
        await lucia.invalidateUserSessions(userId);

        await writeAuditLog("user.password_changed", userId);
    },
};
