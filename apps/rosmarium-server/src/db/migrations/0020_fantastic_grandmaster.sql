CREATE TABLE "content_set_items" (
	"id" text PRIMARY KEY NOT NULL,
	"content_set_id" text NOT NULL,
	"entry_id" text,
	"source_url" text NOT NULL,
	"content_type" text NOT NULL,
	"classification_confidence" real,
	"status" text DEFAULT 'imported' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_url" text,
	"job_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tenant_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "content_sets_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
ALTER TABLE "content_set_items" ADD CONSTRAINT "content_set_items_content_set_id_content_sets_id_fk" FOREIGN KEY ("content_set_id") REFERENCES "public"."content_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_set_items" ADD CONSTRAINT "content_set_items_entry_id_content_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."content_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sets" ADD CONSTRAINT "content_sets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "csi_set_idx" ON "content_set_items" USING btree ("content_set_id");--> statement-breakpoint
CREATE INDEX "csi_entry_idx" ON "content_set_items" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "content_sets_job_idx" ON "content_sets" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "content_sets_status_idx" ON "content_sets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_sets_created_at_idx" ON "content_sets" USING btree ("created_at");