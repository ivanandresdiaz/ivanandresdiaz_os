CREATE TABLE "noise_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "noise_items" ("date", "title", "created_at")
SELECT "daily_notes"."date", "line"."title", now() + "line"."n" * interval '1 millisecond'
FROM "daily_notes",
	LATERAL (
		SELECT trim(regexp_replace("raw", '^\s*[-*•]\s*', '')) AS "title", "n"
		FROM regexp_split_to_table("daily_notes"."eliminate", '\r?\n') WITH ORDINALITY AS "split"("raw", "n")
	) AS "line"
WHERE "line"."title" <> '';
--> statement-breakpoint
ALTER TABLE "daily_notes" DROP COLUMN "eliminate";