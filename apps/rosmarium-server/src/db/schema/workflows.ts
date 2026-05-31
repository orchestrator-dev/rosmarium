import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";
import { contentEntries } from "./content-entries";
import type { WorkflowDefinition } from "@orchestrator.dev/types";
import { createId } from "@paralleldrive/cuid2";

export const workflows = pgTable("workflows", {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    name: text("name").notNull(),
    definition: jsonb("definition").$type<WorkflowDefinition>().notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workflowHistory = pgTable("workflow_history", {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    entryId: text("entry_id").references(() => contentEntries.id, { onDelete: "cascade" }).notNull(),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    transitionLabel: text("transition_label"),
    comment: text("comment"),
    performedBy: text("performed_by").references(() => users.id),
    performedAt: timestamp("performed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workflowAssignments = pgTable("workflow_assignments", {
    id: text("id").$defaultFn(() => createId()).primaryKey(),
    entryId: text("entry_id").references(() => contentEntries.id, { onDelete: "cascade" }).notNull(),
    assignedTo: text("assigned_to").references(() => users.id),
    assignedBy: text("assigned_by").references(() => users.id),
    state: text("state").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
