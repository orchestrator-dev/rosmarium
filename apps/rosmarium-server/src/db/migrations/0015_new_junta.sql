CREATE TABLE "locales" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"direction" text DEFAULT 'ltr' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"fallback_chain" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_entries" ADD COLUMN "localization_group_id" text;--> statement-breakpoint
CREATE INDEX "content_entries_loc_group_idx" ON "content_entries" USING btree ("localization_group_id");