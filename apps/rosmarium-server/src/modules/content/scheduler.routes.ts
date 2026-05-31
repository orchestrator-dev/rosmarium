import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { schedulerService } from "./scheduler.service.js";

export const schedulerRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
    fastify.post("/:type/:id/schedule", {
        preHandler: fastify.requirePermission("content:update:any"), // Reusing content update permission
        schema: {
            params: Type.Object({ type: Type.String(), id: Type.String() }),
            body: Type.Object({
                action: Type.Union([Type.Literal("publish"), Type.Literal("unpublish")]),
                scheduledAt: Type.String({ format: "date-time" })
            })
        }
    }, async (req) => {
        const jobId = await schedulerService.scheduleAction(
            req.params.id, 
            req.body.action as "publish" | "unpublish",
            new Date(req.body.scheduledAt),
            req.user!.id,
            req.params.type
        );
        return { success: true, jobId };
    });

    fastify.delete("/:type/:id/schedule", {
        preHandler: fastify.requirePermission("content:update:any"),
        schema: {
            params: Type.Object({ type: Type.String(), id: Type.String() }),
            querystring: Type.Object({
                action: Type.Union([Type.Literal("publish"), Type.Literal("unpublish")])
            })
        }
    }, async (req, reply) => {
        await schedulerService.cancelScheduled(req.params.id, req.query.action as "publish" | "unpublish");
        reply.code(204).send();
    });

    fastify.get("/:type/:id/schedule", {
        preHandler: fastify.requirePermission("content:read:any"),
        schema: {
            params: Type.Object({ type: Type.String(), id: Type.String() })
        }
    }, async (req) => {
        return schedulerService.getScheduledJobs(req.params.id);
    });
};
