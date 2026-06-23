import { pgTable, text, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const remoteSources = pgTable("remote_sources", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: varchar("name", { length: 255 }).notNull().unique(),
    type: varchar("type", { length: 20 }).notNull(), // 'graphql', 'rest', 'openapi'
    endpoint: text("endpoint").notNull(),
    authConfig: jsonb("auth_config").notNull().default({}),
    cacheConfig: jsonb("cache_config").notNull().default({ ttl: 300 }),
    rateLimitConfig: jsonb("rate_limit_config").notNull().default({ maxRequestsPerMinute: 60 }),
    fieldMappings: jsonb("field_mappings").default([]),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    healthCheckUrl: text("health_check_url"),
    lastHealthCheck: timestamp("last_health_check", { withTimezone: true }),
    lastHealthStatus: varchar("last_health_status", { length: 20 }),
    introspectedSchema: jsonb("introspected_schema"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type RemoteSourceModel = typeof remoteSources.$inferSelect;
export type NewRemoteSourceModel = typeof remoteSources.$inferInsert;
