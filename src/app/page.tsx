import { Activity, BellRing, Database, RadioTower } from "lucide-react";
import { detectAlert } from "@/lib/alerts/detector";
import { bagsApi } from "@/lib/bags/client";
import { getRadarTokens } from "@/lib/radar";
import { formatNumber } from "@/lib/utils";
import { Metric } from "@/components/metric";
import { TokenCard } from "@/components/token-card";
import type { AlertEvent } from "@/lib/alerts/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tokens = await getRadarTokens();
  const alerts = tokens.map((token) => detectAlert(token)).filter((alert): alert is AlertEvent => Boolean(alert));
  const mode = bagsApi.hasCredentials() ? "Live Bags API" : "Mock data";
  const topToken = tokens[0];
  const topScoredToken = tokens.find((token) => token.score);
  const sourceLabel = topToken?.source === "launch-feed" ? "Fresh launch feed" : "SDK smoke fixtures";
  const sourceDetail = topToken?.source === "launch-feed"
    ? "Bags /token-launch/feed, PRE_GRAD first; scores load after ingestion"
    : "Top lifetime-fee tokens until fresh-launch source lands";

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 md:px-8 md:py-8">
      <header className="flex flex-col gap-4 border-b border-ink/15 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase text-ink/60">
            <RadioTower className="h-4 w-4" />
            BagsRadar
          </div>
          <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Early signal for Bags token launches.
          </h1>
        </div>
        <div className="flex items-center gap-2 self-start border border-ink/10 bg-white/75 px-3 py-2 text-sm font-semibold md:self-auto">
          <Database className="h-4 w-4" />
          {mode}
        </div>
      </header>

      <section className="grid gap-3 py-5 md:grid-cols-4">
        <Metric label={sourceLabel} value={formatNumber(tokens.length)} detail={sourceDetail} />
        <Metric label="Active alerts" value={formatNumber(alerts.length)} detail="Composite score >= 75" />
        <Metric label="Top score" value={topScoredToken?.score ? String(topScoredToken.score.composite) : "--"} detail={topScoredToken?.symbol ?? "Awaiting ingestion"} />
        <Metric label="Top holders" value={formatNumber(topToken?.holderCount ?? 0)} detail="Fresh distribution signal" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden border border-ink/10 bg-panel/90 shadow-line">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <div>
              <h2 className="text-lg font-semibold">{sourceLabel}</h2>
              <p className="text-sm text-ink/60">{sourceDetail}</p>
            </div>
            <Activity className="h-5 w-5 text-green" />
          </div>
          <div>
            {tokens.map((token) => (
              <TokenCard key={token.mint} token={token} />
            ))}
          </div>
        </div>

        <aside className="border border-ink/10 bg-ink p-4 text-panel shadow-line">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-amber" />
            <h2 className="text-lg font-semibold">Alert Queue</h2>
          </div>
          <div className="mt-4 space-y-3">
            {alerts.length ? alerts.map((alert) => (
              <div key={`${alert.token.mint}-${alert.createdAt}`} className="border border-panel/15 bg-panel/5 p-3">
                <div className="text-sm font-semibold">{alert.token.symbol} crossed {alert.score}</div>
                <div className="mt-1 text-sm text-panel/70">{alert.reason}</div>
              </div>
            )) : (
              <div className="border border-panel/15 bg-panel/5 p-3 text-sm text-panel/70">
                No live alert above threshold yet.
              </div>
            )}
          </div>
          <div className="mt-5 border-t border-panel/15 pt-4 text-sm text-panel/65">
            Telegram proof path is wired through `/api/alerts/test` and `npm run bot:dev` once bot credentials are present.
          </div>
        </aside>
      </section>
    </main>
  );
}
