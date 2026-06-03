import { FastifyInstance } from "fastify";
import { requireAuth } from "../modules/rbac/rbac.middleware.js";

export async function assetsRoutes(app: FastifyInstance) {
    app.post("/upload", { preHandler: requireAuth() }, async (request, reply) => {
        return reply.status(501).send({ error: "Not Implemented" });
    });

    app.post("/presign", { preHandler: requireAuth() }, async (request, reply) => {
        return reply.status(501).send({ error: "Not Implemented" });
    });

    app.post("/:id/confirm", { preHandler: requireAuth() }, async (request, reply) => {
        return reply.status(501).send({ error: "Not Implemented" });
    });

    app.get("/", { preHandler: requireAuth() }, async (request, reply) => {
        return reply.status(501).send({ error: "Not Implemented" });
    });

    app.patch("/:id", { preHandler: requireAuth() }, async (request, reply) => {
        return reply.status(501).send({ error: "Not Implemented" });
    });

    app.delete("/:id", { preHandler: requireAuth() }, async (request, reply) => {
        return reply.status(501).send({ error: "Not Implemented" });
    });

    app.get("/folders", { preHandler: requireAuth() }, async (request, reply) => {
        return reply.status(501).send({ error: "Not Implemented" });
    });

    app.post("/folders", { preHandler: requireAuth() }, async (request, reply) => {
        return reply.status(501).send({ error: "Not Implemented" });
    });

    app.delete("/folders/:id", { preHandler: requireAuth() }, async (request, reply) => {
        return reply.status(501).send({ error: "Not Implemented" });
    });
}
