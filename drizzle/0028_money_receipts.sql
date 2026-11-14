CREATE TABLE "money_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "money_receipts_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "money_receipts" ADD CONSTRAINT "money_receipts_movement_id_money_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."money_movements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "money_receipts_movement" ON "money_receipts" USING btree ("movement_id");