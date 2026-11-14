CREATE TABLE "money_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"delta" bigint NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "money_adjustment_delta" CHECK ("money_adjustments"."delta" <> 0)
);
--> statement-breakpoint
CREATE TABLE "money_recurring_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recurring_id" uuid NOT NULL,
	"month" text NOT NULL,
	"movement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "money_recurring_occurrences_recurring_id_month_unique" UNIQUE("recurring_id","month"),
	CONSTRAINT "money_recurring_occurrences_movement_id_unique" UNIQUE("movement_id")
);
--> statement-breakpoint
CREATE TABLE "money_recurrings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "movement_kind" NOT NULL,
	"amount" bigint NOT NULL,
	"account_id" uuid NOT NULL,
	"to_account_id" uuid,
	"to_amount" bigint,
	"category_id" uuid,
	"first_date" date NOT NULL,
	"every_months" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "money_recurring_amount" CHECK ("money_recurrings"."amount" > 0),
	CONSTRAINT "money_recurring_every" CHECK ("money_recurrings"."every_months" between 1 and 12),
	CONSTRAINT "money_recurring_shape" CHECK (("money_recurrings"."kind" = 'expense' and "money_recurrings"."category_id" is not null and "money_recurrings"."to_account_id" is null and "money_recurrings"."to_amount" is null)
        or ("money_recurrings"."kind" = 'income' and "money_recurrings"."category_id" is null and "money_recurrings"."to_account_id" is null and "money_recurrings"."to_amount" is null)
        or ("money_recurrings"."kind" = 'transfer' and "money_recurrings"."category_id" is null and "money_recurrings"."to_account_id" is not null
            and "money_recurrings"."to_account_id" <> "money_recurrings"."account_id" and "money_recurrings"."to_amount" > 0))
);
--> statement-breakpoint
ALTER TABLE "money_adjustments" ADD CONSTRAINT "money_adjustments_account_id_money_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."money_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_recurring_occurrences" ADD CONSTRAINT "money_recurring_occurrences_recurring_id_money_recurrings_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."money_recurrings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_recurring_occurrences" ADD CONSTRAINT "money_recurring_occurrences_movement_id_money_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."money_movements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_recurrings" ADD CONSTRAINT "money_recurrings_account_id_money_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."money_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_recurrings" ADD CONSTRAINT "money_recurrings_to_account_id_money_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."money_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_recurrings" ADD CONSTRAINT "money_recurrings_category_id_money_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."money_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "money_adjustments_date" ON "money_adjustments" USING btree ("date");