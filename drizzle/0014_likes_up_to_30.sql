ALTER TABLE "reference_likes" DROP CONSTRAINT "likes_per_day";--> statement-breakpoint
ALTER TABLE "reference_likes" ADD CONSTRAINT "likes_per_day" CHECK ("reference_likes"."count" between 1 and 30);