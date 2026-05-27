import { pgTable, text, jsonb, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const tenants = pgTable("tenants", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    slug: text("slug").notNull().unique(), // URL-safe identifier: 'acme-corp'
    name: text("name").notNull(),
    plan: text("plan", { enum: ["free", "starter", "pro", "enterprise"] }).notNull().default("free"),
    storageBucket: text("storage_bucket"), // Optional per-tenant S3 bucket override
    settings: jsonb("settings").notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
    slugIdx: uniqueIndex("tenants_slug_idx").on(table.slug),
    activeIdx: index("tenants_active_idx").on(table.isActive),
}));
