CREATE TABLE "branch_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL,
	"entry_id" text NOT NULL,
	"action" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"original_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_branches" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_branch_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text,
	"merged_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"merged_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "branch_entries" ADD CONSTRAINT "branch_entries_branch_id_content_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "content_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_branches" ADD CONSTRAINT "content_branches_base_branch_id_content_branches_id_fk" FOREIGN KEY ("base_branch_id") REFERENCES "content_branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_branches" ADD CONSTRAINT "content_branches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_branches" ADD CONSTRAINT "content_branches_merged_by_users_id_fk" FOREIGN KEY ("merged_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branch_entries_branch_id_idx" ON "branch_entries" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "branch_entries_entry_id_idx" ON "branch_entries" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "content_branches_status_idx" ON "content_branches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_branches_base_idx" ON "content_branches" USING btree ("base_branch_id");