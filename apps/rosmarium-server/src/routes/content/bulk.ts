import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { contentBulkService, type BulkAction } from "../../modules/content/bulk.service.js";
import { requirePermission } from "../../modules/rbac/rbac.middleware.js";

const bulkSchema = z.object({
    entryIds: z.array(z.string()).min(1),
    labels: z.array(z.string()).optional(),
    style: z.enum(["brief", "detailed", "bullet"]).optional()
});

const bulkRoutes: FastifyPluginAsync = async (app) => {
    app.post<{ Params: { action: string }; Body: z.infer<typeof bulkSchema> }>(
        "/bulk/:action",
        {
            preHandler: [requirePermission("content:update:any")],
        },
        async (req, reply) => {
            const { action } = req.params;
            const validActions: BulkAction[] = ["publish", "unpublish", "delete", "archive", "tag", "summarize"];
            
            if (!validActions.includes(action as BulkAction)) {
                return reply.code(400).send({ error: "Invalid bulk action" });
            }

            const body = bulkSchema.parse(req.body);
            const userId = req.user!.id; // from auth plugin

            const result = await contentBulkService.executeBulkAction({
                action: action as BulkAction,
                entryIds: body.entryIds,
                userId,
                labels: body.labels,
                style: body.style,
            });

            return reply.send({ data: result });
        }
    );
};

export default bulkRoutes;
