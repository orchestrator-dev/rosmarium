import { FastifyInstance } from "fastify";
import { config } from "../../config.js";
import { z } from "zod";

const generationBodySchema = z.object({
    prompt: z.string(),
    context: z.record(z.unknown()).optional(),
    stream: z.boolean().optional().default(false)
});

const rewriteBodySchema = z.object({
    text: z.string(),
    style: z.enum(["formal", "casual", "technical", "marketing", "expand", "compress", "simplify"]),
    stream: z.boolean().optional().default(false)
});

const seoBodySchema = z.object({
    text: z.string(),
    focusKeyword: z.string().optional()
});

const altTextBodySchema = z.object({
    context: z.string()
});

export async function generationRoutes(fastify: FastifyInstance) {
    const { aiGovernanceService } = await import("./ai-governance.service.js");
    
    // Helper to proxy to python worker
    async function proxyToWorker(path: string, body: unknown, reply: any, opType: string, request: any) {
        const startTime = Date.now();
        const res = await fetch(`${config.AI_WORKER_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Worker-Secret": config.AI_WORKER_SECRET,
            },
            body: JSON.stringify(body)
        });
        
        const tenantId = (request as any).tenant;
        const userId = (request as any).user?.id;
        
        if (!res.ok) {
            await aiGovernanceService.logOperation({
                operationType: opType,
                tenantId,
                userId,
                status: "error",
                latencyMs: Date.now() - startTime,
            }).catch(console.error);
            reply.code(res.status).send(await res.text());
            return;
        }

        await aiGovernanceService.logOperation({
            operationType: opType,
            tenantId,
            userId,
            status: "success",
            latencyMs: Date.now() - startTime,
            modelProvider: "internal",
            inputTokens: 0,
            outputTokens: 0,
        }).catch(console.error);

        const isSSE = res.headers.get("content-type")?.includes("text/event-stream");
        if (isSSE && res.body) {
            reply.header("Content-Type", "text/event-stream");
            reply.header("Cache-Control", "no-cache");
            reply.header("Connection", "keep-alive");
            return reply.send(res.body);
        } else {
            return reply.send(await res.json());
        }
    }

    fastify.post("/generate", async (request, reply) => {
        const body = generationBodySchema.parse(request.body);
        return proxyToWorker("/generation/generate", body, reply, "generate", request);
    });

    fastify.post("/rewrite", async (request, reply) => {
        const body = rewriteBodySchema.parse(request.body);
        return proxyToWorker("/generation/rewrite", body, reply, "rewrite", request);
    });

    fastify.post("/seo-optimize", async (request, reply) => {
        const body = seoBodySchema.parse(request.body);
        return proxyToWorker("/generation/seo-optimize", body, reply, "seo-optimize", request);
    });

    fastify.post("/alt-text", async (request, reply) => {
        const body = altTextBodySchema.parse(request.body);
        return proxyToWorker("/generation/alt-text", body, reply, "alt-text", request);
    });
}
