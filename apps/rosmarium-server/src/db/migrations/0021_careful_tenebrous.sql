CREATE TABLE "remote_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"endpoint" text NOT NULL,
	"auth_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cache_config" jsonb DEFAULT '{"ttl":300}'::jsonb NOT NULL,
	"rate_limit_config" jsonb DEFAULT '{"maxRequestsPerMinute":60}'::jsonb NOT NULL,
	"field_mappings" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"health_check_url" text,
	"last_health_check" timestamp with time zone,
	"last_health_status" varchar(20),
	"introspected_schema" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remote_sources_name_unique" UNIQUE("name")
);
