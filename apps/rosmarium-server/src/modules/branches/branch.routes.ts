/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { branchService } from "./branch.service.js";
import { mergeService } from "./merge.service.js";

export async function branchRoutes(fastify: FastifyInstance) {
    fastify.post(
        "/",
        {
            schema: {
                body: Type.Object({
                    name: Type.String(),
                    baseBranchId: Type.Optional(Type.String())
                }),
            },
        },
        async (request, reply) => {
            const body = request.body as { name: string; baseBranchId?: string };
            const userId = (request as any).user?.id || "system"; // Simplified auth
            const branch = await branchService.createBranch(body.name, userId, body.baseBranchId);
            return reply.send(branch);
        }
    );

    fastify.get("/", async (request, reply) => {
        const branches = await branchService.listBranches();
        return reply.send(branches);
    });

    fastify.get("/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const branch = await branchService.getBranch(id);
        return reply.send(branch);
    });

    fastify.get("/:id/diff", async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await mergeService.diffBranch(id);
        return reply.send(result);
    });

    fastify.post(
        "/:id/merge",
        {
            schema: {
                body: Type.Object({
                    resolvedData: Type.Optional(Type.Record(Type.String(), Type.Record(Type.String(), Type.Unknown())))
                })
            }
        },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const body = request.body as { resolvedData?: Record<string, Record<string, unknown>> };
            const userId = (request as any).user?.id || "system";
            const result = await mergeService.mergeBranch(id, userId, body.resolvedData);
            return reply.send(result);
        }
    );

    fastify.delete("/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await branchService.abandonBranch(id);
        return reply.send(result);
    });
}
