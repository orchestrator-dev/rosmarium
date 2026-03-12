import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

export const auditLog = pgTable(
    "audit_log",
    {
        id: text("id").primaryKey().$defaultFn(() => createId()),
        userId: text("user_id").references(() => users.id, {
            onDelete: "set null",
        }),
        action: text("action").notNull(),
        resourceId: text("resource_id"),
        resourceType: text("resource_type"),
        metadata: jsonb("metadata").default({}),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => ({
        userIdx: index("audit_log_user_idx").on(table.userId),
        actionIdx: index("audit_log_action_idx").on(table.action),
        createdIdx: index("audit_log_created_idx").on(table.createdAt),
    })
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
