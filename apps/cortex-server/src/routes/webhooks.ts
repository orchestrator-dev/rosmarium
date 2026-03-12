import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { webhookService } from "../modules/webhooks/webhook.service.js";

const webhookRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // GET /api/webhooks
    app.get("/api/webhooks", {
        schema: { tags: ["Webhooks"], summary: "List all webhooks" },
    }, async () => {
        return { data: await webhookService.list() };
    });

    // POST /api/webhooks
    app.post<{ Body: { name: string; url: string; events: string[]; contentTypes?: string[]; secret?: string } }>(
        "/api/webhooks",
        { schema: { tags: ["Webhooks"], summary: "Register a webhook", body: { type: "object", required: ["name", "url", "events"], properties: { name: { type: "string" }, url: { type: "string" }, events: { type: "array", items: { type: "string" } }, contentTypes: { type: "array", items: { type: "string" } }, secret: { type: "string" } } } } },
        async (request, reply) => {
            try {
                const webhook = await webhookService.register(request.body);
                return reply.status(201).send({ data: webhook });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return reply.status(422).send({ error: { code: "VALIDATION_ERROR", message } });
            }
        },
    );

    // GET /api/webhooks/:id
    app.get<{ Params: { id: string } }>("/api/webhooks/:id", {
        schema: { tags: ["Webhooks"], summary: "Get a webhook by id" },
    }, async (request, reply) => {
        const webhook = await webhookService.getById(request.params.id);
        if (!webhook) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Webhook not found" } });
        return { data: webhook };
    });

    // PATCH /api/webhooks/:id
    app.patch<{ Params: { id: string }; Body: { name?: string; url?: string; events?: string[]; contentTypes?: string[]; isActive?: boolean } }>(
        "/api/webhooks/:id",
        { schema: { tags: ["Webhooks"], summary: "Update a webhook" } },
        async (request, reply) => {
            try {
                const webhook = await webhookService.update(request.params.id, request.body);
                return { data: webhook };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                const status = message.includes("not found") ? 404 : 422;
                return reply.status(status).send({ error: { code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR", message } });
            }
        },
    );

    // DELETE /api/webhooks/:id
    app.delete<{ Params: { id: string } }>("/api/webhooks/:id", {
        schema: { tags: ["Webhooks"], summary: "Delete a webhook" },
    }, async (request, reply) => {
        try {
            await webhookService.delete(request.params.id);
            return reply.status(204).send();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            return reply.status(404).send({ error: { code: "NOT_FOUND", message } });
        }
    });

    // GET /api/webhooks/:id/deliveries
    app.get<{ Params: { id: string }; Querystring: { limit?: string; offset?: string } }>(
        "/api/webhooks/:id/deliveries",
        { schema: { tags: ["Webhooks"], summary: "Get delivery history for a webhook" } },
        async (request) => {
            const limit = parseInt(request.query.limit ?? "20", 10);
            const offset = parseInt(request.query.offset ?? "0", 10);
            return { data: await webhookService.getDeliveries(request.params.id, { limit, offset }) };
        },
    );

    // POST /api/webhooks/:id/deliveries/:dId/replay
    app.post<{ Params: { id: string; dId: string } }>(
        "/api/webhooks/:id/deliveries/:dId/replay",
        { schema: { tags: ["Webhooks"], summary: "Replay a failed delivery" } },
        async (request, reply) => {
            try {
                await webhookService.replay(request.params.dId);
                return reply.status(202).send({ data: { queued: true } });
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                return reply.status(404).send({ error: { code: "NOT_FOUND", message } });
            }
        },
    );
};

export default fp(webhookRoutes, { name: "webhook-routes" });
