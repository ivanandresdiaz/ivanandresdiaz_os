CREATE TYPE "public"."money_debt_side" AS ENUM('owe', 'owed');--> statement-breakpoint
CREATE TABLE "money_debt_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debt_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"movement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "money_debt_payments_movement_id_unique" UNIQUE("movement_id"),
	CONSTRAINT "money_debt_payment_amount" CHECK ("money_debt_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "money_debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"side" "money_debt_side" NOT NULL,
	"who" text NOT NULL,
	"amount" bigint NOT NULL,
	"due_date" date,
	"note" text,
	"category_id" uuid NOT NULL,
	"opening_movement_id" uuid,
	"reminder_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "money_debt_amount" CHECK ("money_debts"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "money_debt_payments" ADD CONSTRAINT "money_debt_payments_debt_id_money_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."money_debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_debt_payments" ADD CONSTRAINT "money_debt_payments_movement_id_money_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."money_movements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_debts" ADD CONSTRAINT "money_debts_category_id_money_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."money_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_debts" ADD CONSTRAINT "money_debts_opening_movement_id_money_movements_id_fk" FOREIGN KEY ("opening_movement_id") REFERENCES "public"."money_movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_debts" ADD CONSTRAINT "money_debts_reminder_id_secondary_tasks_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."secondary_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "money_debt_payments_debt" ON "money_debt_payments" USING btree ("debt_id");