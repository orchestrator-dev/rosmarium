import { pgTable, varchar, timestamp, text, boolean, AnyPgColumn } from "drizzle-orm/pg-core";
import { users } from "./users";
import { contentEntries } from "./content-entries";
import { createId } from "@paralleldrive/cuid2";

export const contentComments = pgTable("content_comments", {
    id: varchar("id", { length: 128 }).primaryKey().$defaultFn(() => createId()),
    entryId: varchar("entry_id", { length: 128 }).notNull().references(() => contentEntries.id, { onDelete: "cascade" }),
    fieldId: varchar("field_id", { length: 128 }), // Optional: if null, it's an entry-level comment
    content: text("content").notNull(),
    authorId: varchar("author_id", { length: 128 }).notNull().references(() => users.id),
    resolved: boolean("resolved").notNull().default(false),
    parentId: varchar("parent_id", { length: 128 }).references((): AnyPgColumn => contentComments.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContentComment = typeof contentComments.$inferSelect;
export type NewContentComment = typeof contentComments.$inferInsert;
