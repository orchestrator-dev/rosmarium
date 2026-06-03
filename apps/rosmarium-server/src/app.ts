/* eslint-disable @typescript-eslint/no-explicit-any */
import Fastify, { FastifyRequest } from "fastify";
import websocket from "@fastify/websocket";
import { logger } from "./lib/logger.js";
import { config } from "./config.js";
import { registerPlugins } from "./plugins/index.js";
import { registerRoutes } from "./routes/index.js";
import { registry } from "./modules/content/registry.js";
import { rosmariumEvents } from "./lib/events.js";
import { pubsub } from "./graphql/context.js";
import { webhookService } from "./modules/webhooks/webhook.service.js";
import { getWebhookWorker } from "./modules/webhooks/webhook.queue.js";
import graphqlPlugin from "./graphql/index.js";
import { dispatchIntelligenceJob, dispatchEmbeddingJob } from "./modules/jobs/intelligence.jobs.js";
import { tenantMiddleware, tenantStorageHook } from "./modules/tenants/tenant.middleware.js";
import { branchStorageHook } from "./modules/branches/branch.middleware.js";
import { i18nMiddleware } from "./modules/i18n/i18n.middleware.js";
import { loadPlugins } from "./plugins/plugin-loader.js";
import { pluginRegistry } from "./plugins/plugin-registry.js";
import { invalidationService } from "./modules/cache/invalidation.service.js";

export async function buildApp() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = Fastify({ 
        logger: {
            stream: (logger as any).stream,
            level: logger.level,
            serializers: {
                req(request: FastifyRequest) {
                    return {
                        method: request.method,
                        url: request.url,
                        tenantId: (request as any).tenant,
                        userId: (request as any).user?.id,
                    };
                }
            }
        } as any 
    });

    // Register multi-tenant and branch context
    app.addHook("onRequest", tenantMiddleware);
    app.addHook("onRequest", tenantStorageHook);
    app.addHook("onRequest", branchStorageHook);
    app.addHook("onRequest", i18nMiddleware);

    // Global Error Handler
    app.setErrorHandler((error, request, reply) => {
        request.log.error(error);
        const isProd = config.NODE_ENV === "production";
        const code = error.code || "INTERNAL_SERVER_ERROR";
        const message = isProd && !error.statusCode ? "Internal Server Error" : error.message;
        const statusCode = error.statusCode || 500;
        
        reply.status(statusCode).send({
            error: {
                code,
                message
            }
        });
    });

    await registerPlugins(app);

    await loadPlugins();

    // Load content type registry before routes
    await registry.load();

    // Register observability plugin
    const { observabilityPlugin } = await import("./observability/fastify-metrics.js");
    await app.register(observabilityPlugin);

    // Register GraphQL plugin (Yoga + schema)
    await app.register(graphqlPlugin);

    await app.register(websocket);

    await registerRoutes(app);

    // Register plugin custom routes
    for (const plugin of pluginRegistry.getAll()) {
        if (plugin.routes) {
            plugin.routes(app);
        }
    }

    // Start the webhook worker
    if (process.env.NODE_ENV !== "test") {
        getWebhookWorker();
    }

    // ─── Consolidated Event Dispatcher ──────────────────────────────
    rosmariumEvents.on("content.created", (entry) => {
        const ct = registry.getAll().find((t) => t.id === entry.contentTypeId);
        if (!ct) return;
        
        pubsub.publish(`entry.created.${ct.name}`, entry);
        webhookService.trigger("entry.created", ct.name, entry).catch(console.error);
    });

    rosmariumEvents.on("content.updated", (entry) => {
        const ct = registry.getAll().find((t) => t.id === entry.contentTypeId);
        if (!ct) return;

        pubsub.publish(`entry.updated.${ct.name}`, entry);
        webhookService.trigger("entry.updated", ct.name, entry).catch(console.error);
    });

    rosmariumEvents.on("content.deleted", (id, contentType) => {
        pubsub.publish(`entry.deleted.${contentType}`, { id, contentType });
        webhookService.trigger("entry.deleted", contentType, { id, contentType }).catch(console.error);
    });

    rosmariumEvents.on("content.published", (entry) => {
        const ct = registry.getAll().find((t) => t.id === entry.contentTypeId);
        if (!ct) return;

        webhookService.trigger("entry.published", ct.name, entry).catch(console.error);

        const aiSettings = ct.settings["aiIntelligence"] as
            | {
                  enabled?: boolean;
                  operations?: ("tag" | "ner" | "summarize" | "deduplicate")[];
                  tagTaxonomy?: string[];
              }
            | undefined;

        if (!aiSettings?.enabled) return;

        // Extract text fields from the entry data
        const fields: { fieldName: string; text: string }[] = [];
        const data = entry.data as Record<string, unknown>;
        for (const field of ct.fields) {
            const val = data[field.name];
            if (typeof val === "string" && val.trim()) {
                fields.push({ fieldName: field.name, text: val });
            }
        }

        if (fields.length === 0) return;

        dispatchEmbeddingJob({
            contentEntryId: entry.id,
            contentType: ct.name,
            fields,
            locale: entry.locale,
            triggeredBy: 'create',
        }).catch(console.error);

        dispatchIntelligenceJob({
            contentEntryId: entry.id,
            contentType: ct.name,
            fields,
            locale: entry.locale,
            candidateLabels: aiSettings.tagTaxonomy ?? [],
            operations: aiSettings.operations ?? ["tag", "ner", "deduplicate"],
        }).catch(console.error);
    });

    // ─── Bridge rosmariumEvents → Edge Cache ──────────────────────────────────
    invalidationService.init();

    return app;
}
