import Fastify from "fastify";
import { logger } from "./lib/logger.js";
import { registerPlugins } from "./plugins/index.js";
import { registerRoutes } from "./routes/index.js";
import { registry } from "./modules/content/registry.js";
import { rosmariumEvents } from "./lib/events.js";
import { pubsub } from "./graphql/context.js";
import { webhookService } from "./modules/webhooks/webhook.service.js";
import graphqlPlugin from "./graphql/index.js";

export async function buildApp() {
    const app = Fastify({ logger: logger as any });

    await registerPlugins(app);

    // Load content type registry before routes
    await registry.load();

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

    return app;
}
