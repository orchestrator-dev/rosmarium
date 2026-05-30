import Fastify, { FastifyRequest } from "fastify";
import { logger } from "./lib/logger.js";
import { registerPlugins } from "./plugins/index.js";
import { registerRoutes } from "./routes/index.js";
import { registry } from "./modules/content/registry.js";
import { rosmariumEvents } from "./lib/events.js";
import { pubsub } from "./graphql/context.js";
import { webhookService } from "./modules/webhooks/webhook.service.js";
import graphqlPlugin from "./graphql/index.js";
import { dispatchIntelligenceJob } from "./modules/jobs/intelligence.jobs.js";
import { tenantMiddleware, tenantStorageHook } from "./modules/tenants/tenant.middleware.js";

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

    // Register multi-tenant context
    app.addHook("onRequest", tenantMiddleware);
    app.addHook("onRequest", tenantStorageHook);

    await registerPlugins(app);

    // Load content type registry before routes
    await registry.load();

    // Register observability plugin
    const { observabilityPlugin } = await import("./observability/fastify-metrics.js");
    await app.register(observabilityPlugin);

    // Register GraphQL plugin (Yoga + schema)
    await app.register(graphqlPlugin);

    await registerRoutes(app);

    // ─── Bridge rosmariumEvents → GraphQL PubSub ──────────────────────────────
    rosmariumEvents.on("content.created", (entry) => {
        const ct = registry.getAll().find((t) => t.id === entry.contentTypeId);
        if (ct) pubsub.publish(`entry.created.${ct.name}`, entry);
    });
    rosmariumEvents.on("content.updated", (entry) => {
        const ct = registry.getAll().find((t) => t.id === entry.contentTypeId);
        if (ct) pubsub.publish(`entry.updated.${ct.name}`, entry);
    });
    rosmariumEvents.on("content.deleted", (id, contentType) => {
        pubsub.publish(`entry.deleted.${contentType}`, { id, contentType });
    });

    // ─── Bridge rosmariumEvents → Webhook delivery ────────────────────────────
    rosmariumEvents.on("content.created", (entry) => {
        const ct = registry.getAll().find((t) => t.id === entry.contentTypeId);
        if (ct) webhookService.trigger("entry.created", ct.name, entry).catch(console.error);
    });
    rosmariumEvents.on("content.updated", (entry) => {
        const ct = registry.getAll().find((t) => t.id === entry.contentTypeId);
        if (ct) webhookService.trigger("entry.updated", ct.name, entry).catch(console.error);
    });
    rosmariumEvents.on("content.deleted", (id, contentType) => {
        webhookService.trigger("entry.deleted", contentType, { id, contentType }).catch(console.error);
    });
    rosmariumEvents.on("content.published", (entry) => {
        const ct = registry.getAll().find((t) => t.id === entry.contentTypeId);
        if (ct) webhookService.trigger("entry.published", ct.name, entry).catch(console.error);
    });

    // ─── Bridge rosmariumEvents → Intelligence jobs ───────────────────────────
    rosmariumEvents.on("content.published", (entry) => {
        const ct = registry.getAll().find((t) => t.id === entry.contentTypeId);
        if (!ct) return;

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

        dispatchIntelligenceJob({
            contentEntryId: entry.id,
            contentType: ct.name,
            fields,
            locale: entry.locale,
            candidateLabels: aiSettings.tagTaxonomy ?? [],
            operations: aiSettings.operations ?? ["tag", "ner", "deduplicate"],
        }).catch(console.error);
    });

    return app;
}
