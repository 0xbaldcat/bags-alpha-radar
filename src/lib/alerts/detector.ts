import type { BagsToken } from "@/lib/bags/types";
import type { AlertEvent } from "./types";

export function detectAlert(token: BagsToken, threshold = 75): AlertEvent | null {
  if (!token.score || token.score.composite < threshold) {
    return null;
  }

  const reason = [
    token.score.holderGrowth >= 0.75 ? "holder growth" : null,
    token.score.smartWallet >= 0.75 ? "smart-wallet volume" : null,
    token.score.concentration >= 0.7 ? "healthy holder distribution" : null
  ].filter(Boolean).join(" + ");

  return {
    token,
    reason: reason ? `Fresh launch crossed threshold on ${reason}.` : "Fresh launch crossed the alpha threshold.",
    score: token.score.composite,
    createdAt: new Date().toISOString(),
    source: "bags"
  };
}
