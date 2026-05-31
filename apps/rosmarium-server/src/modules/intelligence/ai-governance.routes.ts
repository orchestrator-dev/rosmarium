import { FastifyInstance, FastifyRequest } from "fastify";
import { aiGovernanceService } from "./ai-governance.service.js";

export async function aiGovernanceRoutes(fastify: FastifyInstance) {
    fastify.get("/dashboard", async (request, reply) => {
        const tenantId = (request as FastifyRequest & { tenant?: string }).tenant;
        const metrics = await aiGovernanceService.getDashboardMetrics(tenantId);
        const budget = tenantId ? await aiGovernanceService.checkTenantTokenBudget(tenantId) : null;
        
        return reply.send({ metrics, budget });
    });

    fastify.get("/limits", async (request, reply) => {
        const userId = (request as FastifyRequest & { user?: { id: string } }).user?.id;
        if (!userId) {
            return reply.status(401).send({ error: "Unauthorized" });
        }
        const userLimits = await aiGovernanceService.checkUserRateLimit(userId);
        return reply.send({ limits: userLimits });
    });
}
