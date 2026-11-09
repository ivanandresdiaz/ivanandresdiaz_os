ALTER TABLE "clips" ADD COLUMN "creator_id" uuid;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "principle_id" uuid;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_principle_id_principles_id_fk" FOREIGN KEY ("principle_id") REFERENCES "public"."principles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_one_destination" CHECK ("clips"."creator_id" is null or "clips"."principle_id" is null);