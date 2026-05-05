import { index, integer, jsonb, numeric, pgTable, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";

export const tokens = pgTable("tokens", {
  mintPk: text("mint_pk").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  launchedAt: timestamp("launched_at", { withTimezone: true }).notNull(),
  creatorPk: text("creator_pk"),
  status: text("status").notNull().default("PRE_GRAD"),
  source: text("source").notNull().default("bags_launch_feed"),
  twitter: text("twitter"),
  website: text("website"),
  launchSignature: text("launch_signature"),
  uri: text("uri"),
  dbcPoolKey: text("dbc_pool_key"),
  dbcConfigKey: text("dbc_config_key"),
  feeConfigJson: text("fee_config_json"),
  marketCapUsd: numeric("market_cap_usd"),
  liquidityUsd: numeric("liquidity_usd"),
  marketDataUpdatedAt: timestamp("market_data_updated_at", { withTimezone: true }),
  aiSummary: text("ai_summary"),
  aiSummaryGeneratedAt: timestamp("ai_summary_generated_at", { withTimezone: true }),
  aiSummaryScoreSnapshot: integer("ai_summary_score_snapshot"),
  rawLaunchJson: jsonb("raw_launch_json"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
}, (table) => ({
  statusIdx: index("tokens_status_idx").on(table.status),
  sourceStatusIdx: index("tokens_source_status_idx").on(table.source, table.status),
  lastSeenIdx: index("tokens_last_seen_idx").on(table.lastSeenAt)
}));

export const trades = pgTable("trades", {
  txSig: text("tx_sig").primaryKey(),
  mintPk: text("mint_pk").notNull().references(() => tokens.mintPk),
  buyerPk: text("buyer_pk").notNull(),
  solIn: numeric("sol_in").notNull(),
  tokensOut: numeric("tokens_out").notNull(),
  pricePerToken: numeric("price_per_token").notNull(),
  ts: timestamp("ts", { withTimezone: true }).notNull(),
  slot: numeric("slot")
}, (table) => ({
  mintTsIdx: index("trades_mint_ts_idx").on(table.mintPk, table.ts)
}));

export const holders = pgTable("holders", {
  mintPk: text("mint_pk").notNull().references(() => tokens.mintPk),
  holderPk: text("holder_pk").notNull(),
  balance: numeric("balance").notNull(),
  pctSupply: numeric("pct_supply").notNull(),
  firstSeenTs: timestamp("first_seen_ts", { withTimezone: true }).notNull(),
  lastSeenTs: timestamp("last_seen_ts", { withTimezone: true }).notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.mintPk, table.holderPk] })
}));

export const feeClaims = pgTable("fee_claims", {
  txSig: text("tx_sig").primaryKey(),
  mintPk: text("mint_pk").notNull().references(() => tokens.mintPk),
  claimerPk: text("claimer_pk").notNull(),
  claimedSol: numeric("claimed_sol").notNull(),
  ts: timestamp("ts", { withTimezone: true }).notNull()
});

export const wallets = pgTable("wallets", {
  holderPk: text("holder_pk").primaryKey(),
  alphaScore: numeric("alpha_score").notNull(),
  nWinningCalls: numeric("n_winning_calls").notNull(),
  nLosingCalls: numeric("n_losing_calls").notNull(),
  lastActiveTs: timestamp("last_active_ts", { withTimezone: true }).notNull()
});

export const scores = pgTable("scores", {
  mintPk: text("mint_pk").primaryKey().references(() => tokens.mintPk),
  holderGrowthScore: numeric("holder_growth_score").notNull(),
  concentrationScore: numeric("concentration_score").notNull(),
  smartWalletScore: numeric("smart_wallet_score").notNull(),
  compositeScore: numeric("composite_score").notNull(),
  notesJson: jsonb("notes_json").$type<string[]>(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull()
});

export const holderSnapshots = pgTable("holder_snapshots", {
  mintPk: text("mint_pk").notNull().references(() => tokens.mintPk),
  ts: timestamp("ts", { withTimezone: true }).notNull(),
  holderCount: integer("holder_count").notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.mintPk, table.ts] }),
  mintTsIdx: index("holder_snapshots_mint_ts_idx").on(table.mintPk, table.ts)
}));

export const scoreWeights = pgTable("score_weights", {
  id: serial("id").primaryKey(),
  holderGrowth: numeric("holder_growth").notNull().default("0.40"),
  concentration: numeric("concentration").notNull().default("0.30"),
  smartWallet: numeric("smart_wallet").notNull().default("0.30"),
  alertPro: numeric("alert_pro").notNull().default("0.75"),
  alertFree: numeric("alert_free").notNull().default("0.90"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const ingestionRuns = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  tokensSeen: integer("tokens_seen").notNull().default(0),
  tokensUpserted: integer("tokens_upserted").notNull().default(0),
  statusCountsJson: jsonb("status_counts_json"),
  error: text("error")
}, (table) => ({
  sourceStartedIdx: index("ingestion_runs_source_started_idx").on(table.source, table.startedAt)
}));

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  mintPk: text("mint_pk").notNull().references(() => tokens.mintPk),
  tier: text("tier").notNull(),
  compositeScore: numeric("composite_score").notNull(),
  prevCompositeScore: numeric("prev_composite_score"),
  threshold: numeric("threshold").notNull(),
  reason: text("reason").notNull(),
  notesJson: jsonb("notes_json").$type<string[]>(),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  deliveryChannel: text("delivery_channel")
}, (table) => ({
  mintTierTimeIdx: index("alerts_mint_tier_time_idx").on(table.mintPk, table.tier, table.triggeredAt)
}));
