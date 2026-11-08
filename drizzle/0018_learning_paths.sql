CREATE TYPE "public"."learning_path_status" AS ENUM('candidate', 'active', 'done', 'dropped');--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path_id" uuid NOT NULL,
	"title" text NOT NULL,
	"link" text DEFAULT '' NOT NULL,
	"week_of" date,
	"done_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "explorations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"started_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"verdict" text,
	"ended_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explorations_verdict" CHECK ("explorations"."verdict" is null or "explorations"."verdict" in ('path', 'drop')),
	CONSTRAINT "explorations_ended" CHECK (("explorations"."verdict" is null) = ("explorations"."ended_on" is null))
);
--> statement-breakpoint
CREATE TABLE "learning_path_campaigns" (
	"path_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	CONSTRAINT "learning_path_campaigns_path_id_campaign_id_unique" UNIQUE("path_id","campaign_id")
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"why_now" text DEFAULT '' NOT NULL,
	"games" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "learning_path_status" DEFAULT 'candidate' NOT NULL,
	"block_type_id" uuid,
	"link" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_campaigns" ADD CONSTRAINT "learning_path_campaigns_path_id_learning_paths_id_fk" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_campaigns" ADD CONSTRAINT "learning_path_campaigns_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_block_type_id_block_types_id_fk" FOREIGN KEY ("block_type_id") REFERENCES "public"."block_types"("id") ON DELETE set null ON UPDATE no action;