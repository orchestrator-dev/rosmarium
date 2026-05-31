/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { workflowService } from "./workflow.service.js";

import { requirePermission } from "../rbac/rbac.middleware.js";

export const workflowRoutes: FastifyPluginAsyncTypebox = async (fastify: any) => {
    fastify.addHook("onRequest", requirePermission("workflow:read:any"));

    const WorkflowDef = Type.Object({
        id: Type.String(),
        name: Type.String(),
        contentTypes: Type.Array(Type.String()),
        states: Type.Array(Type.Object({
            key: Type.String(),
            label: Type.String(),
            color: Type.String(),
            permissions: Type.Object({
                edit: Type.Array(Type.String()),
                view: Type.Array(Type.String())
            })
        })),
        transitions: Type.Array(Type.Object({
            from: Type.String(),
            to: Type.String(),
            label: Type.String(),
            requiredRole: Type.String(),
            requireComment: Type.Boolean(),
            autoAssign: Type.Optional(Type.String()),
            webhookEvent: Type.Optional(Type.String()),
            conditions: Type.Optional(Type.Array(Type.Object({
                field: Type.String(),
                operator: Type.Union([
                    Type.Literal("eq"), Type.Literal("neq"), Type.Literal("gt"), 
                    Type.Literal("lt"), Type.Literal("contains"), Type.Literal("not_contains"),
                    Type.Literal("empty"), Type.Literal("not_empty")
                ]),
                value: Type.Optional(Type.Any())
            })))
        })),
        initialState: Type.String(),
        publishedState: Type.String()
    });

    fastify.get("/", async () => {
        return workflowService.getWorkflows();
    });

    fastify.post("/", {
        preHandler: requirePermission("workflow:create:any"),
        schema: {
            body: Type.Object({
                name: Type.String(),
                definition: WorkflowDef,
                isDefault: Type.Boolean()
            })
        }
    }, async (req: any) => {
        const body = req.body as { name: string; definition: unknown; isDefault: boolean };
        return workflowService.createWorkflow(body as any);
    });

    fastify.put("/:id", {
        preHandler: requirePermission("workflow:update:any"),
        schema: {
            params: Type.Object({ id: Type.String() }),
            body: Type.Object({
                name: Type.Optional(Type.String()),
                definition: Type.Optional(WorkflowDef),
                isDefault: Type.Optional(Type.Boolean())
            })
        }
    }, async (req: any) => {
        const body = req.body as { name?: string; definition?: unknown; isDefault?: boolean };
        return workflowService.updateWorkflow(req.params.id, body as any);
    });

    fastify.delete("/:id", {
        preHandler: requirePermission("workflow:delete:any"),
        schema: {
            params: Type.Object({ id: Type.String() })
        }
    }, async (req: any, reply: any) => {
        await workflowService.deleteWorkflow(req.params.id);
        reply.code(204).send();
    });

    // Content entry transition endpoints
    fastify.get("/history/:entryId", async (req: any) => {
        return workflowService.getHistory(req.params.entryId as string);
    });

    fastify.post("/transition/:entryId", {
        schema: {
            params: Type.Object({ entryId: Type.String() }),
            body: Type.Object({
                toState: Type.String(),
                comment: Type.Optional(Type.String())
            })
        }
    }, async (req: any) => {
        return workflowService.transition(req.params.entryId, req.body.toState, req.user!.id, req.body.comment);
    });
};
