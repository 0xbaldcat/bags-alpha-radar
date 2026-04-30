import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { upsertLaunchFeedItems } from "@/db/radar";
import { ingestionRuns } from "@/db/schema";
import { BagsApi } from "@/lib/bags/client";

type IngestionResult = {
  runId: number;
  tokensSeen: number;
  tokensUpserted: number;
  statusCounts: Record<string, number>;
};

type CliOptions = {
  loop: boolean;
  intervalMs: number;
};

function parseArgs(argv: string[]): CliOptions {
  const intervalArgIndex = argv.indexOf("--interval-ms");
  const intervalMs = intervalArgIndex >= 0
    ? Number(argv[intervalArgIndex + 1])
    : Number(process.env.INGEST_INTERVAL_MS ?? 60_000);

  if (!Number.isFinite(intervalMs) || intervalMs < 10_000) {
    throw new Error("--interval-ms must be a number >= 10000");
  }

  return {
    loop: argv.includes("--loop") || process.env.INGEST_LOOP === "1",
    intervalMs
  };
}

async function runOnce(): Promise<IngestionResult> {
  const db = createDb();

  if (!db) {
    throw new Error("DATABASE_URL is required. Set it in .env.local or the process environment.");
  }

  const startedAt = new Date();
  const [run] = await db
    .insert(ingestionRuns)
    .values({
      source: "bags_launch_feed",
      status: "running",
      startedAt,
      tokensSeen: 0,
      tokensUpserted: 0
    })
    .returning({ id: ingestionRuns.id });

  try {
    const bags = new BagsApi();
    const items = await bags.getLaunchFeedItems();
    const tokensUpserted = await upsertLaunchFeedItems(items);
    const statusCounts = items.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});

    await db
      .update(ingestionRuns)
      .set({
        status: "success",
        finishedAt: new Date(),
        tokensSeen: items.length,
        tokensUpserted,
        statusCountsJson: statusCounts
      })
      .where(eq(ingestionRuns.id, run.id));

    return {
      runId: run.id,
      tokensSeen: items.length,
      tokensUpserted,
      statusCounts
    };
  } catch (error) {
    await db
      .update(ingestionRuns)
      .set({
        status: "error",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error)
      })
      .where(eq(ingestionRuns.id, run.id));

    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.loop) {
    console.log(JSON.stringify(await runOnce(), null, 2));
    return;
  }

  console.log(`Starting Bags launch-feed ingestion loop at ${options.intervalMs}ms interval.`);

  for (;;) {
    const startedAt = Date.now();

    try {
      console.log(JSON.stringify(await runOnce(), null, 2));
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
