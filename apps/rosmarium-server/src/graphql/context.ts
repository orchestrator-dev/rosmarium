/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */

import type { ContentEntry } from "../db/schema/index.js";
import { createDataloaders } from "./dataloaders/index.js";
import { lucia } from "../modules/auth/lucia.js";
import { authService } from "../modules/auth/auth.service.js";
import { apiKeyService } from "../modules/auth/api-key.service.js";
import type { AuthenticatedUser } from "../modules/auth/auth.service.js";

import { pubsub } from "./pubsub.js";
export { pubsub };

export type GraphQLContext = {
    user: AuthenticatedUser | null;
    dataloaders: ReturnType<typeof createDataloaders>;
    pubsub: typeof pubsub;
    requestId: string;
};

export async function createContext(request: Request): Promise<GraphQLContext> {
    let user: AuthenticatedUser | null = null;

    // Attempt 1: Session cookie
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
        const sessionId = lucia.readSessionCookie(cookieHeader);
        if (sessionId) {
            const result = await authService.validateSession(sessionId);
            if (result.user) {
                user = result.user;
            }
        }
    }

    // Attempt 2: Bearer API key (if no session found)
    if (!user) {
        const authHeader = request.headers.get("authorization") ?? "";
        if (authHeader.startsWith("Bearer ")) {
            const rawKey = authHeader.slice(7).trim();
            const result = await apiKeyService.validate(rawKey);
            if (result.valid && result.user) {
                user = result.user;
            }
        }
    }

    return {
        user,
        dataloaders: createDataloaders(),
        pubsub,
        requestId: crypto.randomUUID(),
    };
}

