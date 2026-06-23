import { createYoga } from "graphql-yoga";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { config } from "../config.js";
import { createContext } from "./context.js";
import { pluginRegistry } from "../plugins/plugin-registry.js";
import { useDepthLimit } from "@envelop/depth-limit";

// ─── Import order is critical for Pothos ─────────────────────────────────────
import { builder } from "./builder.js";
import "./scalars.js";
import "./types/common.js";
import "./types/content-type.js";
import "./types/content-entry.js";
import "./types/comment.js";
import "./types/pagination.js";
import "./queries/content-types.js";
import "./queries/content-entries.js";
import "./mutations/content-types.js";
import "./mutations/content-entries.js";
import "./subscriptions/content.js";
import type { GraphQLSchema } from "graphql";
// ─────────────────────────────────────────────────────────────────────────────

let _schema: GraphQLSchema | null = null;

export async function getSchema() {
    if (!_schema) {
        // Let plugins extend graphql builder
        for (const plugin of pluginRegistry.getAll()) {
            if (plugin.graphql) {
                if (plugin.graphql.types) plugin.graphql.types(builder);
                if (plugin.graphql.queries) plugin.graphql.queries(builder);
                if (plugin.graphql.mutations) plugin.graphql.mutations(builder);
            }
        }
        _schema = builder.toSchema();
        
        // Dynamically import stitcher to avoid circular deps
        const { stitcherService } = await import("../modules/federation/stitcher.js");
        _schema = await stitcherService.stitch(_schema);
    }
    return _schema;
}

const graphqlPlugin = fp(
    async (app: FastifyInstance) => {
        const schema = await getSchema();
        const yoga = createYoga({
            schema,
            // createContext receives the YogaInitialContext which has a request property
            context: (yogaCtx) => createContext(yogaCtx.request),
            graphiql: config.NODE_ENV !== "production",
            logging: false,
            plugins: [useDepthLimit({ maxDepth: 10 })], // Add depth limit to prevent DoS attacks
        });

        app.route({
            url: "/graphql",
            method: ["GET", "POST", "OPTIONS"],
            handler: async (req, reply) => {
                const response = await yoga.handleNodeRequest(req, {
                    req,
                    reply,
                } as any);
                response.headers.forEach((value, key) => {
                    reply.header(key, value);
                });
                reply.status(response.status);
                reply.send(response.body);
                return reply;
            },
        });
    },
    { name: "graphql-plugin" },
);

export default graphqlPlugin;
