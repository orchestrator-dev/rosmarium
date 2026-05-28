-- Migration 0007 — Graph Data Model
-- Adds: edge_source enum, graph_edges, graph_entity_nodes, entry_entity_mentions

--> statement-breakpoint
CREATE TYPE "edge_source" AS ENUM ('manual', 'auto_ner', 'auto_similarity', 'auto_reference', 'api');

--> statement-breakpoint
CREATE TABLE "graph_edges" (
    "id"                text PRIMARY KEY NOT NULL,
    "from_entry_id"     text NOT NULL,
    "from_content_type" text NOT NULL,
    "to_entry_id"       text NOT NULL,
    "to_content_type"   text NOT NULL,
    "edge_type"         text NOT NULL,
    "weight"            real NOT NULL DEFAULT 1.0,
    "properties"        jsonb NOT NULL DEFAULT '{}',
    "source"            "edge_source" NOT NULL DEFAULT 'manual',
    "is_accepted"       text NOT NULL DEFAULT 'accepted',
    "created_by"        text,
    "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at"        timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE "graph_entity_nodes" (
    "id"             text PRIMARY KEY NOT NULL,
    "entity_text"    text NOT NULL,
    "canonical_text" text NOT NULL,
    "entity_type"    text NOT NULL,
    "embedding"      vector(768),
    "mention_count"  integer NOT NULL DEFAULT 1,
    "metadata"       jsonb NOT NULL DEFAULT '{}',
    "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at"     timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE "entry_entity_mentions" (
    "id"         text PRIMARY KEY NOT NULL,
    "entry_id"   text NOT NULL,
    "entity_id"  text NOT NULL,
    "confidence" real NOT NULL DEFAULT 1.0,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
ALTER TABLE "graph_edges"
    ADD CONSTRAINT "graph_edges_from_entry_id_content_entries_id_fk"
    FOREIGN KEY ("from_entry_id") REFERENCES "content_entries"("id") ON DELETE cascade;

--> statement-breakpoint
ALTER TABLE "graph_edges"
    ADD CONSTRAINT "graph_edges_to_entry_id_content_entries_id_fk"
    FOREIGN KEY ("to_entry_id") REFERENCES "content_entries"("id") ON DELETE cascade;

--> statement-breakpoint
ALTER TABLE "graph_edges"
    ADD CONSTRAINT "graph_edges_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;

--> statement-breakpoint
ALTER TABLE "entry_entity_mentions"
    ADD CONSTRAINT "entry_entity_mentions_entry_id_content_entries_id_fk"
    FOREIGN KEY ("entry_id") REFERENCES "content_entries"("id") ON DELETE cascade;

--> statement-breakpoint
ALTER TABLE "entry_entity_mentions"
    ADD CONSTRAINT "entry_entity_mentions_entity_id_graph_entity_nodes_id_fk"
    FOREIGN KEY ("entity_id") REFERENCES "graph_entity_nodes"("id") ON DELETE cascade;

--> statement-breakpoint
CREATE INDEX "graph_edges_from_idx" ON "graph_edges" ("from_entry_id", "edge_type");

--> statement-breakpoint
CREATE INDEX "graph_edges_to_idx" ON "graph_edges" ("to_entry_id", "edge_type");

--> statement-breakpoint
CREATE INDEX "graph_edges_type_idx" ON "graph_edges" ("edge_type", "weight");

--> statement-breakpoint
CREATE INDEX "graph_edges_source_idx" ON "graph_edges" ("source");

--> statement-breakpoint
CREATE INDEX "graph_edges_status_idx" ON "graph_edges" ("is_accepted");

--> statement-breakpoint
CREATE UNIQUE INDEX "graph_edges_unique_idx" ON "graph_edges" ("from_entry_id", "to_entry_id", "edge_type");

--> statement-breakpoint
CREATE UNIQUE INDEX "entity_nodes_canonical_idx" ON "graph_entity_nodes" ("canonical_text", "entity_type");

--> statement-breakpoint
CREATE INDEX "entity_nodes_type_idx" ON "graph_entity_nodes" ("entity_type");

--> statement-breakpoint
CREATE INDEX "entity_nodes_mention_idx" ON "graph_entity_nodes" ("mention_count");

--> statement-breakpoint
CREATE INDEX "entity_nodes_embedding_hnsw_idx"
    ON "graph_entity_nodes"
    USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

--> statement-breakpoint
CREATE INDEX "mentions_entry_idx" ON "entry_entity_mentions" ("entry_id");

--> statement-breakpoint
CREATE INDEX "mentions_entity_idx" ON "entry_entity_mentions" ("entity_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "mentions_unique_idx" ON "entry_entity_mentions" ("entry_id", "entity_id");
