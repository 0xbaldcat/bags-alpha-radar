ALTER TABLE "tokens" ADD COLUMN "market_cap_usd" numeric;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "liquidity_usd" numeric;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "market_data_updated_at" timestamp with time zone;