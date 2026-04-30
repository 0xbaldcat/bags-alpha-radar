import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { createDb } from "@/db/client";
import { holderSnapshots, holders, scores, scoreWeights, tokens } from "@/db/schema";
import type { BagsHolder } from "@/lib/bags/types";
import { computeScoreV1 } from "@/lib/scoring/v1";

const SCORABLE_STATUSES = ["PRE_GRAD", "PRE_LAUNCH", "MIGRATING", "MIGRATED"];
const BONDING_CURVE_PCT_THRESHOLD = 0.8;

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
  computedAt: Date;
}) {
  const db = createDb();

  if (!db) {
    throw new Error("DATABASE_URL is required for score persistence");
  }

  await db
    .insert(scores)
    .values({
      mintPk: input.mint,
      holderGrowthScore: String(input.holderGrowth),
      concentrationScore: String(input.concentration),
      smartWalletScore: String(input.smartWallet),
      compositeScore: String(input.composite),
      computedAt: input.computedAt
    })
    .onConflictDoUpdate({
      target: scores.mintPk,
      set: {
        holderGrowthScore: String(input.holderGrowth),
        concentrationScore: String(input.concentration),
        smartWalletScore: String(input.smartWallet),
        compositeScore: String(input.composite),
        computedAt: input.computedAt
      }
    });
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

  await persistScore({
    mint: input.token.mintPk,
    ...score
  });

  return {
    mint: input.token.mintPk,
    symbol: input.token.symbol,
    holdersSeen: input.holders.length,
    realHolders: realHolders.length,
    score
  };
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
