import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { usersService } from "../modules/auth/users.service.js";
import { requireRole } from "../modules/rbac/rbac.middleware.js";
import { AuthError } from "../modules/auth/auth.service.js";

const createUserBody = z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z.enum(["super_admin", "admin", "editor", "author", "viewer"]),
});

const updateUserBody = z.object({
    role: z.enum(["super_admin", "admin", "editor", "author", "viewer"]).optional(),
    isActive: z.boolean().optional(),
});

const userRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // GET /api/users
    app.get(
        "/api/users",
        {
            onRequest: requireRole("admin", "super_admin"),
            schema: {
                tags: ["Users"],
                summary: "List all users",
                response: {
                    200: {
                        type: "object",
                        properties: {
                            data: { type: "array" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const users = await usersService.list();
            return reply.status(200).send({ data: users });
        }
    );

    // POST /api/users
    app.post(
        "/api/users",
        {
            onRequest: requireRole("admin", "super_admin"),
            schema: {
                tags: ["Users"],
                summary: "Create a new user (Invite)",
                body: {
                    type: "object",
                    required: ["email", "role"],
                    properties: {
                        email: { type: "string", format: "email" },
                        firstName: { type: "string" },
                        lastName: { type: "string" },
                        role: { type: "string", enum: ["super_admin", "admin", "editor", "author", "viewer"] },
                    },
                },
                response: {
                    201: { type: "object", properties: { data: { type: "object" } } },
                },
            },
        },
        async (request, reply) => {
            const body = createUserBody.safeParse(request.body);
            if (!body.success) {
                return reply.status(400).send({
                    error: { code: "VALIDATION_ERROR", message: body.error.message },
                });
            }

            try {
                // request.user is guaranteed to be set by requireRole
                const user = await usersService.create(request.user!.id, body.data);
                return reply.status(201).send({ data: { user } });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to create user";
                const code = err instanceof AuthError ? err.code : "CREATE_USER_ERROR";
                const status = code === "EMAIL_TAKEN" ? 409 : 422;
                return reply.status(status).send({ error: { code, message } });
            }
        }
    );

    // PATCH /api/users/:id
    app.patch<{ Params: { id: string } }>(
        "/api/users/:id",
        {
            onRequest: requireRole("admin", "super_admin"),
            schema: {
                tags: ["Users"],
                summary: "Update user role or active status",
                params: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                },
                body: {
                    type: "object",
                    properties: {
                        role: { type: "string", enum: ["super_admin", "admin", "editor", "author", "viewer"] },
                        isActive: { type: "boolean" },
                    },
                },
                response: {
                    200: { type: "object", properties: { data: { type: "object" } } },
                },
            },
        },
        async (request, reply) => {
            const body = updateUserBody.safeParse(request.body);
            if (!body.success) {
                return reply.status(400).send({
                    error: { code: "VALIDATION_ERROR", message: body.error.message },
                });
            }

            try {
                const user = await usersService.update(request.user!.id, request.params.id, body.data);
                return reply.status(200).send({ data: { user } });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to update user";
                return reply.status(422).send({ error: { code: "UPDATE_USER_ERROR", message } });
            }
        }
    );
};

export default fp(userRoutes, { name: "user-routes" });
