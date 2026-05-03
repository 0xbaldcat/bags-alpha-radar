import { and, desc, eq, gt, gte } from "drizzle-orm";
import { createDb } from "@/db/client";
import { alerts, scores } from "@/db/schema";

const ALERT_TIERS = [
  { tier: "strong", threshold: 75 },
  { tier: "critical", threshold: 90 }
] as const;
const DEDUPE_MS = 24 * 60 * 60 * 1000;

export type StoredAlert = typeof alerts.$inferSelect;

export async function recordScoreAlerts(input: {
  mint: string;
  composite: number;
  previousComposite?: number | null;
  notes?: string[];
  triggeredAt?: Date;
}) {
  const db = createDb();

  if (!db) {
    return [];
  }

  const triggeredAt = input.triggeredAt ?? new Date();
  const previousComposite = input.previousComposite ?? 0;
  const rows: StoredAlert[] = [];

  for (const config of ALERT_TIERS) {
    if (previousComposite >= config.threshold || input.composite < config.threshold) {
      continue;
    }

    const since = new Date(triggeredAt.getTime() - DEDUPE_MS);
    const existing = await db
      .select({ id: alerts.id })
      .from(alerts)
      .where(and(
        eq(alerts.mintPk, input.mint),
        eq(alerts.tier, config.tier),
        gt(alerts.triggeredAt, since)
      ))
      .limit(1);

    if (existing.length) {
      continue;
    }

    const [row] = await db
      .insert(alerts)
      .values({
        mintPk: input.mint,
        tier: config.tier,
        compositeScore: String(input.composite),
        prevCompositeScore: String(previousComposite),
        threshold: String(config.threshold),
        reason: makeReason(input.composite, config.threshold),
        notesJson: input.notes ?? [],
        triggeredAt
      })
      .returning();

    rows.push(row);
  }

  return rows;
}

export async function getAlertsForToken(mint: string, limit = 8) {
  const db = createDb();

  if (!db) {
    return [];
  }

  return db
    .select()
    .from(alerts)
    .where(eq(alerts.mintPk, mint))
    .orderBy(desc(alerts.triggeredAt))
    .limit(limit);
}

export async function backfillCurrentScoreAlerts() {
  const db = createDb();

  if (!db) {
    return [];
  }

  const rows: StoredAlert[] = [];
  const scoreRows = await db
    .select()
    .from(scores)
    .where(gte(scores.compositeScore, String(ALERT_TIERS[0].threshold)))
    .orderBy(desc(scores.compositeScore));

  for (const score of scoreRows) {
    const composite = Number(score.compositeScore);

    for (const config of ALERT_TIERS) {
      if (composite < config.threshold) {
        continue;
      }

      const existing = await db
        .select({ id: alerts.id })
        .from(alerts)
        .where(and(
          eq(alerts.mintPk, score.mintPk),
          eq(alerts.tier, config.tier)
        ))
        .limit(1);

      if (existing.length) {
        continue;
      }

      const [row] = await db
        .insert(alerts)
        .values({
          mintPk: score.mintPk,
          tier: config.tier,
          compositeScore: score.compositeScore,
          prevCompositeScore: null,
          threshold: String(config.threshold),
          reason: makeBackfillReason(composite, config.threshold),
          notesJson: score.notesJson ?? [],
          triggeredAt: score.computedAt
        })
        .returning();

      rows.push(row);
    }
  }

  return rows;
}

function makeReason(score: number, threshold: number) {
  return `Score crossed ${threshold} and reached ${score}.`;
}

function makeBackfillReason(score: number, threshold: number) {
  return `Score was already above ${threshold} when alert tracking started; current score is ${score}.`;
}
