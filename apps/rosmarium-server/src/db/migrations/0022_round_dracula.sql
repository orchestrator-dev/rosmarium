CREATE TABLE "components" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(255) NOT NULL,
	"description" text,
	"thumbnail" text,
	"props" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb,
	"framework" varchar(50) NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"component_id" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"locale" varchar(50) DEFAULT 'en' NOT NULL,
	"template" varchar(255),
	"seo" jsonb DEFAULT '{}'::jsonb,
	"personalization" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;