CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"mint_pk" text NOT NULL,
	"tier" text NOT NULL,
	"composite_score" numeric NOT NULL,
	"prev_composite_score" numeric,
	"threshold" numeric NOT NULL,
	"reason" text NOT NULL,
	"notes_json" jsonb,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"delivery_channel" text
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_mint_pk_tokens_mint_pk_fk" FOREIGN KEY ("mint_pk") REFERENCES "public"."tokens"("mint_pk") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_mint_tier_time_idx" ON "alerts" USING btree ("mint_pk","tier","triggered_at");