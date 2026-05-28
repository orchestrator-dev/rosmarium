import { createYoga } from "graphql-yoga";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { config } from "../config.js";
import { createContext } from "./context.js";

// ─── Import order is critical for Pothos ─────────────────────────────────────
import { builder } from "./builder.js";
import "./scalars.js";
import "./types/common.js";
import "./types/content-type.js";
import "./types/content-entry.js";
import "./types/pagination.js";
import "./queries/content-types.js";
import "./queries/content-entries.js";
import "./mutations/content-types.js";
import "./mutations/content-entries.js";
import "./subscriptions/content.js";
// ─────────────────────────────────────────────────────────────────────────────

export const schema = builder.toSchema();

const graphqlPlugin = fp(
    async (app: FastifyInstance) => {
        const yoga = createYoga({
            schema,
            // createContext receives the YogaInitialContext which has a request property
            context: (yogaCtx) => createContext(yogaCtx.request),
            graphiql: config.NODE_ENV !== "production",
            logging: false,
        });

        app.route({
            url: "/graphql",
            method: ["GET", "POST", "OPTIONS"],
            handler: async (req, reply) => {
                const response = await yoga.handleNodeRequestAndResponse(
                    req.raw,
                    reply.raw,
                );
                reply.status(response.status);
                response.headers.forEach((value, key) => reply.header(key, value));
                return reply.send(response.body);
            },
        });
    },
    { name: "graphql-plugin" },
);

export default graphqlPlugin;
