import { backfillCurrentScoreAlerts } from "@/db/alerts";

async function main() {
  const rows = await backfillCurrentScoreAlerts();

  console.log(JSON.stringify({
    inserted: rows.length,
    alerts: rows.map((row) => ({
      mint: row.mintPk,
      tier: row.tier,
      score: Number(row.compositeScore),
      threshold: Number(row.threshold),
      triggeredAt: row.triggeredAt.toISOString()
    }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
