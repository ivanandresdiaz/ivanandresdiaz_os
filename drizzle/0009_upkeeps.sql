CREATE TABLE "upkeeps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"interval_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upkeep_interval" CHECK ("upkeeps"."interval_days" > 0)
);
--> statement-breakpoint
ALTER TABLE "secondary_tasks" ADD COLUMN "upkeep_id" uuid;--> statement-breakpoint
ALTER TABLE "secondary_tasks" ADD CONSTRAINT "secondary_tasks_upkeep_id_upkeeps_id_fk" FOREIGN KEY ("upkeep_id") REFERENCES "public"."upkeeps"("id") ON DELETE set null ON UPDATE no action;