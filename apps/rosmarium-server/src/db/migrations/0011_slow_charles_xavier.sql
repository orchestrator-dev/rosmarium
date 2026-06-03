CREATE TABLE "workflow_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"assigned_to" text,
	"assigned_by" text,
	"state" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_history" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"from_state" text,
	"to_state" text NOT NULL,
	"transition_label" text,
	"comment" text,
	"performed_by" text,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"tenant_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_entry_id_content_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_assignments" ADD CONSTRAINT "workflow_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_entry_id_content_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "content_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;