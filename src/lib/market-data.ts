const DEXSCREENER_BATCH_SIZE = 30;
const DEXSCREENER_URL = "https://api.dexscreener.com/tokens/v1/solana";

export type TokenMarketData = {
  mint: string;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  updatedAt: Date;
};

type DexScreenerPair = {
  chainId?: string;
  pairAddress?: string;
  baseToken?: {
    address?: string;
  };
  marketCap?: number;
  fdv?: number;
  liquidity?: {
    usd?: number;
  };
  volume?: {
    h24?: number;
  };
};

export async function fetchSolanaMarketData(mints: string[]): Promise<Map<string, TokenMarketData>> {
  const uniqueMints = [...new Set(mints.filter(Boolean))];
  const results = new Map<string, TokenMarketData>();

  for (let index = 0; index < uniqueMints.length; index += DEXSCREENER_BATCH_SIZE) {
    const batch = uniqueMints.slice(index, index + DEXSCREENER_BATCH_SIZE);
    const response = await fetch(`${DEXSCREENER_URL}/${batch.join(",")}`, {
      headers: { accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`DexScreener market data failed: ${response.status} ${await response.text()}`);
    }

    const pairs = await response.json() as DexScreenerPair[];
    const byMint = bestPairsByMint(pairs);
    const updatedAt = new Date();

    for (const mint of batch) {
      const pair = byMint.get(mint);

      results.set(mint, {
        mint,
        marketCapUsd: positiveNumber(pair?.marketCap) ?? positiveNumber(pair?.fdv) ?? null,
        liquidityUsd: positiveNumber(pair?.liquidity?.usd) ?? null,
        updatedAt
      });
    }
  }

  return results;
}

function bestPairsByMint(pairs: DexScreenerPair[]) {
  const result = new Map<string, DexScreenerPair>();

  for (const pair of pairs) {
    if (pair.chainId !== "solana" || !pair.baseToken?.address) {
      continue;
    }

    const current = result.get(pair.baseToken.address);

    if (!current || pairRank(pair) > pairRank(current)) {
      result.set(pair.baseToken.address, pair);
    }
  }

  return result;
}

function pairRank(pair: DexScreenerPair) {
  return (positiveNumber(pair.liquidity?.usd) ?? 0) * 10 + (positiveNumber(pair.volume?.h24) ?? 0);
}

function positiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
