CREATE TABLE "calendar_cleanups" (
	"event_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_calendar" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"calendar_id" text,
	"app_origin" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_calendar_single" CHECK ("google_calendar"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN "reminder_lead_min" integer;--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN "reminder_event_id" text;--> statement-breakpoint
ALTER TABLE "slots" ADD COLUMN "reminder_failed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slot_reminder_lead" CHECK ("slots"."reminder_lead_min" is null or "slots"."reminder_lead_min" in (0, 5, 10, 15, 30, 60));--> statement-breakpoint
CREATE FUNCTION "queue_calendar_cleanup"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO "calendar_cleanups" ("event_id") VALUES (OLD."reminder_event_id") ON CONFLICT DO NOTHING;
	RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "slots_calendar_cleanup" AFTER DELETE ON "slots" FOR EACH ROW WHEN (OLD."reminder_event_id" IS NOT NULL) EXECUTE FUNCTION "queue_calendar_cleanup"();
