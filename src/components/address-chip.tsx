"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn, compactAddress } from "@/lib/utils";

type AddressChipProps = {
  address: string;
  chars?: number;
  className?: string;
};

export function AddressChip({ address, chars = 5, className }: AddressChipProps) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void copyAddress();
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded border border-ink/10 bg-field px-2 py-1 font-mono text-xs font-semibold text-ink transition hover:border-ink/25 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber/40",
          className
        )}
        aria-label={`Copy address ${address}`}
      >
        <span>{compactAddress(address, chars)}</span>
        {copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5 text-ink/45" />}
      </button>
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden max-w-[min(360px,80vw)] rounded border border-ink/10 bg-ink px-3 py-2 font-mono text-xs font-semibold text-panel shadow-line group-hover:block group-focus-within:block">
        {address}
      </span>
    </span>
  );
}
