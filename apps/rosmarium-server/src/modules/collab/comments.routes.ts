/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
import { Type } from "@sinclair/typebox";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { commentsService } from "./comments.service.js";
import { requireAuth } from "../rbac/rbac.middleware.js";

export const commentsRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
    fastify.addHook("preHandler", requireAuth);

    fastify.get("/:entryId/comments", {
        schema: {
            params: Type.Object({ entryId: Type.String() }),
            querystring: Type.Object({ fieldId: Type.Optional(Type.String()) })
        }
    }, async (req: any) => {
        if (req.query.fieldId) {
            return commentsService.listByField(req.params.entryId, req.query.fieldId);
        }
        return commentsService.listByEntry(req.params.entryId);
    });

    fastify.post("/:entryId/comments", {
        schema: {
            params: Type.Object({ entryId: Type.String() }),
            body: Type.Object({
                content: Type.String(),
                fieldId: Type.Optional(Type.String()),
                parentId: Type.Optional(Type.String())
            })
        }
    }, async (req: any) => {
        return commentsService.create({
            entryId: req.params.entryId,
            content: req.body.content,
            authorId: req.user!.id,
            fieldId: req.body.fieldId,
            parentId: req.body.parentId
        });
    });

    fastify.post("/comments/:commentId/resolve", {
        schema: {
            params: Type.Object({ commentId: Type.String() })
        }
    }, async (req: any) => {
        return commentsService.resolve(req.params.commentId);
    });

    fastify.delete("/comments/:commentId", {
        schema: {
            params: Type.Object({ commentId: Type.String() })
        }
    }, async (req: any, reply) => {
        await commentsService.delete(req.params.commentId);
        return reply.status(204).send();
    });
};
