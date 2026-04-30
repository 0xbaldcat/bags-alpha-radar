import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { bagsApi } from "@/lib/bags/client";
import { compactAddress, formatNumber, formatPercent } from "@/lib/utils";
import { Metric } from "@/components/metric";
import { ScoreRing } from "@/components/score-ring";

export const dynamic = "force-dynamic";

export default async function TokenPage({ params }: { params: { mint: string } }) {
  const snapshot = await bagsApi.getTokenSnapshot(params.mint);
  const { token, trades, holders, wallets } = snapshot;

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
              <span className="rounded bg-ink px-2 py-1 text-sm font-semibold text-panel">{token.symbol}</span>
              {token.status ? (
                <span className="rounded border border-ink/10 px-2 py-1 text-sm font-semibold text-ink/60">
                  {token.status.replace("_", " ")}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/65">
              <span className="font-mono font-semibold text-ink">{compactAddress(token.mint, 8)}</span>
              <span>Creator {compactAddress(token.creator, 5)}</span>
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

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="border border-ink/10 bg-panel/90 shadow-line lg:col-span-2">
          <div className="border-b border-ink/10 p-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y divide-ink/10">
            {trades.slice(0, 5).map((trade) => (
              <div key={trade.signature} className="grid gap-2 p-4 text-sm md:grid-cols-[90px_1fr_auto]">
                <span className={trade.side === "buy" ? "font-semibold text-green" : "font-semibold text-red"}>
                  {trade.side.toUpperCase()}
                </span>
                <span>{compactAddress(trade.buyer, 5)} moved {formatNumber(trade.solAmount, { maximumFractionDigits: 2 })} SOL</span>
                <span className="text-ink/55">{new Date(trade.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-ink/10 bg-ink p-4 text-panel shadow-line">
          <h2 className="text-lg font-semibold">Alpha Wallets</h2>
          <div className="mt-4 space-y-3">
            {wallets.slice(0, 5).map((wallet) => (
              <div key={wallet.wallet} className="border border-panel/15 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{compactAddress(wallet.wallet, 5)}</span>
                  <span className="text-amber">{wallet.alphaScore}</span>
                </div>
                <div className="mt-1 text-sm text-panel/65">
                  {wallet.winningCalls} winning calls / {wallet.losingCalls} misses
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 border border-ink/10 bg-white/75 p-4 shadow-line">
        <h2 className="text-lg font-semibold">Holder Distribution</h2>
        <div className="mt-4 grid gap-2">
          {holders.slice(0, 6).map((holder) => (
            <div key={holder.wallet} className="grid gap-2 text-sm md:grid-cols-[160px_1fr_80px] md:items-center">
              <span className="font-semibold">{compactAddress(holder.wallet, 5)}</span>
              <div className="h-2 bg-field">
                <div className="h-2 bg-green" style={{ width: `${Math.min(100, holder.pctSupply * 100)}%` }} />
              </div>
              <span className="text-right text-ink/60">{formatPercent(holder.pctSupply)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
