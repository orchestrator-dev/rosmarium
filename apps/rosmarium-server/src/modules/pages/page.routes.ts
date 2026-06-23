import { FastifyPluginAsync } from "fastify";
import { pageService } from "./page.service.js";
import { componentService } from "./component.service.js";

export const pageRoutes: FastifyPluginAsync = async (fastify) => {
    // Component Registry Routes
    fastify.post("/api/pages/components", async (request, reply) => {
        const body = request.body as any;
        return await componentService.registerComponent(body);
    });

    fastify.get("/api/pages/components", async (request, reply) => {
        return await componentService.getComponents();
    });

    // Page Builder Routes
    fastify.post("/api/pages", async (request, reply) => {
        const body = request.body as any;
        return await pageService.createPage(body);
    });

    fastify.get("/api/pages", async (request, reply) => {
        return await pageService.getPages();
    });

    fastify.get("/api/pages/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const page = await pageService.getPageById(id);
        if (!page) {
            return reply.code(404).send({ error: "Page not found" });
        }
        return page;
    });

    fastify.put("/api/pages/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        return await pageService.updatePage(id, body);
    });

    fastify.delete("/api/pages/:id", async (request, reply) => {
        const { id } = request.params as { id: string };
        return await pageService.deletePage(id);
    });
};
