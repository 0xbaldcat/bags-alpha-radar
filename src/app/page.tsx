import Link from "next/link";
import { Activity, ArrowUpRight, BellRing, Database, RadioTower } from "lucide-react";
import { detectAlert } from "@/lib/alerts/detector";
import { bagsApi } from "@/lib/bags/client";
import type { BagsToken } from "@/lib/bags/types";
import { getRadarTokens } from "@/lib/radar";
import { formatNumber, formatTokenSymbol } from "@/lib/utils";
import { TokenCard } from "@/components/token-card";
import type { AlertEvent } from "@/lib/alerts/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tokens = await getRadarTokens();
  const alerts = tokens.map((token) => detectAlert(token)).filter((alert): alert is AlertEvent => Boolean(alert));
  const mode = bagsApi.hasCredentials() ? "Live data" : "Sample data";
  const topToken = tokens[0];
  const topScoredToken = tokens.find((token) => token.score);
  const topInterestToken = tokens.reduce<BagsToken | undefined>((best, token) => {
    if (!token.score) {
      return best;
    }
    if (!best?.score || token.score.smartWallet > best.score.smartWallet) {
      return token;
    }

    return best;
  }, undefined);
  const topHolderToken = tokens.reduce<BagsToken | undefined>((best, token) => {
    if (!best || token.holderCount > best.holderCount) {
      return token;
    }

    return best;
  }, undefined);
  const sourceLabel = topToken?.source === "launch-feed" ? "Live launch feed" : "Sample launch feed";
  const highlights = buildHighlights({ tokens, topToken, topScoredToken, topHolderToken, topInterestToken });

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

      <HighlightRibbon highlights={highlights} />

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden border border-ink/10 bg-panel/90 shadow-line">
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                {sourceLabel}
                <span className="rounded bg-field px-2 py-1 font-mono text-sm text-ink/60">{formatNumber(tokens.length)}</span>
              </h2>
            </div>
            <Activity className="h-5 w-5 text-green" />
          </div>
          <div>
            {tokens.map((token) => (
              <TokenCard key={token.mint} token={token} />
            ))}
          </div>
        </div>

        <aside className="border border-ink/10 bg-panel/90 p-4 text-ink shadow-line">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-amber" />
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              Alert Queue
              <span className="rounded bg-field px-2 py-1 font-mono text-sm text-ink/60">{formatNumber(alerts.length)}</span>
            </h2>
          </div>
          <div className="mt-4 space-y-3">
            {alerts.length ? alerts.map((alert) => (
              <div key={`${alert.token.mint}-${alert.createdAt}`} className="border border-ink/10 bg-white/65 p-3">
                <div className="text-sm font-semibold">{formatTokenSymbol(alert.token.symbol)} crossed {alert.score}</div>
                <div className="mt-1 text-sm text-ink/60">{alert.reason}</div>
              </div>
            )) : (
              <div className="border border-ink/10 bg-white/65 p-3 text-sm text-ink/60">
                No launch has crossed into alert range yet.
              </div>
            )}
          </div>
          <div className="mt-5 border-t border-ink/10 pt-4 text-sm text-ink/55">
            Telegram alerts will appear here when a launch starts to stand out.
          </div>
        </aside>
      </section>
    </main>
  );
}

type Highlight = {
  label: string;
  value: string;
  metric: string;
  token: BagsToken;
};

function buildHighlights(input: {
  tokens: BagsToken[];
  topToken?: BagsToken;
  topScoredToken?: BagsToken;
  topHolderToken?: BagsToken;
  topInterestToken?: BagsToken;
}): Highlight[] {
  const highlights: Highlight[] = [];
  const used = new Set<string>();

  function push(label: string, token: BagsToken | undefined, value: string, metric: string) {
    if (!token || used.has(token.mint)) {
      return;
    }

    used.add(token.mint);
    highlights.push({ label, token, value, metric });
  }

  push("Top score", input.topScoredToken, input.topScoredToken?.score ? String(input.topScoredToken.score.composite) : "--", "score");
  push("Top holders", input.topHolderToken, formatNumber(input.topHolderToken?.holderCount ?? 0), "holders");
  push("Top interest", input.topInterestToken, input.topInterestToken?.score ? `${Math.round(input.topInterestToken.score.smartWallet * 100)}%` : "--", "wallet interest");
  push("Newest", input.topToken, "NEW", "fresh launch");

  for (const token of input.tokens) {
    if (highlights.length >= 8) {
      break;
    }

    push(
      token.score ? "Score watch" : "Live launch",
      token,
      token.score ? String(token.score.composite) : formatNumber(token.holderCount),
      token.score ? "score" : "holders",
    );
  }

  return highlights.slice(0, 8);
}

function HighlightRibbon({ highlights }: { highlights: Highlight[] }) {
  if (highlights.length === 0) {
    return (
      <section className="py-5">
        <div className="border border-ink/10 bg-white/70 p-4 text-sm font-semibold text-ink/55 shadow-line">
          Waiting for launch data.
        </div>
      </section>
    );
  }

  const shouldLoop = highlights.length === 8;
  const marqueeItems = shouldLoop ? [...highlights, ...highlights] : highlights;

  return (
    <section className="py-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Highlight Bags</h2>
        <span className="rounded bg-white/70 px-2 py-1 font-mono text-xs font-semibold text-ink/55">
          {formatNumber(highlights.length)}
        </span>
      </div>
      <div className="relative overflow-hidden border border-ink/10 bg-white/35 py-4 shadow-line backdrop-blur-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#f7f4ef] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#f7f4ef] to-transparent" />
        <div className={`flex w-max gap-4 px-4 ${shouldLoop ? "highlight-marquee" : ""}`}>
          {marqueeItems.map((highlight, index) => (
            <HighlightTokenCard
              key={`${highlight.token.mint}-${index}`}
              highlight={highlight}
              ariaHidden={index >= highlights.length}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function HighlightTokenCard({ highlight, ariaHidden = false }: { highlight: Highlight; ariaHidden?: boolean }) {
  const { token } = highlight;

  return (
    <Link
      href={`/tokens/${token.mint}`}
      aria-hidden={ariaHidden}
      tabIndex={ariaHidden ? -1 : undefined}
      className="group relative w-[228px] shrink-0 overflow-hidden border border-white/65 bg-white/72 p-4 shadow-[0_16px_45px_rgba(18,20,23,0.12)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_20px_60px_rgba(18,20,23,0.18)]"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber via-green to-red opacity-85" />
      <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-ink/35 transition group-hover:text-ink" />
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/48">{highlight.label}</div>
      <div className="mt-4 flex items-center gap-3">
        <img
          src={token.imageUrl}
          alt=""
          className="h-14 w-14 rounded-full border border-white object-cover shadow-line"
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{token.name}</div>
          <div className="mt-1 inline-flex rounded bg-ink px-2 py-1 text-xs font-semibold text-panel">
            {formatTokenSymbol(token.symbol)}
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-end gap-2">
        <div className="text-4xl font-semibold leading-none">{highlight.value}</div>
        <div className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink/42">{highlight.metric}</div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3 text-xs font-semibold text-ink/45">
        <span>{formatNumber(token.holderCount)} holders</span>
        <span>{token.status ? token.status.replace("_", " ") : "live"}</span>
      </div>
    </Link>
  );
}
