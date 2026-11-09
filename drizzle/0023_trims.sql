CREATE TABLE "trims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sample_id" uuid,
	"reference_id" uuid,
	"from_key" text NOT NULL,
	"key" text NOT NULL,
	"content_type" text NOT NULL,
	"start_s" real,
	"end_s" real,
	"status" text NOT NULL,
	"run" uuid NOT NULL,
	"attempt" smallint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trims_sample_id_unique" UNIQUE("sample_id"),
	CONSTRAINT "trims_reference_id_unique" UNIQUE("reference_id"),
	CONSTRAINT "trims_one_item" CHECK ("trims"."sample_id" is null or "trims"."reference_id" is null),
	CONSTRAINT "trims_status" CHECK ("trims"."status" in ('trimming', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "trims" ADD CONSTRAINT "trims_sample_id_samples_id_fk" FOREIGN KEY ("sample_id") REFERENCES "public"."samples"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trims" ADD CONSTRAINT "trims_reference_id_principle_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."principle_references"("id") ON DELETE set null ON UPDATE no action;