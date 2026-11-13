CREATE TABLE "handoff_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_id" uuid NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handoff_codes_stakeholder_id_unique" UNIQUE("stakeholder_id")
);
--> statement-breakpoint
CREATE TABLE "handoff_misses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discovery_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handoff_codes" ADD CONSTRAINT "handoff_codes_discovery_id_discoveries_id_fk" FOREIGN KEY ("discovery_id") REFERENCES "public"."discoveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_codes" ADD CONSTRAINT "handoff_codes_stakeholder_id_stakeholders_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_misses" ADD CONSTRAINT "handoff_misses_discovery_id_discoveries_id_fk" FOREIGN KEY ("discovery_id") REFERENCES "public"."discoveries"("id") ON DELETE cascade ON UPDATE no action;