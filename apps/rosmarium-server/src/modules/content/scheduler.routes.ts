/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { schedulerService } from "./scheduler.service.js";

import { requirePermission } from "../rbac/rbac.middleware.js";

export const schedulerRoutes: FastifyPluginAsyncTypebox = async (fastify: any) => {
    fastify.post("/:type/:id/schedule", {
        preHandler: requirePermission("content:update:any"), // Reusing content update permission
        schema: {
            params: Type.Object({ type: Type.String(), id: Type.String() }),
            body: Type.Object({
                action: Type.Union([Type.Literal("publish"), Type.Literal("unpublish")]),
                scheduledAt: Type.String({ format: "date-time" })
            })
        }
    }, async (req: any) => {
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
        preHandler: requirePermission("content:update:any"),
        schema: {
            params: Type.Object({ type: Type.String(), id: Type.String() }),
            querystring: Type.Object({
                action: Type.Union([Type.Literal("publish"), Type.Literal("unpublish")])
            })
        }
    }, async (req: any, reply: any) => {
        await schedulerService.cancelScheduled(req.params.id, req.query.action as "publish" | "unpublish");
        reply.code(204).send();
    });

    fastify.get("/:type/:id/schedule", {
        preHandler: requirePermission("content:read:any"),
        schema: {
            params: Type.Object({ type: Type.String(), id: Type.String() })
        }
    }, async (req: any) => {
        return schedulerService.getScheduledJobs(req.params.id);
    });
};
