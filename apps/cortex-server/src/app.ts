import Fastify from "fastify";
import { logger } from "./lib/logger.js";
import { registerPlugins } from "./plugins/index.js";
import { registerRoutes } from "./routes/index.js";
import { registry } from "./modules/content/registry.js";

export async function buildApp() {
    const app = Fastify({ logger: logger as any });

    await registerPlugins(app);

    // Load content type registry before routes so all handlers have access
    await registry.load();

    await registerRoutes(app);

    return app;
}
