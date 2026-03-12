import { z } from 'zod';

export const ConfigSchema = z.object({
  PORT: z.coerce.number().optional().default(3000),
});
