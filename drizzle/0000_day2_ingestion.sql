CREATE TABLE "fee_claims" (
	"tx_sig" text PRIMARY KEY NOT NULL,
	"mint_pk" text NOT NULL,
	"claimer_pk" text NOT NULL,
	"claimed_sol" numeric NOT NULL,
	"ts" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holder_snapshots" (
	"mint_pk" text NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"holder_count" integer NOT NULL,
	CONSTRAINT "holder_snapshots_mint_pk_ts_pk" PRIMARY KEY("mint_pk","ts")
);
--> statement-breakpoint
CREATE TABLE "holders" (
	"mint_pk" text NOT NULL,
	"holder_pk" text NOT NULL,
	"balance" numeric NOT NULL,
	"pct_supply" numeric NOT NULL,
	"first_seen_ts" timestamp with time zone NOT NULL,
	"last_seen_ts" timestamp with time zone NOT NULL,
	CONSTRAINT "holders_mint_pk_holder_pk_pk" PRIMARY KEY("mint_pk","holder_pk")
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"tokens_seen" integer DEFAULT 0 NOT NULL,
	"tokens_upserted" integer DEFAULT 0 NOT NULL,
	"status_counts_json" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "score_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"holder_growth" numeric DEFAULT '0.40' NOT NULL,
	"concentration" numeric DEFAULT '0.30' NOT NULL,
	"smart_wallet" numeric DEFAULT '0.30' NOT NULL,
	"alert_pro" numeric DEFAULT '0.75' NOT NULL,
	"alert_free" numeric DEFAULT '0.90' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"mint_pk" text PRIMARY KEY NOT NULL,
	"holder_growth_score" numeric NOT NULL,
	"concentration_score" numeric NOT NULL,
	"smart_wallet_score" numeric NOT NULL,
	"composite_score" numeric NOT NULL,
	"computed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"mint_pk" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"description" text,
	"image_url" text,
	"launched_at" timestamp with time zone NOT NULL,
	"creator_pk" text,
	"status" text DEFAULT 'PRE_GRAD' NOT NULL,
	"source" text DEFAULT 'bags_launch_feed' NOT NULL,
	"twitter" text,
	"website" text,
	"launch_signature" text,
	"uri" text,
	"dbc_pool_key" text,
	"dbc_config_key" text,
	"fee_config_json" text,
	"raw_launch_json" jsonb,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"tx_sig" text PRIMARY KEY NOT NULL,
	"mint_pk" text NOT NULL,
	"buyer_pk" text NOT NULL,
	"sol_in" numeric NOT NULL,
	"tokens_out" numeric NOT NULL,
	"price_per_token" numeric NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"slot" numeric
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"holder_pk" text PRIMARY KEY NOT NULL,
	"alpha_score" numeric NOT NULL,
	"n_winning_calls" numeric NOT NULL,
	"n_losing_calls" numeric NOT NULL,
	"last_active_ts" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fee_claims" ADD CONSTRAINT "fee_claims_mint_pk_tokens_mint_pk_fk" FOREIGN KEY ("mint_pk") REFERENCES "public"."tokens"("mint_pk") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holder_snapshots" ADD CONSTRAINT "holder_snapshots_mint_pk_tokens_mint_pk_fk" FOREIGN KEY ("mint_pk") REFERENCES "public"."tokens"("mint_pk") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holders" ADD CONSTRAINT "holders_mint_pk_tokens_mint_pk_fk" FOREIGN KEY ("mint_pk") REFERENCES "public"."tokens"("mint_pk") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_mint_pk_tokens_mint_pk_fk" FOREIGN KEY ("mint_pk") REFERENCES "public"."tokens"("mint_pk") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_mint_pk_tokens_mint_pk_fk" FOREIGN KEY ("mint_pk") REFERENCES "public"."tokens"("mint_pk") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "holder_snapshots_mint_ts_idx" ON "holder_snapshots" USING btree ("mint_pk","ts");--> statement-breakpoint
CREATE INDEX "ingestion_runs_source_started_idx" ON "ingestion_runs" USING btree ("source","started_at");--> statement-breakpoint
CREATE INDEX "tokens_status_idx" ON "tokens" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tokens_source_status_idx" ON "tokens" USING btree ("source","status");--> statement-breakpoint
CREATE INDEX "tokens_last_seen_idx" ON "tokens" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "trades_mint_ts_idx" ON "trades" USING btree ("mint_pk","ts");