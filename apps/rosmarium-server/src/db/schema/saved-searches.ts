import { pgTable, text, jsonb, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

export const savedSearches = pgTable(
    "saved_searches",
    {
        id: text("id").primaryKey().$defaultFn(() => createId()),
        userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
        query: text("query"),
        filters: jsonb("filters").notNull().default({}),
        notifyOnNew: boolean("notify_on_new").notNull().default(false),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => ({
        userIdx: index("saved_searches_user_idx").on(table.userId),
    })
);

export type SavedSearchRecord = typeof savedSearches.$inferSelect;
export type NewSavedSearchRecord = typeof savedSearches.$inferInsert;
