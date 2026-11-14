CREATE TYPE "public"."money_category_kind" AS ENUM('expense', 'income');--> statement-breakpoint
ALTER TABLE "money_movements" DROP CONSTRAINT "money_movement_shape";--> statement-breakpoint
ALTER TABLE "money_recurrings" DROP CONSTRAINT "money_recurring_shape";--> statement-breakpoint
DROP INDEX "money_categories_name";--> statement-breakpoint
ALTER TABLE "money_categories" ADD COLUMN "kind" "money_category_kind" DEFAULT 'expense' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "money_categories_kind_name" ON "money_categories" USING btree ("kind",lower("name"));--> statement-breakpoint
ALTER TABLE "money_movements" ADD CONSTRAINT "money_movement_shape" CHECK (("money_movements"."kind" = 'expense' and "money_movements"."category_id" is not null and "money_movements"."to_account_id" is null and "money_movements"."to_amount" is null)
        or ("money_movements"."kind" = 'income' and "money_movements"."to_account_id" is null and "money_movements"."to_amount" is null)
        or ("money_movements"."kind" = 'transfer' and "money_movements"."category_id" is null and "money_movements"."to_account_id" is not null
            and "money_movements"."to_account_id" <> "money_movements"."account_id" and "money_movements"."to_amount" > 0));--> statement-breakpoint
ALTER TABLE "money_recurrings" ADD CONSTRAINT "money_recurring_shape" CHECK (("money_recurrings"."kind" = 'expense' and "money_recurrings"."category_id" is not null and "money_recurrings"."to_account_id" is null and "money_recurrings"."to_amount" is null)
        or ("money_recurrings"."kind" = 'income' and "money_recurrings"."to_account_id" is null and "money_recurrings"."to_amount" is null)
        or ("money_recurrings"."kind" = 'transfer' and "money_recurrings"."category_id" is null and "money_recurrings"."to_account_id" is not null
            and "money_recurrings"."to_account_id" <> "money_recurrings"."account_id" and "money_recurrings"."to_amount" > 0));