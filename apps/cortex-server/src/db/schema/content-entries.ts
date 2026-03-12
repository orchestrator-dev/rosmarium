import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { contentTypes } from "./content-types";

export const contentEntries = pgTable(
    "content_entries",
    {
        id: text("id").primaryKey().$defaultFn(() => createId()),
        contentTypeId: text("content_type_id")
            .notNull()
            .references(() => contentTypes.id, { onDelete: "cascade" }),
        locale: text("locale").notNull().default("en"),
        status: text("status", {
            enum: ["draft", "published", "archived"],
        })
            .notNull()
            .default("draft"),
        data: jsonb("data").notNull().default({}),
        publishedAt: timestamp("published_at", { withTimezone: true }),
        createdBy: text("created_by").references(() => users.id, {
            onDelete: "set null",
        }),
        updatedBy: text("updated_by").references(() => users.id, {
            onDelete: "set null",
        }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => ({
        contentTypeIdx: index("content_entries_type_idx").on(table.contentTypeId),
        statusIdx: index("content_entries_status_idx").on(table.status),
        localeIdx: index("content_entries_locale_idx").on(table.locale),
        createdAtIdx: index("content_entries_created_at_idx").on(table.createdAt),
    })
);

export type ContentEntry = typeof contentEntries.$inferSelect;
export type NewContentEntry = typeof contentEntries.$inferInsert;
