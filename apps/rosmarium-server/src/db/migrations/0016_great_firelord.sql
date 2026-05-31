CREATE TABLE "ai_operations_log" (
	"id" text PRIMARY KEY NOT NULL,
	"operation_type" text NOT NULL,
	"entry_id" text,
	"user_id" text,
	"tenant_id" text,
	"model_provider" text,
	"model_name" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"status" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_operations_log" ADD CONSTRAINT "ai_operations_log_entry_id_content_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."content_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_operations_log" ADD CONSTRAINT "ai_operations_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_operations_log" ADD CONSTRAINT "ai_operations_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_ops_type_idx" ON "ai_operations_log" USING btree ("operation_type");--> statement-breakpoint
CREATE INDEX "ai_ops_tenant_idx" ON "ai_operations_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ai_ops_user_idx" ON "ai_operations_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_ops_created_at_idx" ON "ai_operations_log" USING btree ("created_at");