import "./observability/index.js";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";
import { getSchema } from "./graphql/index.js";
import { createContext } from "./graphql/context.js";

const start = async () => {
    const app = await buildApp();

    try {
        await app.listen({ port: config.PORT, host: config.HOST });
        app.log.info({ port: config.PORT, env: config.NODE_ENV }, "Server successfully started.");

        // WebSocket server for GraphQL subscriptions (same path as /graphql)
        const wsServer = new WebSocketServer({ server: app.server, path: "/graphql" });
        useServer(
            {
                schema: getSchema() as unknown as Parameters<typeof useServer>[0]["schema"],
                context: (ctx) => createContext(ctx.extra.request as unknown as Request),
            },
            wsServer,
        );
        app.log.info("GraphQL WebSocket subscriptions active at /graphql");
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
