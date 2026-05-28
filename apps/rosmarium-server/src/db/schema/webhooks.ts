import { pgTable, text, timestamp, boolean, jsonb, integer, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

export const webhooks = pgTable("webhooks", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: text("name").notNull(),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    events: text("events").array().notNull(),
    contentTypes: text("content_types").array().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const webhookDeliveries = pgTable(
    "webhook_deliveries",
    {
        id: text("id").primaryKey().$defaultFn(() => createId()),
        webhookId: text("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
        event: text("event").notNull(),
        payload: jsonb("payload").notNull(),
        responseCode: integer("response_code"),
        responseBody: text("response_body"),
        durationMs: integer("duration_ms"),
        success: boolean("success").notNull().default(false),
        attempt: integer("attempt").notNull().default(1),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => ({
        webhookIdx: index("webhook_deliveries_webhook_idx").on(table.webhookId),
        createdIdx: index("webhook_deliveries_created_idx").on(table.createdAt),
    }),
);

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
