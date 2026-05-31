/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { branchService } from "./branch.service.js";
import { mergeService } from "./merge.service.js";

export async function branchRoutes(fastify: FastifyInstance) {
    fastify.post(
        "/",
        {
            schema: {
                body: z.object({
                    name: z.string(),
                    baseBranchId: z.string().optional()
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
                body: z.object({
                    resolvedData: z.record(z.string(), z.record(z.string(), z.unknown())).optional()
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
