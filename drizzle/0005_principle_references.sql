CREATE TABLE "principle_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"principle_id" uuid NOT NULL,
	"key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "principle_references_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "principle_references" ADD CONSTRAINT "principle_references_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE cascade ON UPDATE no action;