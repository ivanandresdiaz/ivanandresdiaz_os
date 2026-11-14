CREATE TYPE "public"."currency" AS ENUM('COP', 'USD');--> statement-breakpoint
CREATE TYPE "public"."movement_kind" AS ENUM('expense', 'income', 'transfer');--> statement-breakpoint
CREATE TABLE "money_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"currency" "currency" NOT NULL,
	"savings" boolean DEFAULT false NOT NULL,
	"opening_balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "movement_kind" NOT NULL,
	"date" date NOT NULL,
	"amount" bigint NOT NULL,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"to_amount" bigint,
	"category_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "money_movement_amount" CHECK ("money_movements"."amount" > 0),
	CONSTRAINT "money_movement_shape" CHECK (("money_movements"."kind" = 'expense' and "money_movements"."category_id" is not null and "money_movements"."to_account_id" is null and "money_movements"."to_amount" is null)
        or ("money_movements"."kind" = 'income' and "money_movements"."category_id" is null and "money_movements"."to_account_id" is null and "money_movements"."to_amount" is null)
        or ("money_movements"."kind" = 'transfer' and "money_movements"."category_id" is null and "money_movements"."to_account_id" is not null
            and "money_movements"."to_account_id" <> "money_movements"."account_id" and "money_movements"."to_amount" > 0))
);
--> statement-breakpoint
ALTER TABLE "money_movements" ADD CONSTRAINT "money_movements_account_id_money_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."money_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_movements" ADD CONSTRAINT "money_movements_to_account_id_money_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_movements" ADD CONSTRAINT "money_movements_category_id_money_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."money_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "money_accounts_name" ON "money_accounts" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "money_categories_name" ON "money_categories" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "money_movements_date" ON "money_movements" USING btree ("date");