import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { processingService } from "./processing.service.js";
import { MediaTransformOptions } from "./transforms.js";

export const mediaRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/:id",
    {
      schema: {
        querystring: Type.Object({
          w: Type.Optional(Type.Number({ minimum: 1, maximum: 4000 })),
          h: Type.Optional(Type.Number({ minimum: 1, maximum: 4000 })),
          format: Type.Optional(Type.Union([
            Type.Literal("webp"),
            Type.Literal("avif"),
            Type.Literal("jpeg"),
            Type.Literal("png"),
            Type.Literal("auto")
          ])),
          quality: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
          fit: Type.Optional(Type.Union([
            Type.Literal("cover"),
            Type.Literal("contain"),
            Type.Literal("fill"),
            Type.Literal("inside"),
            Type.Literal("outside")
          ])),
          focal: Type.Optional(Type.String({ pattern: "^([0-9]*\\.?[0-9]+),([0-9]*\\.?[0-9]+)$" })),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const options = request.query as MediaTransformOptions;

      try {
        const { stream, mime, size } = await processingService.processImage(id, options);

        reply.header("Content-Type", mime);
        reply.header("Content-Length", size);
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
        
        return reply.send(stream);
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message.startsWith("Media not found")) {
          return reply.status(404).send({ error: "Media not found" });
        }
        return reply.status(500).send({ error: error.message });
      }
    }
  );
};
