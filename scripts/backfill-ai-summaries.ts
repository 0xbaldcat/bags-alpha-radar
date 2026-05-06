import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { alerts, holders, scores, tokens } from "@/db/schema";
import { generateTokenAiSummary } from "@/lib/ai-summary";

type CliOptions = {
  limit: number;
  concurrency: number;
  force: boolean;
};

type WorkItem = {
  token: typeof tokens.$inferSelect;
  score: typeof scores.$inferSelect;
};

function parseArgs(argv: string[]): CliOptions {
  const limitIndex = argv.indexOf("--limit");
  const concurrencyIndex = argv.indexOf("--concurrency");
  const limit = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : Number(process.env.AI_BACKFILL_LIMIT ?? 120);
  const concurrency = concurrencyIndex >= 0 ? Number(argv[concurrencyIndex + 1]) : Number(process.env.AI_BACKFILL_CONCURRENCY ?? 3);

  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be a positive number");
  }

  if (!Number.isFinite(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new Error("--concurrency must be between 1 and 8");
  }

  return {
    limit,
    concurrency,
    force: argv.includes("--force")
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = createDb();

  if (!db) {
    throw new Error("DATABASE_URL is required for AI summary backfill");
  }

  const rows = await db
    .select({
      token: tokens,
      score: scores
    })
    .from(tokens)
    .innerJoin(scores, eq(scores.mintPk, tokens.mintPk))
    .where(options.force ? undefined : isNull(tokens.aiSummary))
    .orderBy(desc(scores.computedAt))
    .limit(options.limit);
  const results = await runWithConcurrency(rows, options.concurrency, (row) => backfillOne(row));

  console.log(JSON.stringify({
    scanned: rows.length,
    updated: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length
  }, null, 2));
}

async function backfillOne(item: WorkItem) {
  const db = createDb();

  if (!db) {
    throw new Error("DATABASE_URL is required for AI summary backfill");
  }

  const [holderStats, recentAlerts] = await Promise.all([
    loadHolderStats(item.token.mintPk),
    db
      .select({
        threshold: alerts.threshold,
        triggeredAt: alerts.triggeredAt
      })
      .from(alerts)
      .where(and(
        eq(alerts.mintPk, item.token.mintPk),
        gte(alerts.triggeredAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      ))
      .orderBy(desc(alerts.triggeredAt))
      .limit(5)
  ]);
  const composite = Number(item.score.compositeScore);
  const summary = await generateTokenAiSummary({
    symbol: item.token.symbol,
    dataThrough: item.score.computedAt.toISOString(),
    score: composite,
    tier: tierLabel(composite),
    scoreChange24h: null,
    concentrationScore: Number(item.score.concentrationScore) * 100,
    top5HolderPct: holderStats.top5HolderPct,
    alphaWalletCount: Math.min(holderStats.realHolderCount, 5),
    alphaValueUsd: null,
    marketCapUsd: Number(item.token.marketCapUsd ?? 0) || null,
    feeVelocity24h: null,
    riskFlags: riskFlags(item.token),
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
      aiSummaryScoreSnapshot: Math.round(composite)
    })
    .where(eq(tokens.mintPk, item.token.mintPk));

  return item.token.mintPk;
}

async function loadHolderStats(mint: string) {
  const db = createDb();

  if (!db) {
    return {
      realHolderCount: 0,
      top5HolderPct: 0
    };
  }

  const [countRow, topRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(holders)
      .where(eq(holders.mintPk, mint)),
    db
      .select({ pctSupply: holders.pctSupply })
      .from(holders)
      .where(eq(holders.mintPk, mint))
      .orderBy(desc(holders.pctSupply))
      .limit(5)
  ]);

  return {
    realHolderCount: Number(countRow[0]?.count ?? 0),
    top5HolderPct: topRows.reduce((sum, row) => sum + Number(row.pctSupply), 0) * 100
  };
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

function riskFlags(token: typeof tokens.$inferSelect) {
  const flags: string[] = [];

  if (!token.dbcPoolKey) {
    flags.push("Pool not indexed yet");
  }

  if (token.status === "PRE_GRAD") {
    flags.push("Pre-graduation liquidity");
  }

  return flags;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      try {
        results[index] = {
          status: "fulfilled",
          value: await worker(items[index])
        };
      } catch (error) {
        results[index] = {
          status: "rejected",
          reason: error
        };
        console.error(error);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
