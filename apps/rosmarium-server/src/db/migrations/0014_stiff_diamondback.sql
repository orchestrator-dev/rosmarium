CREATE TABLE "content_comments" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"entry_id" varchar(128) NOT NULL,
	"field_id" varchar(128),
	"content" text NOT NULL,
	"author_id" varchar(128) NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"parent_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_entry_id_content_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."content_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_comments" ADD CONSTRAINT "content_comments_parent_id_content_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_comments"("id") ON DELETE cascade ON UPDATE no action;