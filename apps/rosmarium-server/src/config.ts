import { z } from "zod";

const schema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    STORAGE_PROVIDER: z.string().min(1),
    STORAGE_ENDPOINT: z.string().url(),
    STORAGE_BUCKET: z.string().min(1),
    STORAGE_REGION: z.string().min(1),
    STORAGE_ACCESS_KEY: z.string().min(1),
    STORAGE_SECRET_KEY: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    ADMIN_EMAIL: z.string().email(),
    ADMIN_PASSWORD: z.string().min(8),
    AI_WORKER_URL: z.string().url(),
    AI_WORKER_SECRET: z.string().min(1),
    EMBEDDING_PROVIDER: z.string().min(1),
    EMBEDDING_MODEL: z.string().min(1),
    OLLAMA_BASE_URL: z.string().url(),
});

export const config = schema.parse(process.env);
