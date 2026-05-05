import { desc, eq, isNull, or } from "drizzle-orm";
import { createDb } from "@/db/client";
import { tokens } from "@/db/schema";
import { fetchSolanaMarketData } from "@/lib/market-data";

type CliOptions = {
  limit: number;
  all: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const limitIndex = argv.indexOf("--limit");
  const limit = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : Number(process.env.MARKET_BACKFILL_LIMIT ?? 300);

  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be a positive number");
  }

  return {
    limit,
    all: argv.includes("--all")
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = createDb();

  if (!db) {
    throw new Error("DATABASE_URL is required for market-data backfill");
  }

  const rows = await db
    .select({
      mintPk: tokens.mintPk,
      symbol: tokens.symbol
    })
    .from(tokens)
    .where(options.all ? undefined : or(isNull(tokens.marketCapUsd), isNull(tokens.marketDataUpdatedAt)))
    .orderBy(desc(tokens.lastSeenAt))
    .limit(options.limit);

  const marketData = await fetchSolanaMarketData(rows.map((row) => row.mintPk));
  let updated = 0;
  let indexed = 0;

  for (const row of rows) {
    const market = marketData.get(row.mintPk);

    if (!market) {
      continue;
    }

    await db
      .update(tokens)
      .set({
        marketCapUsd: market.marketCapUsd === null ? null : String(market.marketCapUsd),
        liquidityUsd: market.liquidityUsd === null ? null : String(market.liquidityUsd),
        marketDataUpdatedAt: market.updatedAt
      })
      .where(eq(tokens.mintPk, row.mintPk));

    updated += 1;

    if (market.marketCapUsd) {
      indexed += 1;
    }
  }

  console.log(JSON.stringify({
    scanned: rows.length,
    updated,
    indexed
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
