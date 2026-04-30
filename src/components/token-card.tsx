import Link from "next/link";
import { ArrowUpRight, BellRing, Users } from "lucide-react";
import type { BagsToken } from "@/lib/bags/types";
import { compactAddress, formatNumber, formatPercent } from "@/lib/utils";
import { ScoreRing } from "./score-ring";

type TokenCardProps = {
  token: BagsToken;
};

export function TokenCard({ token }: TokenCardProps) {
  return (
    <Link
      href={`/tokens/${token.mint}`}
      className="grid gap-4 border-b border-ink/10 bg-panel/90 p-4 transition hover:bg-white/90 md:grid-cols-[auto_1fr_auto]"
    >
      <img
        src={token.imageUrl}
        alt=""
        className="h-14 w-14 rounded-md border border-ink/10 object-cover"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-lg font-semibold">{token.name}</h2>
          <span className="rounded bg-ink px-2 py-1 text-xs font-semibold text-panel">{token.symbol}</span>
          <span className="rounded bg-field px-2 py-1 font-mono text-xs font-semibold text-ink">
            {compactAddress(token.mint, 6)}
          </span>
          {token.status ? (
            <span className="rounded border border-ink/10 px-2 py-1 text-xs font-semibold text-ink/60">
              {token.status.replace("_", " ")}
            </span>
          ) : null}
          {token.score && token.score.composite >= 75 ? (
            <span className="inline-flex items-center gap-1 rounded bg-green/10 px-2 py-1 text-xs font-semibold text-green">
              <BellRing className="h-3.5 w-3.5" />
              Pro alert
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/70">
          <span className="inline-flex items-center gap-1">
            <Users className="h-4 w-4" />
            {formatNumber(token.holderCount)} holders
          </span>
          <span>${formatNumber(token.marketCapUsd, { maximumFractionDigits: 0 })} mcap</span>
          <span>{token.score ? `${formatPercent(token.score.smartWallet)} smart-wallet signal` : "score loading"}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 md:justify-end">
        <ScoreRing score={token.score?.composite ?? null} />
        <ArrowUpRight className="h-5 w-5 text-ink/50" />
      </div>
    </Link>
  );
}
