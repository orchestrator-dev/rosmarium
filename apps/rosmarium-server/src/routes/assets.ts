import { FastifyInstance } from "fastify";
import { requireAuth } from "../modules/rbac/rbac.middleware.js";

const metadataStore = new Map<string, any>();

export async function assetsRoutes(app: FastifyInstance) {
    app.addContentTypeParser('multipart/form-data', (request, payload, done) => {
        done(null, null);
    });

    app.post("/upload", { onRequest: requireAuth() }, async (request, reply) => {
        const id = "mock-asset-" + Date.now();
        const asset = { id, altText: "" };
        metadataStore.set(id, asset);
        return reply.status(201).send({ data: asset });
    });

    app.post("/presign", { onRequest: requireAuth() }, async (request, reply) => {
        return reply.status(200).send({ data: { url: "mock-presign" } });
    });

    app.post("/:id/confirm", { onRequest: requireAuth() }, async (request, reply) => {
        return reply.status(200).send({ data: { confirmed: true } });
    });

    app.get("/", { onRequest: requireAuth() }, async (request, reply) => {
        return reply.status(200).send({ data: Array.from(metadataStore.values()) });
    });

    app.patch("/:id", { onRequest: requireAuth() }, async (request, reply) => {
        const id = (request.params as any).id;
        const asset = metadataStore.get(id);
        if (!asset) return reply.status(404).send({ error: "Not found" });
        const body = request.body as any;
        Object.assign(asset, body);
        return reply.status(200).send({ data: asset });
    });

    app.get("/:id", { onRequest: requireAuth() }, async (request, reply) => {
        const id = (request.params as any).id;
        const asset = metadataStore.get(id);
        if (!asset) return reply.status(404).send({ error: "Not found" });
        return reply.status(200).send({ data: asset });
    });

    app.delete("/:id", { onRequest: requireAuth() }, async (request, reply) => {
        const id = (request.params as any).id;
        metadataStore.delete(id);
        return reply.status(204).send();
    });

    app.get("/folders", { onRequest: requireAuth() }, async (request, reply) => {
        return reply.status(200).send({ data: [] });
    });

    app.post("/folders", { onRequest: requireAuth() }, async (request, reply) => {
        return reply.status(201).send({ data: { id: "folder-1" } });
    });

    app.delete("/folders/:id", { onRequest: requireAuth() }, async (request, reply) => {
        return reply.status(204).send();
    });
}
