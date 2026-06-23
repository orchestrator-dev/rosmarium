import { pgTable, text, timestamp, varchar, jsonb, integer } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const segments = pgTable("segments", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    conditions: jsonb("conditions").notNull().default([]),
    logic: varchar("logic", { length: 10 }).notNull().default("and"),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentVariants = pgTable("content_variants", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    baseEntryId: text("base_entry_id").notNull(),
    segmentId: text("segment_id").notNull().references(() => segments.id, { onDelete: "cascade" }),
    overrides: jsonb("overrides").notNull().default({}),
    metrics: jsonb("metrics").notNull().default({ impressions: 0, clicks: 0, conversions: 0 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
