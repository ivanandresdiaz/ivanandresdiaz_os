CREATE TABLE "discoveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"opening" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discoveries_slug_unique" UNIQUE("slug"),
	CONSTRAINT "discoveries_language" CHECK ("discoveries"."language" in ('es', 'en')),
	CONSTRAINT "discoveries_status" CHECK ("discoveries"."status" in ('draft', 'open', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "discovery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_id" uuid NOT NULL,
	"key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_images_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "discovery_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"learn" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"turn_id" uuid,
	"key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"name" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_files_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "interview_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"kind" text NOT NULL,
	"stage" text NOT NULL,
	"round" smallint NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_turns_interview_id_seq_unique" UNIQUE("interview_id","seq"),
	CONSTRAINT "interview_turns_kind" CHECK ("interview_turns"."kind" in ('round', 'answers', 'closing', 'more'))
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"theme_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"round" smallint DEFAULT 1 NOT NULL,
	"phase" text DEFAULT 'thinking' NOT NULL,
	"phase_at" timestamp with time zone DEFAULT now() NOT NULL,
	"understood" text[] DEFAULT '{}'::text[] NOT NULL,
	"earlier" text DEFAULT '' NOT NULL,
	"insights" jsonb,
	"insights_at" timestamp with time zone,
	"insights_error" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interviews_stakeholder_id_theme_id_unique" UNIQUE("stakeholder_id","theme_id"),
	CONSTRAINT "interviews_stage" CHECK ("interviews"."stage" in ('needs', 'vision')),
	CONSTRAINT "interviews_phase" CHECK ("interviews"."phase" in ('thinking', 'answering', 'closing', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "stakeholder_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_id" uuid NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stakeholder_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stakeholder_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "stakeholder_themes" (
	"stakeholder_id" uuid NOT NULL,
	"theme_id" uuid NOT NULL,
	CONSTRAINT "stakeholder_themes_stakeholder_id_theme_id_unique" UNIQUE("stakeholder_id","theme_id")
);
--> statement-breakpoint
CREATE TABLE "stakeholders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role_note" text DEFAULT '' NOT NULL,
	"wants_needs" boolean DEFAULT true NOT NULL,
	"wants_vision" boolean DEFAULT false NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"removed_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stakeholders_discovery_id_email_unique" UNIQUE("discovery_id","email"),
	CONSTRAINT "stakeholders_stage" CHECK ("stakeholders"."wants_needs" or "stakeholders"."wants_vision")
);
--> statement-breakpoint
ALTER TABLE "discovery_images" ADD CONSTRAINT "discovery_images_discovery_id_discoveries_id_fk" FOREIGN KEY ("discovery_id") REFERENCES "public"."discoveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_themes" ADD CONSTRAINT "discovery_themes_discovery_id_discoveries_id_fk" FOREIGN KEY ("discovery_id") REFERENCES "public"."discoveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_files" ADD CONSTRAINT "interview_files_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_files" ADD CONSTRAINT "interview_files_turn_id_interview_turns_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."interview_turns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_stakeholder_id_stakeholders_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_theme_id_discovery_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."discovery_themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder_codes" ADD CONSTRAINT "stakeholder_codes_discovery_id_discoveries_id_fk" FOREIGN KEY ("discovery_id") REFERENCES "public"."discoveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder_sessions" ADD CONSTRAINT "stakeholder_sessions_stakeholder_id_stakeholders_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder_themes" ADD CONSTRAINT "stakeholder_themes_stakeholder_id_stakeholders_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder_themes" ADD CONSTRAINT "stakeholder_themes_theme_id_discovery_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."discovery_themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholders" ADD CONSTRAINT "stakeholders_discovery_id_discoveries_id_fk" FOREIGN KEY ("discovery_id") REFERENCES "public"."discoveries"("id") ON DELETE cascade ON UPDATE no action;