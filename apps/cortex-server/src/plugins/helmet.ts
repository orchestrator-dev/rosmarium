import fp from "fastify-plugin";
import helmet, { type FastifyHelmetOptions } from "@fastify/helmet";
import type { FastifyInstance } from "fastify";

export default fp<FastifyHelmetOptions>(async (fastify: FastifyInstance) => {
    await fastify.register(helmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "validator.swagger.io"],
            },
        },
        global: true,
    });
});
