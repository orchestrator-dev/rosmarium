CREATE TABLE "agent_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"action" varchar(255) NOT NULL,
	"args" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"depends_on" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"goal" text NOT NULL,
	"plan" jsonb DEFAULT '[]'::jsonb,
	"results" jsonb DEFAULT '[]'::jsonb,
	"requires_human_review" boolean DEFAULT false NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"tenant_id" varchar(255) DEFAULT 'default' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE cascade ON UPDATE no action;