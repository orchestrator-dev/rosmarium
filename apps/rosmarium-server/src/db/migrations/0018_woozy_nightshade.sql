CREATE TABLE "sso_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"provider_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"config" jsonb NOT NULL,
	"role_mapping" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sso_providers" ADD CONSTRAINT "sso_providers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;