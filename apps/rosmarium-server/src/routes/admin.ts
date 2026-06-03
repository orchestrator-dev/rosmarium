/**
 * Admin routes — operational endpoints for system administrators.
 *
 * GET /api/admin/queue-stats — BullMQ queue statistics.
 */

import type { FastifyInstance } from "fastify";
import { requireRole } from "../modules/rbac/rbac.middleware.js";
import { getQueueStats } from "../modules/jobs/intelligence.jobs.js";
import { tenantService, TenantPlan } from "../modules/tenants/tenant.service.js";
import { schemaSyncRoutes } from "../modules/content/schema-sync.routes.js";
import { z } from "zod";

export default async function adminRoutes(app: FastifyInstance) {
    await app.register(schemaSyncRoutes, { prefix: "/api/admin" });
    // GET /api/admin/queue-stats — admin/super_admin only
    app.get(
        "/api/admin/queue-stats",
        { onRequest: requireRole("admin", "super_admin") },
        async (_request, reply) => {
            try {
                const stats = await getQueueStats();
                return reply.send({ data: stats });
            } catch (err) {
                app.log.error({ err }, "queue-stats failed");
                return reply.status(503).send({ error: { code: "SERVICE_UNAVAILABLE", message: "Queue unavailable" } });
            }
        },
    );

    // POST /api/admin/tenants — super_admin only
    app.post(
        "/api/admin/tenants",
        { onRequest: requireRole("super_admin") },
        async (request, reply) => {
            const schema = z.object({
                slug: z.string().regex(/^[a-z0-9-]+$/),
                name: z.string(),
                plan: z.enum(["free", "starter", "pro", "enterprise"]),
                adminEmail: z.string().email(),
                adminPassword: z.string().min(8),
                storageBucket: z.string().optional(),
            });

            try {
                const data = schema.parse(request.body);
                const result = await tenantService.provision({
                    ...data,
                    plan: data.plan as TenantPlan,
                });
                return reply.status(201).send({ data: { tenant: result.tenant } });
            } catch (err: unknown) {
                app.log.error({ err }, "tenant provisioning failed");
                return reply.status(400).send({ error: { code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) } });
            }
        }
    );

    // GET /api/admin/tenants — super_admin only
    app.get(
        "/api/admin/tenants",
        { onRequest: requireRole("super_admin") },
        async (_request, reply) => {
            try {
                const tenants = await tenantService.listTenants();
                return reply.send({ data: tenants });
            } catch (err) {
                app.log.error({ err }, "list-tenants failed");
                return reply.status(500).send({ error: { code: "INTERNAL_ERROR" } });
            }
        }
    );
}

