import { pgTable, text, timestamp, varchar, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const components = pgTable("components", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 255 }).notNull(),
    description: text("description"),
    thumbnail: text("thumbnail"),
    props: jsonb("props").notNull().default([]),
    defaultProps: jsonb("default_props").notNull().default({}),
    variants: jsonb("variants").default([]),
    framework: varchar("framework", { length: 50 }).notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pages = pgTable("pages", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    locale: varchar("locale", { length: 50 }).notNull().default("en"),
    template: varchar("template", { length: 255 }),
    seo: jsonb("seo").default({}),
    personalization: jsonb("personalization").default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pageSections = pgTable("page_sections", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    pageId: text("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
    componentId: text("component_id").notNull().references(() => components.id),
    props: jsonb("props").notNull().default({}),
    conditions: jsonb("conditions").default([]),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
