import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { authService } from "../../modules/auth/auth.service.js";
import { requireAuth } from "../../modules/rbac/rbac.middleware.js";
import { lucia } from "../../modules/auth/lucia.js";

// ─── Input schemas ─────────────────────────────────────────────────────────────

const registerBody = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
});

const loginBody = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

const changePasswordBody = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
});

// ─── Safe user projection (never expose passwordHash) ─────────────────────────

function safeUser(user: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...safe } = user as { passwordHash?: unknown };
    return safe;
}

// ─── Session routes ────────────────────────────────────────────────────────────

const sessionRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // POST /api/auth/register
    app.post(
        "/api/auth/register",
        {
            schema: {
                tags: ["Auth"],
                summary: "Register a new user account",
                body: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: { type: "string", format: "email" },
                        password: { type: "string", minLength: 8 },
                        firstName: { type: "string" },
                        lastName: { type: "string" },
                    },
                },
                response: {
                    201: { type: "object", properties: { data: { type: "object" } } },
                },
            },
        },
        async (request, reply) => {
            const body = registerBody.safeParse(request.body);
            if (!body.success) {
                return reply.status(400).send({
                    error: { code: "VALIDATION_ERROR", message: body.error.message },
                });
            }

            try {
                const { user, session } = await authService.register(body.data);
                const sessionCookie = lucia.createSessionCookie(session.id);
                void reply.header("Set-Cookie", sessionCookie.serialize());
                return reply.status(201).send({ data: { user: safeUser(user as Record<string, unknown>) } });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Registration failed";
                const code = (err as { code?: string }).code ?? "REGISTRATION_ERROR";
                const status = code === "EMAIL_TAKEN" ? 409 : 422;
                return reply.status(status).send({ error: { code, message } });
            }
        }
    );

    // POST /api/auth/login
    app.post(
        "/api/auth/login",
        {
            schema: {
                tags: ["Auth"],
                summary: "Authenticate and receive a session cookie",
                body: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: { type: "string", format: "email" },
                        password: { type: "string" },
                    },
                },
                response: {
                    200: { type: "object", properties: { data: { type: "object" } } },
                },
            },
        },
        async (request, reply) => {
            const body = loginBody.safeParse(request.body);
            if (!body.success) {
                return reply.status(400).send({
                    error: { code: "VALIDATION_ERROR", message: body.error.message },
                });
            }

            try {
                const { user, sessionCookie } = await authService.login({
                    email: body.data.email,
                    password: body.data.password,
                    ipAddress: request.ip,
                    userAgent: request.headers["user-agent"],
                });

                void reply.header("Set-Cookie", sessionCookie.serialize());

                // NEVER return session ID in body — cookie only
                return reply.status(200).send({
                    data: { user: safeUser(user as Record<string, unknown>) },
                });
            } catch (err) {
                const code = (err as { code?: string }).code ?? "AUTH_ERROR";
                const message = err instanceof Error ? err.message : "Login failed";
                const status =
                    code === "ACCOUNT_DISABLED" ? 403 :
                        code === "INVALID_CREDENTIALS" ? 401 : 422;
                return reply.status(status).send({ error: { code, message } });
            }
        }
    );

    // POST /api/auth/logout
    app.post(
        "/api/auth/logout",
        {
            preHandler: requireAuth(),
            schema: {
                tags: ["Auth"],
                summary: "Invalidate the current session",
                response: { 204: { type: "null" } },
            },
        },
        async (request, reply) => {
            if (request.sessionId) {
                await authService.logout(request.sessionId);
            }
            // Clear session cookie
            const blankCookie = lucia.createBlankSessionCookie();
            void reply.header("Set-Cookie", blankCookie.serialize());
            return reply.status(204).send();
        }
    );

    // GET /api/auth/me
    app.get(
        "/api/auth/me",
        {
            preHandler: requireAuth(),
            schema: {
                tags: ["Auth"],
                summary: "Get the currently authenticated user",
                response: {
                    200: { type: "object", properties: { data: { type: "object" } } },
                },
            },
        },
        async (request, reply) => {
            if (!request.user) {
                return reply.status(401).send({
                    error: { code: "UNAUTHORIZED", message: "Not authenticated" },
                });
            }
            // request.user is already the safe projection (no passwordHash)
            return reply.status(200).send({ data: { user: request.user } });
        }
    );

    // PATCH /api/auth/me/password
    app.patch(
        "/api/auth/me/password",
        {
            preHandler: requireAuth(),
            schema: {
                tags: ["Auth"],
                summary: "Change the authenticated user's password",
                body: {
                    type: "object",
                    required: ["currentPassword", "newPassword"],
                    properties: {
                        currentPassword: { type: "string" },
                        newPassword: { type: "string", minLength: 8 },
                    },
                },
                response: { 204: { type: "null" } },
            },
        },
        async (request, reply) => {
            const body = changePasswordBody.safeParse(request.body);
            if (!body.success) {
                return reply.status(400).send({
                    error: { code: "VALIDATION_ERROR", message: body.error.message },
                });
            }

            if (!request.user) {
                return reply.status(401).send({
                    error: { code: "UNAUTHORIZED", message: "Not authenticated" },
                });
            }

            try {
                await authService.changePassword(request.user.id, body.data);
                // Invalidate all sessions including this one
                const blankCookie = lucia.createBlankSessionCookie();
                void reply.header("Set-Cookie", blankCookie.serialize());
                return reply.status(204).send();
            } catch (err) {
                const code = (err as { code?: string }).code ?? "ERROR";
                const message = err instanceof Error ? err.message : "Password change failed";
                const status = code === "WRONG_PASSWORD" ? 403 : 422;
                return reply.status(status).send({ error: { code, message } });
            }
        }
    );
};

export default fp(sessionRoutes, { name: "session-routes" });
