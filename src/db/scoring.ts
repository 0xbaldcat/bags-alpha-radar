import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { createDb } from "@/db/client";
import { alerts, holderSnapshots, holders, scores, scoreWeights, tokens } from "@/db/schema";
import { generateTokenAiSummary } from "@/lib/ai-summary";
import type { BagsHolder } from "@/lib/bags/types";
import { computeScoreV1 } from "@/lib/scoring/v1";

const SCORABLE_STATUSES = ["PRE_GRAD", "PRE_LAUNCH", "MIGRATING", "MIGRATED"];
const BONDING_CURVE_PCT_THRESHOLD = 0.8;
const SUMMARY_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const SUMMARY_SCORE_JUMP_THRESHOLD = 15;

export async function loadScoreWeights() {
  const db = createDb();

  if (!db) {
    return defaultWeights();
  }

  const [row] = await db
    .select()
    .from(scoreWeights)
    .orderBy(desc(scoreWeights.createdAt))
    .limit(1);

  if (!row) {
    return defaultWeights();
  }

  return {
    holderGrowth: Number(row.holderGrowth),
    concentration: Number(row.concentration),
    smartWallet: Number(row.smartWallet)
  };
}

export async function getScorableTokens(limit = 30) {
  const db = createDb();

  if (!db) {
    throw new Error("DATABASE_URL is required for score recompute");
  }

  return db
    .select()
    .from(tokens)
    .where(inArray(tokens.status, SCORABLE_STATUSES))
    .orderBy(
      desc(tokens.lastSeenAt),
      desc(tokens.firstSeenAt)
    )
    .limit(limit);
}

export async function persistHolderSnapshot(input: {
  mint: string;
  holders: BagsHolder[];
  observedAt?: Date;
}) {
  const db = createDb();

  if (!db) {
    throw new Error("DATABASE_URL is required for holder persistence");
  }

  const observedAt = input.observedAt ?? new Date();
  const realHolders = input.holders.filter((holder) => holder.pctSupply < BONDING_CURVE_PCT_THRESHOLD);

  await db.transaction(async (tx) => {
    if (realHolders.length) {
      for (const holder of realHolders) {
        await tx
          .insert(holders)
          .values({
            mintPk: input.mint,
            holderPk: holder.wallet,
            balance: String(holder.balance),
            pctSupply: String(holder.pctSupply),
            firstSeenTs: observedAt,
            lastSeenTs: observedAt
          })
          .onConflictDoUpdate({
            target: [holders.mintPk, holders.holderPk],
            set: {
              balance: String(holder.balance),
              pctSupply: String(holder.pctSupply),
              lastSeenTs: observedAt
            }
          });
      }
    }

    await tx
      .insert(holderSnapshots)
      .values({
        mintPk: input.mint,
        ts: observedAt,
        holderCount: realHolders.length
      })
      .onConflictDoNothing();
  });

  return realHolders;
}

export async function persistScore(input: {
  mint: string;
  holderGrowth: number;
  concentration: number;
  smartWallet: number;
  composite: number;
  notes?: string[];
  computedAt: Date;
}) {
  const db = createDb();

  if (!db) {
    throw new Error("DATABASE_URL is required for score persistence");
  }

  const [previous] = await db
    .select({
      compositeScore: scores.compositeScore
    })
    .from(scores)
    .where(eq(scores.mintPk, input.mint))
    .limit(1);

  await db
    .insert(scores)
    .values({
      mintPk: input.mint,
      holderGrowthScore: String(input.holderGrowth),
      concentrationScore: String(input.concentration),
      smartWalletScore: String(input.smartWallet),
      compositeScore: String(input.composite),
      notesJson: input.notes ?? [],
      computedAt: input.computedAt
    })
    .onConflictDoUpdate({
      target: scores.mintPk,
      set: {
        holderGrowthScore: String(input.holderGrowth),
        concentrationScore: String(input.concentration),
        smartWalletScore: String(input.smartWallet),
        compositeScore: String(input.composite),
        notesJson: input.notes ?? [],
        computedAt: input.computedAt
      }
    });

  return {
    previousComposite: previous ? Number(previous.compositeScore) : null
  };
}

export async function computeAndPersistTokenScore(input: {
  token: Awaited<ReturnType<typeof getScorableTokens>>[number];
  holders: BagsHolder[];
  weights: Awaited<ReturnType<typeof loadScoreWeights>>;
  observedAt?: Date;
}) {
  const realHolders = await persistHolderSnapshot({
    mint: input.token.mintPk,
    holders: input.holders,
    observedAt: input.observedAt
  });
  const score = computeScoreV1({
    launchedAt: input.token.launchedAt,
    status: input.token.status as "PRE_LAUNCH" | "PRE_GRAD" | "MIGRATING" | "MIGRATED",
    currentHolderCount: realHolders.length,
    realHolders: realHolders.map((holder) => ({
      wallet: holder.wallet,
      balance: holder.balance,
      pct: holder.pctSupply
    })),
    weights: input.weights,
    now: input.observedAt
  });

  const persisted = await persistScore({
    mint: input.token.mintPk,
    ...score
  });

  return {
    mint: input.token.mintPk,
    symbol: input.token.symbol,
    holdersSeen: input.holders.length,
    realHolders: realHolders.length,
    top5HolderPct: realHolders
      .sort((a, b) => b.pctSupply - a.pctSupply)
      .slice(0, 5)
      .reduce((sum, holder) => sum + holder.pctSupply, 0) * 100,
    previousComposite: persisted.previousComposite,
    score
  };
}

