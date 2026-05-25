/**
 * Admin routes — operational endpoints for system administrators.
 *
 * GET /api/admin/queue-stats — BullMQ queue statistics.
 */

import type { FastifyInstance } from "fastify";
import { requireRole } from "../modules/rbac/rbac.middleware.js";
import { getQueueStats } from "../modules/jobs/intelligence.jobs.js";

export default async function adminRoutes(app: FastifyInstance) {
    // GET /api/admin/queue-stats — admin/super_admin only
    app.get(
        "/api/admin/queue-stats",
        { preHandler: requireRole("admin", "super_admin") },
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
}

