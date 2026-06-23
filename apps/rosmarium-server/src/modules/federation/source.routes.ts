import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { sourceService } from "./source.service.js";

export const sourceRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
    fastify.post(
        "/",
        {
            schema: {
                body: Type.Object({
                    name: Type.String(),
                    type: Type.String(),
                    endpoint: Type.String(),
                    authConfig: Type.Optional(Type.Any()),
                    cacheConfig: Type.Optional(Type.Any()),
                }),
                response: {
                    201: Type.Object({ id: Type.String() }),
                },
            },
        },
        async (request, reply) => {
            const source = await sourceService.createSource(request.body as any);
            return reply.code(201).send({ id: source.id });
        }
    );

    fastify.get(
        "/",
        {
            schema: {
                response: {
                    200: Type.Array(Type.Any()),
                },
            },
        },
        async (request, reply) => {
            const sources = await sourceService.listSources();
            return reply.send(sources);
        }
    );

    fastify.get(
        "/:id",
        {
            schema: {
                params: Type.Object({ id: Type.String() }),
                response: {
                    200: Type.Any(),
                },
            },
        },
        async (request, reply) => {
            const source = await sourceService.getSource(request.params.id);
            if (!source) return reply.notFound();
            return reply.send(source);
        }
    );

    fastify.put(
        "/:id",
        {
            schema: {
                params: Type.Object({ id: Type.String() }),
                body: Type.Any(),
                response: {
                    200: Type.Any(),
                },
            },
        },
        async (request, reply) => {
            const source = await sourceService.updateSource(request.params.id, request.body as any);
            return reply.send(source);
        }
    );

    fastify.delete(
        "/:id",
        {
            schema: {
                params: Type.Object({ id: Type.String() }),
                response: {
                    204: Type.Null(),
                },
            },
        },
        async (request, reply) => {
            await sourceService.deleteSource(request.params.id);
            return reply.code(204).send();
        }
    );
};
