import { builder } from "../builder.js";

builder.objectType("RemoteSource", {
    description: "A registered remote data source for GraphQL schema stitching and content federation",
    fields: (t) => ({
        id: t.exposeString("id"),
        name: t.exposeString("name"),
        type: t.exposeString("type"),
        endpoint: t.exposeString("endpoint"),
        authConfig: t.expose("authConfig", { type: "JSON" }),
        cacheConfig: t.expose("cacheConfig", { type: "JSON" }),
        rateLimitConfig: t.expose("rateLimitConfig", { type: "JSON" }),
        fieldMappings: t.expose("fieldMappings", { type: "JSON", nullable: true }),
        status: t.exposeString("status"),
        healthCheckUrl: t.expose("healthCheckUrl", { type: "String", nullable: true }),
        lastHealthCheck: t.expose("lastHealthCheck", { type: "DateTime", nullable: true }),
        lastHealthStatus: t.expose("lastHealthStatus", { type: "String", nullable: true }),
        introspectedSchema: t.expose("introspectedSchema", { type: "JSON", nullable: true }),
        createdAt: t.expose("createdAt", { type: "DateTime" }),
        updatedAt: t.expose("updatedAt", { type: "DateTime" }),
    }),
});

builder.objectType("RemoteSourceHealthResult", {
    description: "Result of a remote data source connection health check",
    fields: (t) => ({
        healthy: t.exposeBoolean("healthy"),
        status: t.exposeString("status"),
        message: t.expose("message", { type: "String", nullable: true }),
    }),
});
