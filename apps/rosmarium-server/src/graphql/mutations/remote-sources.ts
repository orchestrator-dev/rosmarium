import { GraphQLError } from "graphql";
import { builder } from "../builder.js";
import { sourceService } from "../../modules/federation/source.service.js";

function requireAuth(user: { id: string; role: string } | null): asserts user is { id: string; role: string } {
    if (!user) throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });
}

function requireRole(user: { role: string }, ...roles: string[]): void {
    if (!roles.includes(user.role)) {
        throw new GraphQLError(`Forbidden — requires one of: ${roles.join(", ")}`, { extensions: { code: "FORBIDDEN" } });
    }
}

builder.mutationField("registerRemoteSource", (t) =>
    t.fieldWithInput({
        type: "RemoteSource",
        description: "Register a new remote data source for federation (admin only)",
        input: {
            name: t.input.string({ required: true }),
            type: t.input.string({ required: true }), // 'graphql', 'rest', 'openapi'
            endpoint: t.input.string({ required: true }),
            authConfig: t.input.field({ type: "JSON" }),
            cacheConfig: t.input.field({ type: "JSON" }),
            rateLimitConfig: t.input.field({ type: "JSON" }),
            fieldMappings: t.input.field({ type: "JSON" }),
            status: t.input.string(),
            healthCheckUrl: t.input.string(),
        },
        resolve: async (_, { input }, ctx) => {
            requireAuth(ctx.user);
            requireRole(ctx.user, "admin", "super_admin");

            return sourceService.createSource({
                name: input.name,
                type: input.type,
                endpoint: input.endpoint,
                authConfig: (input.authConfig as Record<string, unknown>) ?? { type: "none" },
                cacheConfig: (input.cacheConfig as Record<string, unknown>) ?? { ttl: 300 },
                rateLimitConfig: (input.rateLimitConfig as Record<string, unknown>) ?? { maxRequestsPerMinute: 60 },
                fieldMappings: (input.fieldMappings as unknown[]) ?? [],
                status: input.status ?? "active",
                healthCheckUrl: input.healthCheckUrl ?? null,
            });
        },
    }),
);

builder.mutationField("updateRemoteSource", (t) =>
    t.fieldWithInput({
        type: "RemoteSource",
        description: "Update an existing remote data source (admin only)",
        input: {
            id: t.input.id({ required: true }),
            name: t.input.string(),
            type: t.input.string(),
            endpoint: t.input.string(),
            authConfig: t.input.field({ type: "JSON" }),
            cacheConfig: t.input.field({ type: "JSON" }),
            rateLimitConfig: t.input.field({ type: "JSON" }),
            fieldMappings: t.input.field({ type: "JSON" }),
            status: t.input.string(),
            healthCheckUrl: t.input.string(),
        },
        resolve: async (_, { input }, ctx) => {
            requireAuth(ctx.user);
            requireRole(ctx.user, "admin", "super_admin");

            const idStr = String(input.id);
            const existing = await sourceService.getSource(idStr);
            if (!existing) {
                throw new GraphQLError(`Remote source '${idStr}' not found`, { extensions: { code: "NOT_FOUND" } });
            }

            return sourceService.updateSource(idStr, {
                name: input.name ?? undefined,
                type: input.type ?? undefined,
                endpoint: input.endpoint ?? undefined,
                authConfig: input.authConfig ? (input.authConfig as Record<string, unknown>) : undefined,
                cacheConfig: input.cacheConfig ? (input.cacheConfig as Record<string, unknown>) : undefined,
                rateLimitConfig: input.rateLimitConfig ? (input.rateLimitConfig as Record<string, unknown>) : undefined,
                fieldMappings: input.fieldMappings ? (input.fieldMappings as unknown[]) : undefined,
                status: input.status ?? undefined,
                healthCheckUrl: input.healthCheckUrl ?? undefined,
            });
        },
    }),
);

builder.mutationField("deleteRemoteSource", (t) =>
    t.field({
        type: "Boolean",
        description: "Delete a remote data source (admin only)",
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: async (_, { id }, ctx) => {
            requireAuth(ctx.user);
            requireRole(ctx.user, "admin", "super_admin");

            const idStr = String(id);
            const existing = await sourceService.getSource(idStr);
            if (!existing) {
                throw new GraphQLError(`Remote source '${idStr}' not found`, { extensions: { code: "NOT_FOUND" } });
            }

            await sourceService.deleteSource(idStr);
            return true;
        },
    }),
);

builder.mutationField("checkRemoteSourceHealth", (t) =>
    t.field({
        type: "RemoteSourceHealthResult",
        description: "Trigger a connection health check against a remote data source (admin only)",
        args: {
            id: t.arg.id({ required: true }),
        },
        resolve: async (_, { id }, ctx) => {
            requireAuth(ctx.user);
            requireRole(ctx.user, "admin", "super_admin");

            return sourceService.checkHealth(String(id));
        },
    }),
);
