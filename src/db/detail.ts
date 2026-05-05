import { and, desc, eq, inArray } from "drizzle-orm";
import { createDb } from "@/db/client";
import { alerts, feeClaims, holderSnapshots, holders, scores, tokens, trades, wallets } from "@/db/schema";
import type { BagsHolder, BagsToken, BagsTrade, TokenSnapshot, WalletSignal } from "@/lib/bags/types";

export async function getTokenSnapshotFromDb(mint: string): Promise<TokenSnapshot | null> {
  const db = createDb();

  if (!db) {
    return null;
  }

  const [row] = await db
    .select({ token: tokens, score: scores })
    .from(tokens)
    .leftJoin(scores, eq(scores.mintPk, tokens.mintPk))
    .where(eq(tokens.mintPk, mint))
    .limit(1);

  if (!row) {
    return null;
  }

  const [holderRows, holderHistoryRows, tradeRows, claimRows, walletRows, alertRows] = await Promise.all([
    db
      .select()
      .from(holders)
      .where(eq(holders.mintPk, mint))
      .orderBy(desc(holders.pctSupply))
      .limit(12),
    db
      .select()
      .from(holderSnapshots)
      .where(eq(holderSnapshots.mintPk, mint))
      .orderBy(desc(holderSnapshots.ts))
      .limit(12),
    db
      .select()
      .from(trades)
      .where(eq(trades.mintPk, mint))
      .orderBy(desc(trades.ts))
      .limit(8),
    db
      .select()
      .from(feeClaims)
      .where(eq(feeClaims.mintPk, mint))
      .orderBy(desc(feeClaims.ts))
      .limit(8),
    db
      .select({ holder: holders, wallet: wallets })
      .from(holders)
      .leftJoin(wallets, eq(wallets.holderPk, holders.holderPk))
      .where(and(eq(holders.mintPk, mint)))
      .orderBy(desc(holders.pctSupply))
      .limit(5),
    db
      .select()
      .from(alerts)
      .where(eq(alerts.mintPk, mint))
      .orderBy(desc(alerts.triggeredAt))
      .limit(8)
  ]);

  const latestHolderCount = holderHistoryRows[0]?.holderCount ?? holderRows.length;
  const token: BagsToken = {
    mint: row.token.mintPk,
    name: row.token.name,
    symbol: row.token.symbol,
    imageUrl: row.token.imageUrl ?? "",
    creator: row.token.creatorPk ?? "unknown",
    launchedAt: row.token.launchedAt.toISOString(),
    holderCount: latestHolderCount,
    marketCapUsd: 0,
    liquidityUsd: 0,
    lifetimeFeesSol: 0,
    source: row.token.source === "bags_launch_feed" ? "launch-feed" : "top-fee-fixture",
    status: row.token.status as BagsToken["status"],
    description: row.token.description,
    twitter: row.token.twitter,
    website: row.token.website,
    launchSignature: row.token.launchSignature,
    dbcPoolKey: row.token.dbcPoolKey,
    dbcConfigKey: row.token.dbcConfigKey,
    aiSummary: row.token.aiSummary,
    aiSummaryGeneratedAt: row.token.aiSummaryGeneratedAt?.toISOString(),
    score: row.score ? {
      holderGrowth: Number(row.score.holderGrowthScore),
      concentration: Number(row.score.concentrationScore),
      smartWallet: Number(row.score.smartWalletScore),
      composite: Number(row.score.compositeScore)
    } : null
  };

  const holderList: BagsHolder[] = holderRows.map((holder) => ({
    wallet: holder.holderPk,
    balance: Number(holder.balance),
    pctSupply: Number(holder.pctSupply),
    firstSeenAt: holder.firstSeenTs.toISOString()
  }));

  const tradeActivity: BagsTrade[] = tradeRows.map((trade) => ({
    signature: trade.txSig,
    mint,
    buyer: trade.buyerPk,
    side: "buy",
    solAmount: Number(trade.solIn),
    tokenAmount: Number(trade.tokensOut),
    priceUsd: Number(trade.pricePerToken),
    timestamp: trade.ts.toISOString()
  }));
  const claimActivity: BagsTrade[] = claimRows.map((claim) => ({
    signature: claim.txSig,
    mint,
    buyer: claim.claimerPk,
    side: "claim",
    solAmount: Number(claim.claimedSol),
    tokenAmount: 0,
    priceUsd: 0,
    timestamp: claim.ts.toISOString()
  }));
  const activity = [...tradeActivity, ...claimActivity]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);
  const walletKeys = walletRows.map(({ holder }) => holder.holderPk);
  const walletObservationRows = walletKeys.length
    ? await db
      .select({ holderPk: holders.holderPk, mintPk: holders.mintPk })
      .from(holders)
      .where(inArray(holders.holderPk, walletKeys))
    : [];
  const observedLaunches = new Map<string, Set<string>>();

  for (const row of walletObservationRows) {
    const mints = observedLaunches.get(row.holderPk) ?? new Set<string>();
    mints.add(row.mintPk);
    observedLaunches.set(row.holderPk, mints);
  }

  const walletSignals: WalletSignal[] = walletRows.map(({ holder, wallet }, index) => ({
    wallet: holder.holderPk,
    alphaScore: wallet ? Number(wallet.alphaScore) : Math.max(35, 70 - index * 6),
    winningCalls: wallet ? Number(wallet.nWinningCalls) : 0,
    losingCalls: wallet ? Number(wallet.nLosingCalls) : 0,
    observedLaunches: observedLaunches.get(holder.holderPk)?.size ?? 1,
    lastActiveAt: (wallet?.lastActiveTs ?? holder.lastSeenTs).toISOString()
  }));

  return {
    token,
    trades: activity,
    holders: holderList,
    wallets: walletSignals,
    holderHistory: holderHistoryRows.map((snapshot) => ({
      timestamp: snapshot.ts.toISOString(),
      holderCount: snapshot.holderCount
    })),
    alerts: alertRows.map((alert) => ({
      id: alert.id,
      tier: alert.tier,
      score: Number(alert.compositeScore),
      previousScore: alert.prevCompositeScore === null ? null : Number(alert.prevCompositeScore),
      threshold: Number(alert.threshold),
      reason: alert.reason,
      triggeredAt: alert.triggeredAt.toISOString()
    })),
    scoreNotes: row.score?.notesJson ?? [],
    scoreComputedAt: row.score?.computedAt.toISOString(),
    dataSource: "db"
  };
}
