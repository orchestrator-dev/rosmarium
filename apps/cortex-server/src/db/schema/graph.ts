import {
    pgTable,
    text,
    real,
    integer,
    jsonb,
    timestamp,
    index,
    uniqueIndex,
    pgEnum,
    vector,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { contentEntries } from "./content-entries.js";
import { users } from "./users.js";

// ─── Enum ─────────────────────────────────────────────────────────────────────

export const edgeSourceEnum = pgEnum("edge_source", [
    "manual",
    "auto_ner",
    "auto_similarity",
    "auto_reference",
    "api",
]);

// ─── graph_edges ──────────────────────────────────────────────────────────────

export const graphEdges = pgTable(
    "graph_edges",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => createId()),

        // Source node
        fromEntryId: text("from_entry_id")
            .notNull()
            .references(() => contentEntries.id, { onDelete: "cascade" }),
        fromContentType: text("from_content_type").notNull(),

        // Target node
        toEntryId: text("to_entry_id")
            .notNull()
            .references(() => contentEntries.id, { onDelete: "cascade" }),
        toContentType: text("to_content_type").notNull(),

        // Edge metadata
        edgeType: text("edge_type").notNull(),
        weight: real("weight").notNull().default(1.0),
        properties: jsonb("properties").notNull().default({}),
        source: edgeSourceEnum("source").notNull().default("manual"),
        isAccepted: text("is_accepted", {
            enum: ["pending", "accepted", "rejected"],
        })
            .notNull()
            .default("accepted"),
        createdBy: text("created_by").references(() => users.id, {
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
        fromIdx: index("graph_edges_from_idx").on(
            table.fromEntryId,
            table.edgeType,
        ),
        toIdx: index("graph_edges_to_idx").on(table.toEntryId, table.edgeType),
        typeIdx: index("graph_edges_type_idx").on(table.edgeType, table.weight),
        sourceIdx: index("graph_edges_source_idx").on(table.source),
        statusIdx: index("graph_edges_status_idx").on(table.isAccepted),
        uniqueEdge: uniqueIndex("graph_edges_unique_idx").on(
            table.fromEntryId,
            table.toEntryId,
            table.edgeType,
        ),
    }),
);

export type GraphEdge = typeof graphEdges.$inferSelect;
export type NewGraphEdge = typeof graphEdges.$inferInsert;

// ─── graph_entity_nodes ───────────────────────────────────────────────────────

export const graphEntityNodes = pgTable(
    "graph_entity_nodes",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => createId()),
        entityText: text("entity_text").notNull(),
        canonicalText: text("canonical_text").notNull(),
        entityType: text("entity_type").notNull(),
        embedding: vector("embedding", { dimensions: 768 }),
        mentionCount: integer("mention_count").notNull().default(1),
        metadata: jsonb("metadata").notNull().default({}),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
    },
    (table) => ({
        canonicalIdx: uniqueIndex("entity_nodes_canonical_idx").on(
            table.canonicalText,
            table.entityType,
        ),
        typeIdx: index("entity_nodes_type_idx").on(table.entityType),
        mentionIdx: index("entity_nodes_mention_idx").on(table.mentionCount),
    }),
);

export type GraphEntityNode = typeof graphEntityNodes.$inferSelect;
export type NewGraphEntityNode = typeof graphEntityNodes.$inferInsert;

// ─── entry_entity_mentions ────────────────────────────────────────────────────

export const entryEntityMentions = pgTable(
    "entry_entity_mentions",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => createId()),
        entryId: text("entry_id")
            .notNull()
            .references(() => contentEntries.id, { onDelete: "cascade" }),
        entityId: text("entity_id")
            .notNull()
            .references(() => graphEntityNodes.id, { onDelete: "cascade" }),
        confidence: real("confidence").notNull().default(1.0),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => ({
        entryIdx: index("mentions_entry_idx").on(table.entryId),
        entityIdx: index("mentions_entity_idx").on(table.entityId),
        uniqueMention: uniqueIndex("mentions_unique_idx").on(
            table.entryId,
            table.entityId,
        ),
    }),
);

export type EntryEntityMention = typeof entryEntityMentions.$inferSelect;
