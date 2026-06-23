CREATE TABLE "content_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"base_entry_id" text NOT NULL,
	"segment_id" text NOT NULL,
	"overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{"impressions":0,"clicks":0,"conversions":0}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"logic" varchar(10) DEFAULT 'and' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_variants" ADD CONSTRAINT "content_variants_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;