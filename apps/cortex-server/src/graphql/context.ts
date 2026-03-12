import { createPubSub } from "graphql-yoga";
import type { ContentEntry } from "../db/schema/index.js";
import { createDataloaders } from "./dataloaders/index.js";

export type AuthenticatedUser = {
    id: string;
    role: "super_admin" | "admin" | "editor" | "author" | "viewer";
};

// In-process PubSub — upgraded to Redis pub/sub in Phase 4
export const pubsub = createPubSub<{
    [key: `entry.created.${string}`]: [ContentEntry];
    [key: `entry.updated.${string}`]: [ContentEntry];
    [key: `entry.deleted.${string}`]: [{ id: string; contentType: string }];
}>();

export type GraphQLContext = {
    user: AuthenticatedUser | null;
    dataloaders: ReturnType<typeof createDataloaders>;
    pubsub: typeof pubsub;
    requestId: string;
};

export async function createContext(request: Request): Promise<GraphQLContext> {
    // Stub auth — Phase 2 (auth milestone) will complete API key + session resolution
    const authHeader = request.headers.get("authorization") ?? "";
    const _token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    return {
        user: null, // will be resolved from session/API key in auth phase
        dataloaders: createDataloaders(),
        pubsub,
        requestId: crypto.randomUUID(),
    };
}
