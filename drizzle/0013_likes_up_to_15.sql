-- Likes start from scratch on the 1 to 15 scale (Q253). Feed days go too, or the old ones would count as zeros in the Like Average. Uploaded References stay.
DELETE FROM "reference_likes";--> statement-breakpoint
DELETE FROM "feeds";--> statement-breakpoint
ALTER TABLE "reference_likes" DROP CONSTRAINT "likes_per_day";--> statement-breakpoint
ALTER TABLE "reference_likes" ADD CONSTRAINT "likes_per_day" CHECK ("reference_likes"."count" between 1 and 15);
