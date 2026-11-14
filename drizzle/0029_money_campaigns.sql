CREATE TABLE "money_movement_campaigns" (
	"movement_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	CONSTRAINT "money_movement_campaigns_movement_id_campaign_id_unique" UNIQUE("movement_id","campaign_id")
);
--> statement-breakpoint
CREATE TABLE "money_recurring_campaigns" (
	"recurring_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	CONSTRAINT "money_recurring_campaigns_recurring_id_campaign_id_unique" UNIQUE("recurring_id","campaign_id")
);
--> statement-breakpoint
ALTER TABLE "money_movement_campaigns" ADD CONSTRAINT "money_movement_campaigns_movement_id_money_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."money_movements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_movement_campaigns" ADD CONSTRAINT "money_movement_campaigns_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_recurring_campaigns" ADD CONSTRAINT "money_recurring_campaigns_recurring_id_money_recurrings_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."money_recurrings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_recurring_campaigns" ADD CONSTRAINT "money_recurring_campaigns_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "money_movement_campaigns_campaign" ON "money_movement_campaigns" USING btree ("campaign_id");