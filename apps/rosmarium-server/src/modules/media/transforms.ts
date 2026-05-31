import { z } from "zod";

export const mediaTransformSchema = z.object({
  w: z.coerce.number().int().min(1).max(4000).optional(),
  h: z.coerce.number().int().min(1).max(4000).optional(),
  format: z.enum(["webp", "avif", "jpeg", "png", "auto"]).optional(),
  quality: z.coerce.number().int().min(1).max(100).optional().default(80),
  fit: z.enum(["cover", "contain", "fill", "inside", "outside"]).optional().default("cover"),
  focal: z.string().regex(/^([0-9]*\.?[0-9]+),([0-9]*\.?[0-9]+)$/).optional().describe("Focal point x,y between 0 and 1 (e.g., 0.5,0.3)"),
});

export type MediaTransformOptions = z.infer<typeof mediaTransformSchema>;
