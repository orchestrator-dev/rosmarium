/**
 * Admin routes — operational endpoints for system administrators.
 *
 * GET /api/admin/queue-stats — BullMQ queue statistics.
 */

import type { FastifyInstance } from "fastify";
import type { AuthenticatedUser } from "../modules/auth/auth.service.js";
import { getQueueStats } from "../modules/jobs/intelligence.jobs.js";

export default async function adminRoutes(app: FastifyInstance) {
    // GET /api/admin/queue-stats
    app.get("/api/admin/queue-stats", async (request, reply) => {
        const user = request.user as AuthenticatedUser | undefined;
        if (!user) {
            return reply.status(401).send({ error: "Unauthorized" });
        }

        const isAdmin =
            user.role === "admin" ||
            user.role === "super_admin";

        if (!isAdmin) {
            return reply.status(403).send({ error: "Forbidden" });
        }

        try {
            const stats = await getQueueStats();
            return reply.send({ data: stats });
        } catch (err) {
            app.log.error({ err }, "queue-stats failed");
            return reply.status(503).send({ error: "Queue unavailable" });
        }
    });
}
