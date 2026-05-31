import { FastifyInstance, FastifyReply } from "fastify";
import { config } from "../../config.js";
import { z } from "zod";

const translateBodySchema = z.object({
    text: z.string(),
    targetLanguage: z.string(),
    tenantId: z.string().optional()
});

const glossaryBodySchema = z.object({
    source: z.string(),
    target: z.string()
});

export async function translationRoutes(fastify: FastifyInstance) {
    
    async function proxyToWorker(path: string, body: unknown, reply: FastifyReply) {
        const res = await fetch(`${config.AI_WORKER_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Worker-Secret": config.AI_WORKER_SECRET,
            },
            body: JSON.stringify(body)
        });
        
        if (!res.ok) {
            reply.code(res.status).send(await res.text());
            return;
        }

        return reply.send(await res.json());
    }

    fastify.post("/translate", async (request, reply) => {
        const body = translateBodySchema.parse(request.body);
        return proxyToWorker("/translation/translate", body, reply);
    });

    fastify.post("/glossary/:tenantId", async (request, reply) => {
        const { tenantId } = request.params as { tenantId: string };
        const body = glossaryBodySchema.parse(request.body);
        return proxyToWorker(`/translation/glossary/${tenantId}`, body, reply);
    });
}
