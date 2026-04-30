import { desc, eq, inArray, sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { holderSnapshots, scores, tokens } from "@/db/schema";
import type { BagsToken, TokenLaunchFeedItem } from "@/lib/bags/types";

const RADAR_STATUSES = ["PRE_GRAD", "PRE_LAUNCH", "MIGRATING"];

export async function getRadarTokensFromDb(limit = 30): Promise<BagsToken[]> {
  const db = createDb();

  if (!db) {
    return [];
  }

  const rows = await db
    .select({
      token: tokens,
      score: scores,
      latestHolderCount: sql<number | null>`(
        select ${holderSnapshots.holderCount}
        from ${holderSnapshots}
        where ${holderSnapshots.mintPk} = ${tokens.mintPk}
        order by ${holderSnapshots.ts} desc
        limit 1
      )`
    })
    .from(tokens)
    .leftJoin(scores, eq(scores.mintPk, tokens.mintPk))
    .where(inArray(tokens.status, RADAR_STATUSES))
    .orderBy(
      sql`${scores.compositeScore} desc nulls last`,
      sql`case ${tokens.status} when 'PRE_GRAD' then 0 when 'PRE_LAUNCH' then 1 when 'MIGRATING' then 2 else 3 end`,
      desc(tokens.lastSeenAt)
    )
    .limit(limit);

  return rows.map(({ token, score, latestHolderCount }) => ({
    mint: token.mintPk,
    name: token.name,
    symbol: token.symbol,
    imageUrl: token.imageUrl ?? "",
    creator: token.creatorPk ?? "unknown",
    launchedAt: token.launchedAt.toISOString(),
    holderCount: Number(latestHolderCount ?? 0),
    marketCapUsd: 0,
    liquidityUsd: 0,
    lifetimeFeesSol: 0,
    source: token.source === "bags_launch_feed" ? "launch-feed" : "top-fee-fixture",
    status: token.status as BagsToken["status"],
    score: score ? {
      holderGrowth: Number(score.holderGrowthScore),
      concentration: Number(score.concentrationScore),
      smartWallet: Number(score.smartWalletScore),
      composite: Number(score.compositeScore)
    } : null
  }));
}

export async function upsertLaunchFeedItems(items: TokenLaunchFeedItem[]) {
  const db = createDb();

  if (!db) {
    throw new Error("DATABASE_URL is required for ingestion");
  }

  const now = new Date();

  for (const item of items) {
    await db
      .insert(tokens)
      .values({
        mintPk: item.tokenMint,
        name: item.name,
        symbol: item.symbol,
        description: item.description,
        imageUrl: item.image,
        launchedAt: now,
        creatorPk: item.accountKeys?.[0],
        status: item.status,
        source: "bags_launch_feed",
        twitter: item.twitter,
        website: item.website,
        launchSignature: item.launchSignature,
        uri: item.uri,
        dbcPoolKey: item.dbcPoolKey,
        dbcConfigKey: item.dbcConfigKey,
        rawLaunchJson: item,
        firstSeenAt: now,
        lastSeenAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: tokens.mintPk,
        set: {
          name: item.name,
          symbol: item.symbol,
          description: item.description,
          imageUrl: item.image,
          creatorPk: item.accountKeys?.[0],
          status: item.status,
          twitter: item.twitter,
          website: item.website,
          launchSignature: item.launchSignature,
          uri: item.uri,
          dbcPoolKey: item.dbcPoolKey,
          dbcConfigKey: item.dbcConfigKey,
          rawLaunchJson: item,
          lastSeenAt: now,
          updatedAt: now
        }
      });
  }

  return items.length;
}
