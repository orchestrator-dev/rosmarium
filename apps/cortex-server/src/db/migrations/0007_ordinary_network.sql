CREATE TYPE "public"."edge_source" AS ENUM('manual', 'auto_ner', 'auto_similarity', 'auto_reference', 'api');--> statement-breakpoint
CREATE TABLE "entry_entity_mentions" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_edges" (
	"id" text PRIMARY KEY NOT NULL,
	"from_entry_id" text NOT NULL,
	"from_content_type" text NOT NULL,
	"to_entry_id" text NOT NULL,
	"to_content_type" text NOT NULL,
	"edge_type" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" "edge_source" DEFAULT 'manual' NOT NULL,
	"is_accepted" text DEFAULT 'accepted' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_entity_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_text" text NOT NULL,
	"canonical_text" text NOT NULL,
	"entity_type" text NOT NULL,
	"embedding" vector(768),
	"mention_count" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entry_entity_mentions" ADD CONSTRAINT "entry_entity_mentions_entry_id_content_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."content_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_entity_mentions" ADD CONSTRAINT "entry_entity_mentions_entity_id_graph_entity_nodes_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."graph_entity_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_from_entry_id_content_entries_id_fk" FOREIGN KEY ("from_entry_id") REFERENCES "public"."content_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_to_entry_id_content_entries_id_fk" FOREIGN KEY ("to_entry_id") REFERENCES "public"."content_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mentions_entry_idx" ON "entry_entity_mentions" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "mentions_entity_idx" ON "entry_entity_mentions" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mentions_unique_idx" ON "entry_entity_mentions" USING btree ("entry_id","entity_id");--> statement-breakpoint
CREATE INDEX "graph_edges_from_idx" ON "graph_edges" USING btree ("from_entry_id","edge_type");--> statement-breakpoint
CREATE INDEX "graph_edges_to_idx" ON "graph_edges" USING btree ("to_entry_id","edge_type");--> statement-breakpoint
CREATE INDEX "graph_edges_type_idx" ON "graph_edges" USING btree ("edge_type","weight");--> statement-breakpoint
CREATE INDEX "graph_edges_weight_idx" ON "graph_edges" USING btree ("weight");--> statement-breakpoint
CREATE INDEX "graph_edges_source_idx" ON "graph_edges" USING btree ("source");--> statement-breakpoint
CREATE INDEX "graph_edges_status_idx" ON "graph_edges" USING btree ("is_accepted");--> statement-breakpoint
CREATE UNIQUE INDEX "graph_edges_unique_idx" ON "graph_edges" USING btree ("from_entry_id","to_entry_id","edge_type");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_nodes_canonical_idx" ON "graph_entity_nodes" USING btree ("canonical_text","entity_type");--> statement-breakpoint
CREATE INDEX "entity_nodes_type_idx" ON "graph_entity_nodes" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "entity_nodes_mention_idx" ON "graph_entity_nodes" USING btree ("mention_count");