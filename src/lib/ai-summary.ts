import { env } from "@/lib/env";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";
const MAX_RETRIES = 3;
const HTTP_TIMEOUT_MS = 30_000;

export type TokenSummaryInput = {
  symbol: string;
  dataThrough: string;
  score: number;
  tier: string;
  scoreChange24h: number | null;
  concentrationScore: number;
  top5HolderPct: number;
  alphaWalletCount: number;
  alphaValueUsd: number | null;
  marketCapUsd: number | null;
  feeVelocity24h: number | null;
  riskFlags: string[];
  recentAlerts: {
    threshold: number;
    timestamp: string;
  }[];
};

export type TokenSummaryResult = {
  summary: string;
  generatedAt: Date;
};

class DeepSeekError extends Error {}

export async function generateTokenAiSummary(input: TokenSummaryInput): Promise<TokenSummaryResult> {
  const generatedAt = new Date();

  if (!env.DEEPSEEK_API_KEY) {
    return fallbackSummary(input, generatedAt);
  }

  try {
    const body = await callDeepSeek(buildPrompt(input));
    return {
      summary: withFooter(body, input.dataThrough),
      generatedAt
    };
  } catch (error) {
    console.error(`AI summary failed for ${input.symbol}:`, error);
    return fallbackSummary(input, generatedAt);
  }
}

function buildPrompt(input: TokenSummaryInput) {
  return `You are an on-chain alpha analyst. Based on the Bags.fm creator-token data below, write a 3-5 sentence English brief that explains the current holder structure, risk signals, and market momentum. End with one clear watchlist tag: High / Medium / Low / Pass.

Rules:
- Output English only.
- Do not make price predictions.
- Do not tell users to buy or sell.
- Do not repeat every number mechanically; interpret what the data implies.
- Do not start with filler such as "I hear you" or generic disclaimers.
- Keep it between 70 and 120 words.
- No bullet lists, tables, or numbered sections.
- If a field says "not yet indexed" or "not enough history", say the dataset is still incomplete instead of treating it as a bearish signal.

Data through: ${input.dataThrough}
- score: ${Math.round(input.score)}/100 (${input.tier}), 24h change ${formatDelta(input.scoreChange24h)}
- holder concentration: ${Math.round(input.concentrationScore)}/100 (top 5 hold ${input.top5HolderPct.toFixed(1)}%)
- alpha wallets: ${input.alphaWalletCount} observed (tracked value ${formatUsdOrUnavailable(input.alphaValueUsd)})
- market cap: ${formatUsdOrUnavailable(input.marketCapUsd)}, 24h fee velocity ${formatRatio(input.feeVelocity24h)}
- risk flags: ${formatRiskFlags(input.riskFlags)}
- alerts in the last 7 days: ${formatAlerts(input.recentAlerts)}

Output format: [state sentence]. [key signal sentence]. [risk/opportunity contrast sentence]. **Watch label: X**`;
}

async function callDeepSeek(prompt: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(DEEPSEEK_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 250,
          temperature: 0.6,
          stream: false
        })
      });
      const text = await response.text();

      if (response.status === 429) {
        lastError = new DeepSeekError(`DeepSeek 429: ${text.slice(0, 200)}`);
        await sleep([10_000, 30_000, 60_000][attempt]);
        continue;
      }

      if (response.status >= 500) {
        lastError = new DeepSeekError(`DeepSeek ${response.status}: ${text.slice(0, 200)}`);
        await sleep([1_000, 2_000, 4_000][attempt]);
        continue;
      }

      if (!response.ok) {
        throw new DeepSeekError(`DeepSeek ${response.status}: ${text.slice(0, 200)}`);
      }

      const json = JSON.parse(text) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new DeepSeekError(`DeepSeek response missing content: ${text.slice(0, 200)}`);
      }

      return content;
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES - 1) {
        await sleep([1_000, 2_000, 4_000][attempt]);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new DeepSeekError(String(lastError));
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackSummary(input: TokenSummaryInput, generatedAt: Date): TokenSummaryResult {
  return {
    summary: withFooter("AI brief is temporarily unavailable. Use the score breakdown and holder data below for the current signal view.", input.dataThrough),
    generatedAt
  };
}

function withFooter(body: string, dataThrough: string) {
  return `${body}\n\n*AI-generated from on-chain data through ${dataThrough}. Not financial advice.*`;
}

function formatAlerts(alerts: TokenSummaryInput["recentAlerts"]) {
  if (!alerts.length) {
    return "none";
  }

  const items = alerts.slice(0, 5).map((alert) => `${alert.threshold} threshold crossed (${alert.timestamp.slice(0, 10)})`);
  return `${alerts.length} alert${alerts.length === 1 ? "" : "s"}: ${items.join(", ")}`;
}

function formatRiskFlags(flags: string[]) {
  return flags.length ? flags.join(", ") : "no major flags";
}

function formatDelta(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "not enough history";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatRatio(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return "not yet indexed";
  }

  return `${value.toFixed(2)}x`;
}

function formatUsdOrUnavailable(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return "not yet indexed";
  }

  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
