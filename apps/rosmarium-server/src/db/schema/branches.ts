/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { pgTable, text, timestamp, jsonb, index, AnyPgColumn } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { contentEntries } from "./content-entries";

export const contentBranches = pgTable(
    "content_branches",
    {
        id: text("id").primaryKey().$defaultFn(() => createId()),
        name: text("name").notNull(), // e.g., "summer-campaign"
        baseBranchId: text("base_branch_id").references((): AnyPgColumn => contentBranches.id, {
            onDelete: "set null"
        }), // null = main branch
        status: text("status", { enum: ["active", "merged", "abandoned"] })
            .notNull()
            .default("active"),
        createdBy: text("created_by")
            .references(() => users.id, { onDelete: "set null" }),
        mergedBy: text("merged_by")
            .references(() => users.id, { onDelete: "set null" }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
        mergedAt: timestamp("merged_at", { withTimezone: true }),
    },
    (table) => ({
        statusIdx: index("content_branches_status_idx").on(table.status),
        baseBranchIdx: index("content_branches_base_idx").on(table.baseBranchId)
    })
);

export const branchEntries = pgTable(
    "branch_entries",
    {
        id: text("id").primaryKey().$defaultFn(() => createId()),
        branchId: text("branch_id")
            .notNull()
            .references(() => contentBranches.id, { onDelete: "cascade" }),
        entryId: text("entry_id").notNull(), // Doesn't have to be a hard FK because an entry might be created in the branch and not exist in main yet, or we can use a string reference.
        action: text("action", { enum: ["create", "update", "delete"] })
            .notNull(),
        data: jsonb("data").notNull().default({}),
        originalData: jsonb("original_data"), // To detect 3-way merge conflicts against main
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => ({
        branchIdIdx: index("branch_entries_branch_id_idx").on(table.branchId),
        entryIdIdx: index("branch_entries_entry_id_idx").on(table.entryId),
    })
);

export type ContentBranch = typeof contentBranches.$inferSelect;
export type NewContentBranch = typeof contentBranches.$inferInsert;
export type BranchEntry = typeof branchEntries.$inferSelect;
export type NewBranchEntry = typeof branchEntries.$inferInsert;
