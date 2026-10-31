ALTER TYPE "public"."work_kind" ADD VALUE IF NOT EXISTS 'secondary';--> statement-breakpoint
CREATE TABLE "secondary_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_on" date NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN "secondary_task_id" uuid;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_secondary_task_id_secondary_tasks_id_fk" FOREIGN KEY ("secondary_task_id") REFERENCES "public"."secondary_tasks"("id") ON DELETE cascade ON UPDATE no action;