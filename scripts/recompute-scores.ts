import { BagsApi } from "@/lib/bags/client";
import { recordScoreAlerts } from "@/db/alerts";
import { computeAndPersistTokenScore, getScorableTokens, loadScoreWeights, refreshTokenAiSummaryIfNeeded } from "@/db/scoring";

type CliOptions = {
  limit: number;
  concurrency: number;
  loop: boolean;
  intervalMs: number;
};

function parseArgs(argv: string[]): CliOptions {
  const limitArgIndex = argv.indexOf("--limit");
  const intervalArgIndex = argv.indexOf("--interval-ms");
  const limit = limitArgIndex >= 0
    ? Number(argv[limitArgIndex + 1])
    : Number(process.env.SCORE_LIMIT ?? 30);
  const concurrencyArgIndex = argv.indexOf("--concurrency");
  const concurrency = concurrencyArgIndex >= 0
    ? Number(argv[concurrencyArgIndex + 1])
    : Number(process.env.SCORE_CONCURRENCY ?? 4);
  const intervalMs = intervalArgIndex >= 0
    ? Number(argv[intervalArgIndex + 1])
    : Number(process.env.SCORE_INTERVAL_MS ?? 120_000);

  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be a positive number");
  }

  if (!Number.isFinite(intervalMs) || intervalMs < 30_000) {
    throw new Error("--interval-ms must be a number >= 30000");
  }

  if (!Number.isFinite(concurrency) || concurrency < 1 || concurrency > 10) {
    throw new Error("--concurrency must be a number between 1 and 10");
  }

  return {
    limit,
    concurrency,
    intervalMs,
    loop: argv.includes("--loop") || process.env.SCORE_LOOP === "1"
  };
}

async function runOnce(limit: number, concurrency: number) {
  const bags = new BagsApi();
  const weights = await loadScoreWeights();
  const tokens = await getScorableTokens(limit);
  const observedAt = new Date();
  const results = (await runWithConcurrency(tokens, concurrency, async (token) => {
    const holders = await bags.getLargestSystemOwnedHolders(token.mintPk, 100);
    const result = await computeAndPersistTokenScore({
      token,
      holders,
      weights,
      observedAt
    });
    const alerts = await recordScoreAlerts({
      mint: result.mint,
      composite: result.score.composite,
      previousComposite: result.previousComposite,
      notes: result.score.notes,
      triggeredAt: observedAt
    });
    const aiSummary = await refreshTokenAiSummaryIfNeeded({
      token,
      score: result.score,
      realHolders: result.realHolders,
      top5HolderPct: result.top5HolderPct,
      previousComposite: result.previousComposite,
      observedAt,
      alertCount: alerts.length
    });

    return {
      ...result,
      alerts: alerts.length,
      aiSummary: Boolean(aiSummary)
    };
  })).flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    const token = tokens[index];
    console.error(`score failed for ${token.symbol} ${token.mintPk}:`, result.reason);
    return [];
  });

  return {
    scored: results.length,
    top: results
      .sort((a, b) => b.score.composite - a.score.composite)
      .slice(0, 10)
      .map((item) => ({
        symbol: item.symbol,
        composite: item.score.composite,
        holders: item.realHolders,
        alerts: item.alerts,
        aiSummary: item.aiSummary,
        notes: item.score.notes
      }))
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.loop) {
    console.log(JSON.stringify(await runOnce(options.limit, options.concurrency), null, 2));
    return;
  }

  console.log(`Starting Bags score recompute loop at ${options.intervalMs}ms interval, concurrency=${options.concurrency}.`);

  for (;;) {
    const startedAt = Date.now();

    try {
      console.log(JSON.stringify(await runOnce(options.limit, options.concurrency), null, 2));
    } catch (error) {
      console.error(error);
    }

    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(0, options.intervalMs - elapsed));
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
