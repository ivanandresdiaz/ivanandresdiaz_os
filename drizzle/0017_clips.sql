CREATE TABLE "clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"title" text,
	"status" text NOT NULL,
	"run" uuid,
	"started_at" timestamp with time zone,
	"key" text,
	"content_type" text,
	"size_bytes" integer,
	"duration_s" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clips_url_unique" UNIQUE("url"),
	CONSTRAINT "clips_source" CHECK ("clips"."source" in ('instagram', 'youtube')),
	CONSTRAINT "clips_status" CHECK ("clips"."status" in ('link', 'downloading', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "principle_references" ADD COLUMN "source_url" text;