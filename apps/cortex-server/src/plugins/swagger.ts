import fp from "fastify-plugin";
import swagger, { type FastifySwaggerOptions } from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "../config.js";
import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";

export default fp<FastifySwaggerOptions>(async (fastify: FastifyInstance) => {
    if (config.NODE_ENV === "production") return;

    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8"));

    await fastify.register(swagger, {
        openapi: {
            info: {
                title: "Rosmarium CMS API",
                description: "OpenAPI documentation for Rosmarium CMS",
                version: pkg.version as string,
            },
        },
    });

    await fastify.register(swaggerUi, {
        routePrefix: "/docs",
        initOAuth: {},
        uiConfig: {
            docExpansion: "list",
            deepLinking: false,
        },
        staticCSP: true,
    });
});
