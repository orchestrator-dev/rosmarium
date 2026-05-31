import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { hierarchyService } from "../../modules/content/hierarchy.service.js";
import { requirePermission } from "../../modules/rbac/rbac.middleware.js";

const moveSchema = z.object({
    entryId: z.string(),
    newParentId: z.string().nullable()
});

const hierarchyRoutes: FastifyPluginAsync = async (app) => {
    app.get(
        "/hierarchy",
        {
            preHandler: [requirePermission("content:read:any")],
        },
        async (req, reply) => {
            const tree = await hierarchyService.getTree();
            return reply.send({ data: tree });
        }
    );

    app.post<{ Body: z.infer<typeof moveSchema> }>(
        "/hierarchy/move",
        {
            preHandler: [requirePermission("content:update:any")],
        },
        async (req, reply) => {
            const body = moveSchema.parse(req.body);
            const userId = req.user!.id;

            await hierarchyService.moveNode(body.entryId, body.newParentId, userId);
            return reply.send({ success: true });
        }
    );
};

export default hierarchyRoutes;
