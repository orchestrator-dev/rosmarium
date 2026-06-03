import { pgTable, text, timestamp, jsonb, index, real } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { contentEntries } from "./content-entries";

export const contentSets = pgTable(
    "content_sets",
    {
        id: text("id").primaryKey().$defaultFn(() => createId()),
        name: text("name").notNull(),
        description: text("description"),
        sourceUrl: text("source_url"),
        jobId: text("job_id").notNull().unique(),
        status: text("status", {
            enum: [
                "queued",
                "crawling",
                "classifying",
                "importing",
                "complete",
                "failed",
                "cancelled",
            ],
        })
            .notNull()
            .default("queued"),
        config: jsonb("config").notNull().default({}),
        stats: jsonb("stats").notNull().default({}),
        tenantId: text("tenant_id"),
        createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        completedAt: timestamp("completed_at", { withTimezone: true }),
    },
    (table) => ({
        jobIdx: index("content_sets_job_idx").on(table.jobId),
        statusIdx: index("content_sets_status_idx").on(table.status),
        createdAtIdx: index("content_sets_created_at_idx").on(table.createdAt),
    })
);

export const contentSetItems = pgTable(
    "content_set_items",
    {
        id: text("id").primaryKey().$defaultFn(() => createId()),
        contentSetId: text("content_set_id")
            .notNull()
            .references(() => contentSets.id, { onDelete: "cascade" }),
        entryId: text("entry_id").references(() => contentEntries.id, { onDelete: "set null" }),
        sourceUrl: text("source_url").notNull(),
        contentType: text("content_type").notNull(),
        classificationConfidence: real("classification_confidence"),
        status: text("status", {
            enum: ["imported", "skipped", "failed"],
        })
            .notNull()
            .default("imported"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => ({
        setIdx: index("csi_set_idx").on(table.contentSetId),
        entryIdx: index("csi_entry_idx").on(table.entryId),
    })
);

export type ContentSet = typeof contentSets.$inferSelect;
export type NewContentSet = typeof contentSets.$inferInsert;
export type ContentSetItem = typeof contentSetItems.$inferSelect;
export type NewContentSetItem = typeof contentSetItems.$inferInsert;
