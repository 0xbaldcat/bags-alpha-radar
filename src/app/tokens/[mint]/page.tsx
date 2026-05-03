import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink, Info, LineChart, WalletCards } from "lucide-react";
import { getTokenSnapshotFromDb } from "@/db/detail";
import { bagsApi } from "@/lib/bags/client";
import { formatNumber, formatPercent, formatTokenSymbol } from "@/lib/utils";
import { AddressChip } from "@/components/address-chip";
import { Metric } from "@/components/metric";
import { ScoreRing } from "@/components/score-ring";

export const dynamic = "force-dynamic";

export default async function TokenPage({ params }: { params: { mint: string } }) {
  const snapshot = (await getTokenSnapshotFromDb(params.mint)) ?? await bagsApi.getTokenSnapshot(params.mint);
  const { token, trades, holders, wallets, holderHistory = [], alerts = [], scoreNotes = [], scoreComputedAt } = snapshot;
  const scoreRows = token.score
    ? [
        { label: "Holder growth", value: token.score.holderGrowth, tone: "bg-green" },
        { label: "Distribution", value: token.score.concentration, tone: "bg-amber" },
        { label: "Wallet interest", value: token.score.smartWallet, tone: "bg-red" }
      ]
    : [];
  const holderTrend = compressHolderHistory(holderHistory);
  const maxHolderTrend = Math.max(...holderTrend.map((item) => item.holderCount), 1);
  const holderHistoryCopy = makeHolderHistoryCopy(holderHistory, holderTrend);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-5 md:px-8 md:py-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink/70 hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Launch feed
      </Link>

      <section className="mt-5 grid gap-5 border-b border-ink/15 pb-5 lg:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center">
          <img
            src={token.imageUrl}
            alt=""
            className="h-24 w-24 rounded-md border border-ink/10 object-cover"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-4xl font-semibold md:text-6xl">{token.name}</h1>
              <span className="rounded bg-ink px-2 py-1 text-sm font-semibold text-panel">{formatTokenSymbol(token.symbol)}</span>
              {token.status ? (
                <span className="rounded border border-ink/10 px-2 py-1 text-sm font-semibold text-ink/60">
                  {token.status.replace("_", " ")}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/65">
              <AddressChip address={token.mint} chars={8} />
              <span className="inline-flex items-center gap-1">
                Creator <AddressChip address={token.creator} chars={5} />
              </span>
              <a href={`https://bags.fm/${token.mint}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink">
                Bags
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
        <ScoreRing score={token.score?.composite ?? null} size="lg" />
      </section>

      <section className="grid gap-3 py-5 md:grid-cols-4">
        <Metric label="Holder growth" value={token.score ? formatPercent(token.score.holderGrowth) : "--"} />
        <Metric label="Concentration" value={token.score ? formatPercent(token.score.concentration) : "--"} />
        <Metric label="Smart wallets" value={token.score ? formatPercent(token.score.smartWallet) : "--"} />
        <Metric label="Lifetime fees" value={`${formatNumber(token.lifetimeFeesSol, { maximumFractionDigits: 2 })} SOL`} />
      </section>

      <section className="grid gap-4 pb-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="border border-ink/10 bg-white/78 p-4 shadow-line">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Score Breakdown</h2>
              <p className="mt-1 text-sm text-ink/55">
                {scoreComputedAt ? `Updated ${formatDateTime(scoreComputedAt)}` : "Waiting for the next score refresh."}
              </p>
            </div>
            <span className="rounded bg-field px-2 py-1 text-xs font-semibold text-ink/55">
              {snapshot.dataSource === "db" ? "Stored signal" : "Live read"}
            </span>
          </div>
          {scoreRows.length ? (
            <div className="mt-4 grid gap-3">
              {scoreRows.map((row) => (
                <div key={row.label} className="grid gap-2 text-sm md:grid-cols-[150px_1fr_56px] md:items-center">
                  <span className="font-semibold text-ink/70">{row.label}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-field">
                    <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${Math.round(row.value * 100)}%` }} />
                  </div>
                  <span className="text-right font-mono text-ink/65">{formatPercent(row.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No score has been computed for this launch yet." />
          )}
          {scoreNotes.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {scoreNotes.map((note) => (
                <span key={note} className="rounded border border-ink/10 bg-field px-2 py-1 text-xs font-semibold text-ink/55">
                  {humanizeNote(note)}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="border border-ink/10 bg-white/78 p-4 shadow-line">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-amber" />
            <h2 className="text-lg font-semibold">Launch Details</h2>
          </div>
          <div className="mt-4 grid gap-3 text-sm">
            <FactRow label="Age" value={formatAge(token.launchedAt)} />
            <FactRow label="Status" value={token.status ? token.status.replace("_", " ") : "Live"} />
            <FactRow label="Pool" value={token.dbcPoolKey ? "DBC pool detected" : "Pool not indexed yet"} />
            {token.description ? (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink/42">Description</div>
                <p className="mt-1 text-ink/65">{token.description}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {token.website ? <ExternalPill href={token.website} label="Website" /> : null}
              {token.twitter ? <ExternalPill href={token.twitter} label="X" /> : null}
              {token.launchSignature ? <ExternalPill href={`https://solscan.io/tx/${token.launchSignature}`} label="Launch tx" /> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="border border-ink/10 bg-panel/90 shadow-line lg:col-span-2">
          <div className="border-b border-ink/10 p-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y divide-ink/10">
            {trades.length ? trades.slice(0, 8).map((trade) => (
              <div key={trade.signature} className="grid gap-2 p-4 text-sm md:grid-cols-[90px_1fr_auto]">
                <span className={trade.side === "buy" || trade.side === "claim" ? "font-semibold text-green" : "font-semibold text-red"}>
                  {trade.side.toUpperCase()}
                </span>
                <span className="inline-flex flex-wrap items-center gap-1">
                  <AddressChip address={trade.buyer} chars={5} /> {activityText(trade.side)} {formatNumber(trade.solAmount, { maximumFractionDigits: 2 })} SOL
                </span>
                <span className="text-ink/55">{formatDateTime(trade.timestamp)}</span>
              </div>
            )) : (
              <EmptyState text="No recent trade or claim activity has been stored for this launch yet." />
            )}
          </div>
        </div>

        <div className="border border-ink/10 bg-panel/90 p-4 text-ink shadow-line">
          <h2 className="text-lg font-semibold">Alpha Wallets</h2>
          <div className="mt-4 space-y-3">
            {wallets.length ? wallets.slice(0, 5).map((wallet) => {
              const hasTrackRecord = wallet.winningCalls + wallet.losingCalls > 0;

              return (
                <div key={wallet.wallet} className="border border-ink/10 bg-white/65 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <AddressChip address={wallet.wallet} chars={5} />
                    <span className="text-amber">{wallet.alphaScore}</span>
                  </div>
                  <div className="mt-1 text-sm text-ink/60">
                    {hasTrackRecord
                      ? `${wallet.winningCalls} early winners / ${wallet.losingCalls} misses`
                      : "Track record pending"}
                  </div>
                </div>
              );
            }) : (
              <EmptyState text="No repeated wallet pattern has been detected yet." />
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="border border-ink/10 bg-white/75 p-4 shadow-line">
          <h2 className="text-lg font-semibold">Holder Distribution</h2>
          <div className="mt-4 grid gap-2">
            {holders.length ? holders.slice(0, 8).map((holder) => (
              <div key={holder.wallet} className="grid gap-2 text-sm md:grid-cols-[170px_1fr_80px] md:items-center">
                <AddressChip address={holder.wallet} chars={5} />
                <div className="h-2 bg-field">
                  <div className="h-2 bg-green" style={{ width: `${Math.min(100, holder.pctSupply * 100)}%` }} />
                </div>
                <span className="text-right text-ink/60">{formatPercent(holder.pctSupply)}</span>
              </div>
            )) : (
              <EmptyState text="Holder snapshot is still warming up for this token." />
            )}
          </div>
        </div>

        <div className="border border-ink/10 bg-white/75 p-4 shadow-line">
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-green" />
            <h2 className="text-lg font-semibold">Holder History</h2>
          </div>
          <div className="mt-4 grid gap-3">
            {holderTrend.length ? (
              <>
                {holderTrend.slice(0, 8).map((snapshot) => (
                <div key={snapshot.timestamp} className="grid grid-cols-[76px_1fr_44px] items-center gap-2 text-xs">
                  <span className="text-ink/45">{new Date(snapshot.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <div className="h-2 bg-field">
                    <div className="h-2 bg-amber" style={{ width: `${Math.max(4, (snapshot.holderCount / maxHolderTrend) * 100)}%` }} />
                  </div>
                  <span className="text-right font-mono text-ink/55">{snapshot.holderCount}</span>
                </div>
                ))}
                {holderHistoryCopy ? <p className="text-xs text-ink/45">{holderHistoryCopy}</p> : null}
              </>
            ) : (
              <EmptyState text="No historical holder checkpoints yet." />
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <InfoCard label="Creator" value={<AddressChip address={token.creator} chars={6} />} />
        <InfoCard label="Mint" value={<AddressChip address={token.mint} chars={6} />} />
        <InfoCard
          label="Data coverage"
          value={
            <span className="inline-flex items-center gap-2">
              <WalletCards className="h-4 w-4 text-amber" />
              {holders.length} holders · {trades.length} events
            </span>
          }
        />
      </section>

      <section className="mt-4 border border-ink/10 bg-panel/85 p-4 shadow-line">
        <h2 className="text-lg font-semibold">Alert History</h2>
        <div className="mt-4 grid gap-3">
          {alerts.length ? alerts.map((alert) => (
            <div key={alert.id} className="grid gap-2 border border-ink/10 bg-white/65 p-3 text-sm md:grid-cols-[120px_1fr_auto] md:items-center">
              <span className="font-semibold capitalize text-amber">{alert.tier}</span>
              <span className="text-ink/65">{alert.reason}</span>
              <span className="font-mono text-ink/50">{formatDateTime(alert.triggeredAt)}</span>
            </div>
          )) : (
            <EmptyState text="No alert has fired for this token yet." />
          )}
        </div>
      </section>
    </main>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-ink/10 pb-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink/42">{label}</span>
      <span className="text-right font-semibold text-ink/70">{value}</span>
    </div>
  );
}

function ExternalPill({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded bg-ink px-2 py-1 text-xs font-semibold text-panel">
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-4 text-sm text-ink/55">
      {text}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border border-ink/10 bg-panel/85 p-4 shadow-line">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/42">{label}</div>
      <div className="mt-2 text-sm font-semibold text-ink/70">{value}</div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatAge(value: string) {
  const ageMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(ageMs / 60_000));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 48) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
}

function activityText(side: "buy" | "sell" | "claim") {
  switch (side) {
    case "buy":
      return "bought with";
    case "sell":
      return "sold for";
    case "claim":
      return "claimed";
  }
}

function humanizeNote(note: string) {
  return note
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compressHolderHistory(history: { timestamp: string; holderCount: number }[]) {
  if (!history.length) {
    return [];
  }

  const trend = history.filter((item, index) => index === 0 || item.holderCount !== history[index - 1].holderCount);

  return trend.length ? trend : [history[0]];
}

function makeHolderHistoryCopy(
  history: { timestamp: string; holderCount: number }[],
  trend: { timestamp: string; holderCount: number }[]
) {
  if (history.length <= 1) {
    return null;
  }

  if (trend.length === 1) {
    return `Holder count stayed at ${trend[0].holderCount} across the last ${history.length} checkpoints.`;
  }

  const hidden = history.length - trend.length;

  return hidden > 0 ? `${hidden} unchanged checkpoints hidden.` : null;
}