export async function refreshTokenAiSummaryIfNeeded(input: {
  token: Awaited<ReturnType<typeof getScorableTokens>>[number];
  score: Awaited<ReturnType<typeof computeAndPersistTokenScore>>["score"];
  realHolders: number;
  top5HolderPct: number;
  previousComposite?: number | null;
  observedAt: Date;
  alertCount?: number;
}) {
  const db = createDb();

  if (!db) {
    return null;
  }

  const tokenRow = await loadSummaryTokenRow(input.token.mintPk);

  if (!tokenRow || !shouldRegenerateSummary({
    generatedAt: tokenRow.aiSummaryGeneratedAt,
    scoreSnapshot: tokenRow.aiSummaryScoreSnapshot,
    currentScore: input.score.composite,
    alertCount: input.alertCount ?? 0,
    now: input.observedAt
  })) {
    return null;
  }

  const recentAlerts = await db
    .select({
      threshold: alerts.threshold,
      triggeredAt: alerts.triggeredAt
    })
    .from(alerts)
    .where(and(
      eq(alerts.mintPk, input.token.mintPk),
      gte(alerts.triggeredAt, new Date(input.observedAt.getTime() - 7 * 24 * 60 * 60 * 1000))
    ))
    .orderBy(desc(alerts.triggeredAt))
    .limit(5);
  const summary = await generateTokenAiSummary({
    symbol: input.token.symbol,
    dataThrough: input.observedAt.toISOString(),
    score: input.score.composite,
    tier: tierLabel(input.score.composite),
    scoreChange24h: input.previousComposite === null || input.previousComposite === undefined
      ? 0
      : input.score.composite - input.previousComposite,
    concentrationScore: input.score.concentration * 100,
    top5HolderPct: input.top5HolderPct,
    alphaWalletCount: Math.min(input.realHolders, 5),
    alphaValueUsd: 0,
    marketCapUsd: 0,
    feeVelocity24h: 1,
    riskFlags: riskFlags(input.token),
    recentAlerts: recentAlerts.map((alert) => ({
      threshold: Number(alert.threshold),
      timestamp: alert.triggeredAt.toISOString()
    }))
  });

  await db
    .update(tokens)
    .set({
      aiSummary: summary.summary,
      aiSummaryGeneratedAt: summary.generatedAt,
      aiSummaryScoreSnapshot: Math.round(input.score.composite)
    })
    .where(eq(tokens.mintPk, input.token.mintPk));

  return summary;
}

export async function getRecentHolderSnapshots(mint: string, since: Date) {
  const db = createDb();

  if (!db) {
    return [];
  }

  return db
    .select()
    .from(holderSnapshots)
    .where(and(eq(holderSnapshots.mintPk, mint), gte(holderSnapshots.ts, since)))
    .orderBy(desc(holderSnapshots.ts));
}

function defaultWeights() {
  return {
    holderGrowth: 0.4,
    concentration: 0.3,
    smartWallet: 0.3
  };
}

async function loadSummaryTokenRow(mint: string) {
  const db = createDb();

  if (!db) {
    return null;
  }

  const [row] = await db
    .select({
      aiSummaryGeneratedAt: tokens.aiSummaryGeneratedAt,
      aiSummaryScoreSnapshot: tokens.aiSummaryScoreSnapshot
    })
    .from(tokens)
    .where(eq(tokens.mintPk, mint))
    .limit(1);

  return row ? {
    aiSummaryGeneratedAt: row.aiSummaryGeneratedAt,
    aiSummaryScoreSnapshot: row.aiSummaryScoreSnapshot
  } : null;
}

function shouldRegenerateSummary(input: {
  generatedAt: Date | null;
  scoreSnapshot: number | null;
  currentScore: number;
  alertCount: number;
  now: Date;
}) {
  if (!input.generatedAt || input.scoreSnapshot === null) {
    return true;
  }

  if (input.now.getTime() - input.generatedAt.getTime() > SUMMARY_MAX_AGE_MS) {
    return true;
  }

  if (Math.abs(input.currentScore - input.scoreSnapshot) >= SUMMARY_SCORE_JUMP_THRESHOLD) {
    return true;
  }

  return input.alertCount > 0;
}

function tierLabel(score: number) {
  if (score >= 90) {
    return "critical";
  }

  if (score >= 75) {
    return "high";
  }

  if (score >= 50) {
    return "medium";
  }

  return "quiet";
}

function riskFlags(token: Awaited<ReturnType<typeof getScorableTokens>>[number]) {
  const flags: string[] = [];

  if (!token.dbcPoolKey) {
    flags.push("Pool not indexed yet");
  }

  if (token.status === "PRE_GRAD") {
    flags.push("Pre-graduation liquidity");
  }

  return flags;
}
