import { desc, eq, isNull } from "drizzle-orm";
import { createDb } from "@/db/client";
import { tokens } from "@/db/schema";
import { BagsApi } from "@/lib/bags/client";

type CliOptions = {
  limit: number;
  concurrency: number;
  all: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const limitIndex = argv.indexOf("--limit");
  const concurrencyIndex = argv.indexOf("--concurrency");
  const limit = limitIndex >= 0 ? Number(argv[limitIndex + 1]) : Number(process.env.FEES_BACKFILL_LIMIT ?? 250);
  const concurrency = concurrencyIndex >= 0 ? Number(argv[concurrencyIndex + 1]) : Number(process.env.FEES_BACKFILL_CONCURRENCY ?? 2);

  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be a positive number");
  }

  if (!Number.isFinite(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error("--concurrency must be between 1 and 4");
  }

  return {
    limit,
    concurrency,
    all: argv.includes("--all")
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = createDb();

  if (!db) {
    throw new Error("DATABASE_URL is required for lifetime-fee backfill");
  }

  const rows = await db
    .select({
      mintPk: tokens.mintPk,
      symbol: tokens.symbol
    })
    .from(tokens)
    .where(options.all ? undefined : isNull(tokens.lifetimeFeesUpdatedAt))
    .orderBy(desc(tokens.lastSeenAt))
    .limit(options.limit);
  const api = new BagsApi();
  const results = await runWithConcurrency(rows, options.concurrency, async (row) => {
    const lifetimeFeesSol = await api.getTokenLifetimeFeesSol(row.mintPk);

    if (lifetimeFeesSol === null) {
      return { mint: row.mintPk, indexed: false };
    }

    await db
      .update(tokens)
      .set({
        lifetimeFeesSol: String(lifetimeFeesSol),
        lifetimeFeesUpdatedAt: new Date()
      })
      .where(eq(tokens.mintPk, row.mintPk));

    return { mint: row.mintPk, indexed: lifetimeFeesSol > 0 };
  });
  const fulfilled = results.filter((result): result is PromiseFulfilledResult<{ mint: string; indexed: boolean }> => result.status === "fulfilled");

  console.log(JSON.stringify({
    scanned: rows.length,
    updated: fulfilled.length,
    indexed: fulfilled.filter((result) => result.value.indexed).length,
    failed: results.filter((result) => result.status === "rejected").length
  }, null, 2));
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
