import { pgTable, text, boolean, jsonb } from "drizzle-orm/pg-core";

export const locales = pgTable("locales", {
    code: text("code").primaryKey(), // e.g., 'en', 'fr-CA'
    name: text("name").notNull(),
    direction: text("direction", { enum: ["ltr", "rtl"] }).notNull().default("ltr"),
    isDefault: boolean("is_default").notNull().default(false),
    fallbackChain: jsonb("fallback_chain").notNull().default([]).$type<string[]>(),
});

export type Locale = typeof locales.$inferSelect;
export type NewLocale = typeof locales.$inferInsert;
