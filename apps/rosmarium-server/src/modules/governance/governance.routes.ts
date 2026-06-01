/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
import { FastifyInstance } from "fastify";
import { governanceService } from "./governance.service.js";
import { requireAuth, requireRole } from "../rbac/rbac.middleware.js";

export async function governanceRoutes(app: FastifyInstance) {
    app.get("/stats", { preHandler: [requireAuth(), requireRole("admin", "super_admin", "editor")] }, async (request, reply) => {
        return governanceService.getFreshnessStats();
    });

    app.get("/rot", { preHandler: [requireAuth(), requireRole("admin", "super_admin", "editor")] }, async (request, reply) => {
        return governanceService.getRotContent();
    });

    app.get("/quality/:entryId", { preHandler: [requireAuth()] }, async (request, reply) => {
        const { entryId } = request.params as { entryId: string };
        return governanceService.getQualityScore(entryId);
    });
}
