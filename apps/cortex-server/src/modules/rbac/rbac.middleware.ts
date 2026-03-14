import type { FastifyRequest, FastifyReply } from "fastify";
import { authService } from "../auth/auth.service.js";
import { apiKeyService } from "../auth/api-key.service.js";
import { rbacService, ForbiddenError } from "./rbac.service.js";
import { lucia } from "../auth/lucia.js";
import type { Permission } from "./permissions.js";
import type { UserRole, AuthenticatedUser } from "../auth/auth.service.js";

// ─── Fastify type augmentation ─────────────────────────────────────────────────

declare module "fastify" {
    interface FastifyRequest {
        user: AuthenticatedUser | null;
        sessionId: string | null;
    }
}

// ─── Internal helper: resolve user from cookie or Bearer token ─────────────

async function resolveUser(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<boolean> {
    // Attempt 1: Session cookie
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
        const sessionId = lucia.readSessionCookie(cookieHeader);
        if (sessionId) {
            const { user, session } = await authService.validateSession(sessionId);
            if (user && session) {
                request.user = user;
                request.sessionId = sessionId;

                // Refresh cookie if session was extended by Lucia
                if (session.fresh) {
                    const freshCookie = lucia.createSessionCookie(session.id);
                    void reply.header(
                        "Set-Cookie",
                        freshCookie.serialize()
                    );
                }
                return true;
            }
        }
    }

    // Attempt 2: Authorization: Bearer <api-key>
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        const rawKey = authHeader.slice(7).trim();
        const result = await apiKeyService.validate(rawKey);
        if (result.valid && result.user) {
            request.user = result.user;
            request.sessionId = null; // API key auth — no session
            return true;
        }
    }

    return false;
}

// ─── Middleware factories ──────────────────────────────────────────────────────

/**
 * Require any valid authentication (session cookie or API key Bearer).
 * Attaches request.user and request.sessionId.
 * Returns 401 if unauthenticated.
 */
export function requireAuth() {
    return async function authPreHandler(
        request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        // Initialise defaults so downstream handlers get typed access
        request.user = null;
        request.sessionId = null;

        const authenticated = await resolveUser(request, reply);
        if (!authenticated) {
            return reply.status(401).send({
                error: { code: "UNAUTHORIZED", message: "Authentication required" },
            });
        }
    };
}

/**
 * Require authentication AND a specific RBAC permission.
 * Returns 401 if unauthenticated, 403 if permission is missing.
 */
export function requirePermission(permission: Permission) {
    return async function permissionPreHandler(
        request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        request.user = null;
        request.sessionId = null;

        const authenticated = await resolveUser(request, reply);
        const user = request.user;
        if (!authenticated || !user) {
            return reply.status(401).send({
                error: { code: "UNAUTHORIZED", message: "Authentication required" },
            });
        }

        try {
            rbacService.canOrThrow(user, permission);
        } catch (err) {
            if (err instanceof ForbiddenError) {
                return reply.status(403).send({
                    error: { code: "FORBIDDEN", message: err.message },
                });
            }
            throw err;
        }
    };
}

/**
 * Require authentication AND membership in an allowed role list.
 * Returns 401 if unauthenticated, 403 if the role is not in the allowed set.
 */
export function requireRole(...roles: UserRole[]) {
    return async function rolePreHandler(
        request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        request.user = null;
        request.sessionId = null;

        const authenticated = await resolveUser(request, reply);
        if (!authenticated || !request.user) {
            return reply.status(401).send({
                error: { code: "UNAUTHORIZED", message: "Authentication required" },
            });
        }

        // resolveUser guarantees request.user is set when authenticated=true;
        // TS cannot follow cross-function mutations so we assert the type.
        const user = request.user as AuthenticatedUser;
        const userRole: string = user.role;
        if (!roles.includes(userRole as UserRole)) {
            return reply.status(403).send({
                error: {
                    code: "FORBIDDEN",
                    message: `Role '${user.role}' is not allowed. Required: ${roles.join(", ")}`,
                },
            });
        }
    };
}
