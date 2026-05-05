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
  scoreChange24h: number;
  concentrationScore: number;
  top5HolderPct: number;
  alphaWalletCount: number;
  alphaValueUsd: number;
  marketCapUsd: number;
  feeVelocity24h: number;
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
  return `你是一个 on-chain alpha 分析师。基于下面这个 Bags.fm 创作者代币的链上数据,写一段 3-5 句话的中文分析,告诉用户当前持有人结构、风险信号和市场动能是什么状态,最后给一个明确的"建议关注度"标签(高 / 中 / 低 / 观望)。

硬规则:
- 不要给价格预测,不要说"buy"/"sell"/"做多"/"做空"。
- 不要复述数字本身,要解读数字告诉我们的事实。
- 不要使用首句接纳类开场。直接进入事实。
- 使用中文标点。
- 80-130 字之间,不要列表 / 表格 / 编号。

数据(数据时间: ${input.dataThrough}):
- score: ${Math.round(input.score)}/100(${input.tier}),24h 变化 ${formatSigned(input.scoreChange24h)}
- holder concentration: ${Math.round(input.concentrationScore)}/100(top 5 占 ${input.top5HolderPct.toFixed(1)}%)
- alpha wallets: ${input.alphaWalletCount} 个持有(总价值 $${Math.round(input.alphaValueUsd).toLocaleString("en-US")})
- market cap: $${Math.round(input.marketCapUsd).toLocaleString("en-US")},24h fee velocity ${input.feeVelocity24h.toFixed(2)}x
- 风险旗标: ${formatRiskFlags(input.riskFlags)}
- 过去 7 天告警: ${formatAlerts(input.recentAlerts)}

输出格式: [一句状态描述]。[一句关键信号]。[一句风险或机会的对照]。**建议关注度: X**`;
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
    summary: withFooter("AI 摘要暂时不可用。请直接查看下方各维度详细数据。", input.dataThrough),
    generatedAt
  };
}

function withFooter(body: string, dataThrough: string) {
  return `${body}\n\n*AI 自动生成,基于 ${dataThrough} 链上数据。非投资建议。*`;
}

function formatAlerts(alerts: TokenSummaryInput["recentAlerts"]) {
  if (!alerts.length) {
    return "无";
  }

  const items = alerts.slice(0, 5).map((alert) => `${alert.threshold} 分跨线 (${alert.timestamp.slice(0, 10)})`);
  return `${alerts.length} 次告警: ${items.join(", ")}`;
}

function formatRiskFlags(flags: string[]) {
  return flags.length ? flags.join(", ") : "无显著旗标";
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
