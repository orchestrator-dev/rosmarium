import { FastifyRequest, FastifyReply } from "fastify";
import { tenantService } from "./tenant.service.js";
import { tenantStorage } from "../../db/index.js";

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = request.headers["x-tenant-id"] as string;
    
    // Default to a system/public tenant if not provided, or reject depending on strictness
    if (!tenantId) {
        // If not strictly required for some routes, we could return or default.
        // For multi-tenant, let's allow proceeding without a tenant (uses public schema)
        // or we could throw. Let's not throw to keep existing public routes working.
        return;
    }

    const tenant = await tenantService.getTenant(tenantId);
    if (!tenant || !tenant.isActive) {
        return reply.status(404).send({ error: "Tenant not found or inactive" });
    }

    // Attach to request
    (request as any).tenant = tenant;
}

export function tenantStorageHook(request: FastifyRequest, reply: FastifyReply, done: () => void) {
    const tenant = (request as any).tenant;
    if (tenant) {
        tenantStorage.run(tenant.slug, done);
    } else {
        done();
    }
}
