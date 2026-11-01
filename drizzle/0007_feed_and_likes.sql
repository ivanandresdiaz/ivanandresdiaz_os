CREATE TABLE "feeds" (
	"date" date PRIMARY KEY NOT NULL,
	"reference_ids" uuid[] NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"seen" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reference_likes_reference_id_date_unique" UNIQUE("reference_id","date")
);
--> statement-breakpoint
ALTER TABLE "reference_likes" ADD CONSTRAINT "reference_likes_reference_id_principle_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."principle_references"("id") ON DELETE cascade ON UPDATE no action;