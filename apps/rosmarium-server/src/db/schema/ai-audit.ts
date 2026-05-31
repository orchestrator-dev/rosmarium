import { pgTable, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { contentEntries } from "./content-entries";
import { users } from "./users";
import { tenants } from "./tenants";

export const aiOperationsLog = pgTable(
    "ai_operations_log",
    {
        id: text("id").primaryKey().$defaultFn(() => createId()),
        operationType: text("operation_type").notNull(), // generate, rewrite, translate, tag, summarize
        entryId: text("entry_id").references(() => contentEntries.id, { onDelete: "set null" }),
        userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
        tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
        modelProvider: text("model_provider"), // ollama, openai, anthropic
        modelName: text("model_name"),
        inputTokens: integer("input_tokens"),
        outputTokens: integer("output_tokens"),
        latencyMs: integer("latency_ms"),
        status: text("status", { enum: ["success", "error", "rejected"] }),
        metadata: jsonb("metadata").default({}),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => ({
        operationTypeIdx: index("ai_ops_type_idx").on(table.operationType),
        tenantIdx: index("ai_ops_tenant_idx").on(table.tenantId),
        userIdx: index("ai_ops_user_idx").on(table.userId),
        createdAtIdx: index("ai_ops_created_at_idx").on(table.createdAt),
    })
);

export type AIOperationLog = typeof aiOperationsLog.$inferSelect;
export type NewAIOperationLog = typeof aiOperationsLog.$inferInsert;
