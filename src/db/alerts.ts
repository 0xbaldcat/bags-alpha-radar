import { and, desc, eq, gt } from "drizzle-orm";
import { createDb } from "@/db/client";
import { alerts } from "@/db/schema";

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

function makeReason(score: number, threshold: number) {
  return `Score crossed ${threshold} and reached ${score}.`;
}
