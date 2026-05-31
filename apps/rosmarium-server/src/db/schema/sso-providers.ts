import { pgTable, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { tenants } from "./tenants";

export const ssoProviders = pgTable("sso_providers", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["oauth2", "oidc", "saml"] }).notNull(),
    providerId: text("provider_id").notNull(), // e.g. 'google', 'okta', 'azure'
    isActive: boolean("is_active").notNull().default(true),
    config: jsonb("config").notNull(), // OAuth/SAML settings
    roleMapping: jsonb("role_mapping"), // mapping from provider groups/roles to local roles
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export type SSOProvider = typeof ssoProviders.$inferSelect;
export type NewSSOProvider = typeof ssoProviders.$inferInsert;
