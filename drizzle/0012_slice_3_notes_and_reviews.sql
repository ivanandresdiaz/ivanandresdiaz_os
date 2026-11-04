CREATE TABLE "learning_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_week" date NOT NULL,
	"move_id" uuid,
	"title" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"week_of" date PRIMARY KEY NOT NULL,
	"felt_score" smallint NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "felt_score_range" CHECK ("weekly_reviews"."felt_score" between 1 and 10)
);
--> statement-breakpoint
ALTER TABLE "daily_notes" ADD COLUMN "journal" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_moves" ADD CONSTRAINT "review_moves_review_week_weekly_reviews_week_of_fk" FOREIGN KEY ("review_week") REFERENCES "public"."weekly_reviews"("week_of") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_moves" ADD CONSTRAINT "review_moves_move_id_moves_id_fk" FOREIGN KEY ("move_id") REFERENCES "public"."moves"("id") ON DELETE set null ON UPDATE no action;