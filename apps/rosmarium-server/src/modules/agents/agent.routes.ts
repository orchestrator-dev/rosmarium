import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { agentService } from "./agent.service.js";
import type { AgentTaskType } from "@orchestrator.dev/types";

const createTaskSchema = z.object({
    type: z.enum(["localization", "compliance", "brand-voice", "seo-audit", "rot-cleanup", "custom"]),
    goal: z.string().min(3, "Goal must be at least 3 characters long"),
    requiresHumanReview: z.boolean().optional(),
    tenantId: z.string().optional(),
    createdBy: z.string().optional(),
});

const reviewTaskSchema = z.object({
    approved: z.boolean(),
    note: z.string().optional(),
});

const cancelTaskSchema = z.object({
    reason: z.string().optional(),
});

const listTasksQuerySchema = z.object({
    tenantId: z.string().optional(),
    status: z.string().optional(),
    type: z.string().optional(),
});

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
    // Create task
    fastify.post("/api/agents/tasks", async (request, reply) => {
        const parseResult = createTaskSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: parseResult.error.format() });
        }
        const task = await agentService.createTask({
            ...parseResult.data,
            type: parseResult.data.type as AgentTaskType,
        });
        return reply.status(201).send(task);
    });

    // List tasks
    fastify.get("/api/agents/tasks", async (request, reply) => {
        const parseResult = listTasksQuerySchema.safeParse(request.query);
        if (!parseResult.success) {
            return reply.status(400).send({ error: parseResult.error.format() });
        }
        return await agentService.listTasks(parseResult.data);
    });

    // Get task by ID
    fastify.get("/api/agents/tasks/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const task = await agentService.getTaskById(id);
        if (!task) {
            return reply.status(404).send({ error: "Agent task not found" });
        }
        return task;
    });

    // Execute task
    fastify.post("/api/agents/tasks/:id/execute", async (request, reply) => {
        const { id } = request.params as { id: string };
        const task = await agentService.executeTask(id);
        if (!task) {
            return reply.status(404).send({ error: "Agent task not found" });
        }
        return task;
    });

    // Human-in-the-loop review approval / rejection
    fastify.post("/api/agents/tasks/:id/review", async (request, reply) => {
        const { id } = request.params as { id: string };
        const parseResult = reviewTaskSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({ error: parseResult.error.format() });
        }
        try {
            const task = await agentService.approveReview(id, parseResult.data.approved, parseResult.data.note);
            if (!task) {
                return reply.status(404).send({ error: "Agent task not found" });
            }
            return task;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return reply.status(400).send({ error: message });
        }
    });

    // Cancel task
    fastify.post("/api/agents/tasks/:id/cancel", async (request, reply) => {
        const { id } = request.params as { id: string };
        const parseResult = cancelTaskSchema.safeParse(request.body || {});
        if (!parseResult.success) {
            return reply.status(400).send({ error: parseResult.error.format() });
        }
        const task = await agentService.cancelTask(id, parseResult.data.reason);
        if (!task) {
            return reply.status(404).send({ error: "Agent task not found" });
        }
        return task;
    });
};
