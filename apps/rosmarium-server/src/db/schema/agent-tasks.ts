import { pgTable, text, timestamp, varchar, jsonb, boolean } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const agentTasks = pgTable("agent_tasks", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    type: varchar("type", { length: 50 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    goal: text("goal").notNull(),
    plan: jsonb("plan").default([]),
    results: jsonb("results").default([]),
    requiresHumanReview: boolean("requires_human_review").notNull().default(false),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    tenantId: varchar("tenant_id", { length: 255 }).notNull().default("default"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentSteps = pgTable("agent_steps", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    taskId: text("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 255 }).notNull(),
    args: jsonb("args").notNull().default({}),
    dependsOn: jsonb("depends_on").default([]),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    result: jsonb("result"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
