import type { FastifyPluginAsync } from "fastify";

import { templatesService } from "../../modules/content/templates.service.js";

const templateRoutes: FastifyPluginAsync = async (app) => {
    // GET /api/templates
    app.get(
        "/templates",
        async (req, reply) => {
            const { contentTypeId } = req.query as { contentTypeId?: string };
            const templates = await templatesService.list(contentTypeId);
            return reply.send({ data: templates });
        }
    );

    // POST /api/templates
    app.post(
        "/templates",
        async (request, reply) => {
            const body = request.body as {
                name: string;
                description?: string;
                contentTypeId?: string;
                templateData: Record<string, unknown>;
                isGlobal?: boolean;
            };

            const user = request.user;
            const createdBy = user?.id;

            const template = await templatesService.create({ ...body, createdBy });
            return reply.status(201).send({ data: template });
        }
    );

    // PATCH /api/templates/:id
    app.patch(
        "/templates/:id",
        async (req, reply) => {
            const { id } = req.params as { id: string };
            const body = req.body as {
                name?: string;
                description?: string;
                templateData?: Record<string, unknown>;
                isGlobal?: boolean;
            };
            const template = await templatesService.update(id, body);
            return reply.send({ data: template });
        }
    );

    // DELETE /api/templates/:id
    app.delete(
        "/templates/:id",
        async (req, reply) => {
            const { id } = req.params as { id: string };
            const success = await templatesService.delete(id);
            if (!success) {
                return reply.status(404).send({ error: { message: "Template not found" } });
            }
            return reply.send({ success: true });
        }
    );
};

export default templateRoutes;
