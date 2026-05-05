import { BagsSDK } from "@bagsfm/bags-sdk";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { env, requireEnv } from "@/lib/env";
import { bagsRateLimit } from "@/lib/rate-limit";
import { mockHolders, mockSnapshot, mockTokens, mockTrades, mockWallets } from "./mock";
import type { BagsHolder, BagsToken, BagsTrade, TokenLaunchFeedItem, TokenSnapshot, WalletSignal } from "./types";

const BAGS_BASE_URL = "https://public-api-v2.bags.fm/api/v1";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qP1xzybapC8G4wEGGkZwyTDt1v";
const RATE_LIMIT_ERROR_PATTERN = /429|too many requests|max usage reached/i;

type BagsApiResponse<T> = {
  success: boolean;
  response?: T;
  error?: string;
};

export class BagsApi {
  private readonly apiKey?: string;
  private readonly connection: Connection;
  private readonly rpcConnections: Connection[];
  private readonly heliusRpcUrls: string[];
  readonly sdk?: BagsSDK;

  constructor(apiKey = env.BAGS_API_KEY) {
    this.apiKey = apiKey;
    this.heliusRpcUrls = uniqueRpcUrls([
      env.SOLANA_RPC_URL,
      ...parseRpcFallbacks(env.SOLANA_RPC_URL_FALLBACKS)
    ]);
    this.rpcConnections = this.heliusRpcUrls.map((url) => new Connection(url, "processed"));
    this.connection = this.rpcConnections[0] ?? new Connection(env.SOLANA_RPC_URL, "processed");
    this.sdk = apiKey ? new BagsSDK(apiKey, this.connection, "processed") : undefined;
  }

  hasCredentials() {
    return Boolean(this.apiKey);
  }

  async me() {
    if (!this.sdk) {
      return null;
    }

    return this.sdk.auth.me();
  }

  async getTopTokens(): Promise<BagsToken[]> {
    if (!this.sdk) {
      return mockTokens;
    }

    const leaderboard = await this.sdk.state.getTopTokensByLifetimeFees();

    return leaderboard.slice(0, 20).map((item, index) => {
      const tokenInfo = item.tokenInfo;
      const createdAt = tokenInfo?.firstPool?.createdAt ?? new Date().toISOString();
      const holderGrowth = normalize(tokenInfo?.stats1h?.holderChange ?? tokenInfo?.holderCount ?? 0, 250);
      const concentration = tokenInfo?.audit?.topHoldersPercentage
        ? Math.max(0, 1 - tokenInfo.audit.topHoldersPercentage / 100)
        : 0.5;
      const smartWallet = Math.max(0.2, 0.9 - index * 0.035);
      const composite = Math.round(holderGrowth * 40 + concentration * 30 + smartWallet * 30);

      return {
        mint: item.token,
        name: tokenInfo?.name ?? `Bags Token ${index + 1}`,
        symbol: tokenInfo?.symbol ?? "BAGS",
        imageUrl: tokenInfo?.icon ?? mockTokens[index % mockTokens.length].imageUrl,
        creator: tokenInfo?.dev ?? item.creators?.[0]?.wallet ?? "unknown",
        launchedAt: createdAt,
        holderCount: tokenInfo?.holderCount ?? 0,
        marketCapUsd: tokenInfo?.mcap ?? tokenInfo?.fdv ?? 0,
        liquidityUsd: tokenInfo?.liquidity ?? 0,
        lifetimeFeesSol: Number(item.lifetimeFees ?? 0) / 1_000_000_000,
        score: {
          holderGrowth,
          concentration,
          smartWallet,
          composite
        },
        source: "top-fee-fixture",
        status: tokenInfo?.graduatedAt ? "MIGRATED" : "PRE_GRAD"
      };
    });
  }

  async getLaunchFeed(): Promise<BagsToken[]> {
    if (!this.sdk) {
      return mockTokens;
    }

    const feed = await this.getLaunchFeedItems();

    return feed
      .filter((item) => item.status !== "MIGRATED")
      .sort((a, b) => statusPriority(a.status) - statusPriority(b.status))
      .slice(0, 30)
      .map((item) => {
      return {
        mint: item.tokenMint,
        name: item.name,
        symbol: item.symbol,
        imageUrl: item.image,
        creator: item.accountKeys?.[0] ?? "unknown",
        launchedAt: new Date().toISOString(),
        holderCount: 0,
        marketCapUsd: 0,
        liquidityUsd: 0,
        lifetimeFeesSol: 0,
        source: "launch-feed",
        status: item.status,
        score: null
      };
    });
  }

  async getLaunchFeedItems(): Promise<TokenLaunchFeedItem[]> {
    return this.raw<TokenLaunchFeedItem[]>("/token-launch/feed");
  }

  async getRadarTokens(): Promise<BagsToken[]> {
    if (!this.sdk) {
      return mockTokens;
    }

    try {
      const launchFeed = await this.getLaunchFeed();
      if (launchFeed.length) {
        return launchFeed;
      }
    } catch (error) {
      console.warn("Falling back to top-fee token fixtures:", error);
    }

    return this.getTopTokens();
  }

  async getTokenSnapshot(mint: string): Promise<TokenSnapshot> {
    if (!this.sdk) {
      return {
        ...mockSnapshot,
        token: mockTokens.find((token) => token.mint === mint) ?? mockSnapshot.token
      };
    }

    const tokens = await this.getRadarTokens();
    const token = tokens.find((item) => item.mint === mint) ?? tokens[0] ?? mockSnapshot.token;
    const [creators, claimEvents, quote, rpcHolders] = await Promise.allSettled([
      this.sdk.state.getTokenCreators(new PublicKey(mint)),
      this.sdk.state.getTokenClaimEvents(new PublicKey(mint), { limit: 5 }),
      this.sdk.trade.getQuote({
        inputMint: new PublicKey(SOL_MINT),
        outputMint: new PublicKey(mint),
        amount: 10_000_000,
        slippageMode: "auto"
      }),
      this.getLargestSystemOwnedHolders(mint)
    ]);

    const trades: BagsTrade[] = claimEvents.status === "fulfilled"
      ? claimEvents.value.slice(0, 5).map((event) => ({
          signature: event.signature,
          mint,
          buyer: event.wallet,
          side: "buy",
          solAmount: Number(event.amount) / 1_000_000_000,
          tokenAmount: 0,
          priceUsd: quote.status === "fulfilled" ? Number(quote.value.priceImpactPct) || 0 : 0,
          timestamp: new Date(event.timestamp * 1000).toISOString()
        }))
      : mockTrades;

    const creatorHolders: BagsHolder[] = creators.status === "fulfilled"
      ? creators.value.filter((creator) => creator.royaltyBps > 0).map((creator) => ({
          wallet: creator.wallet,
          balance: 0,
          pctSupply: creator.royaltyBps / 10_000,
          firstSeenAt: token.launchedAt
        }))
      : mockHolders;
    const holders = rpcHolders.status === "fulfilled" && rpcHolders.value.length
      ? rpcHolders.value
      : creatorHolders;

    const wallets: WalletSignal[] = holders.slice(0, 5).map((holder, index) => ({
      wallet: holder.wallet,
      alphaScore: Math.max(35, 92 - index * 9),
      winningCalls: Math.max(0, 18 - index * 4),
      losingCalls: index + 2,
      lastActiveAt: new Date().toISOString()
    }));

    return {
      token,
      trades,
      holders,
      wallets: wallets.length ? wallets : mockWallets
    };
  }

  async getQuote(outputMint: string) {
    if (!this.sdk) {
      return null;
    }

    return this.sdk.trade.getQuote({
      inputMint: new PublicKey(USDC_MINT),
      outputMint: new PublicKey(outputMint),
      amount: 1_000_000,
      slippageMode: "auto"
    });
  }

  async getLargestSystemOwnedHolders(mint: string, limit = 20): Promise<BagsHolder[]> {
    try {
      const heliusHolders = await this.getHeliusTokenAccounts(mint, limit);
      if (heliusHolders.length) {
        return heliusHolders;
      }
    } catch (error) {
      if (env.SOLANA_RPC_SKIP_PUBLIC_FALLBACK && isRateLimitError(error)) {
        console.warn("Skipping public Solana holder fallback after RPC rate limit:", formatError(error));
        return [];
      }

      console.warn("Falling back to Solana token-largest-accounts holder path:", error);
    }

    return this.getLargestSystemOwnedHoldersViaStandardRpc(mint, limit);
  }

  private async getLargestSystemOwnedHoldersViaStandardRpc(mint: string, limit: number): Promise<BagsHolder[]> {
    let lastError: unknown;

    for (const connection of this.rpcConnections) {
      try {
        return await this.getLargestSystemOwnedHoldersFromConnection(connection, mint, limit);
      } catch (error) {
        lastError = error;

        if (!isRateLimitError(error)) {
          throw error;
        }
      }
    }

    throw lastError ?? new Error("No Solana RPC connection configured");
  }

  private async getLargestSystemOwnedHoldersFromConnection(
    connection: Connection,
    mint: string,
    limit: number
  ): Promise<BagsHolder[]> {
    const tokenMint = new PublicKey(mint);
    const [largestAccounts, supply] = await Promise.all([
      connection.getTokenLargestAccounts(tokenMint, "processed"),
      connection.getTokenSupply(tokenMint, "processed")
    ]);
    const supplyAmount = Number(supply.value.amount);

    if (!supplyAmount) {
      return [];
    }

    const candidateAccounts = largestAccounts.value.slice(0, limit);
    const parsedAccounts = await connection.getMultipleParsedAccounts(
      candidateAccounts.map((account) => account.address),
      { commitment: "processed" }
    );
    const candidates = parsedAccounts.value.flatMap((accountInfo, index) => {
      const data = accountInfo?.data;

      if (!data || typeof data === "string" || !("parsed" in data)) {
        return [];
      }

      const owner = data.parsed?.info?.owner;
      const amount = Number(data.parsed?.info?.tokenAmount?.amount ?? candidateAccounts[index].amount);

      if (!owner || !amount) {
        return [];
      }

      return [{ owner, amount }];
    });
    const ownerAccounts = await connection.getMultipleAccountsInfo(
      candidates.map((candidate) => new PublicKey(candidate.owner)),
      "processed"
    );

    return candidates.flatMap((candidate, index) => {
      const ownerAccount = ownerAccounts[index];

      if (ownerAccount && !ownerAccount.owner.equals(SystemProgram.programId)) {
        return [];
      }

      return [{
        wallet: candidate.owner,
        balance: candidate.amount / 10 ** supply.value.decimals,
        pctSupply: candidate.amount / supplyAmount,
        firstSeenAt: new Date().toISOString()
      }];
    });
  }

  private async getHeliusTokenAccounts(mint: string, limit = 20): Promise<BagsHolder[]> {
    let lastError: unknown;

    for (const url of this.heliusRpcUrls) {
      try {
        return await this.getHeliusTokenAccountsFromUrl(url, mint, limit);
      } catch (error) {
        lastError = error;

        if (!isRateLimitError(error)) {
          throw error;
        }
      }
    }

    throw lastError ?? new Error("No Solana RPC URL configured");
  }

  private async getHeliusTokenAccountsFromUrl(url: string, mint: string, limit = 20): Promise<BagsHolder[]> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "bags-radar-holders",
        method: "getTokenAccounts",
        params: {
          mint,
          page: 1,
          limit,
          options: { showZeroBalance: false }
        }
      })
    });
    const json = await response.json();

    if (!response.ok || json.error) {
      throw new Error(json.error?.message ?? `Helius getTokenAccounts failed: ${response.status}`);
    }

    const accounts = (json.result?.token_accounts ?? []) as {
      owner?: string;
      amount?: number | string;
    }[];
    const totalAmount = accounts.reduce((sum, account) => sum + Number(account.amount ?? 0), 0);

    if (!totalAmount) {
      return [];
    }

    const candidates = accounts.flatMap((account) => {
      const amount = Number(account.amount ?? 0);

      if (!account.owner || !amount) {
        return [];
      }

      return [{ owner: account.owner, amount }];
    });
    const ownerAccounts = await this.connection.getMultipleAccountsInfo(
      candidates.map((candidate) => new PublicKey(candidate.owner)),
      "processed"
    );

    return candidates.flatMap((candidate, index) => {
      const ownerAccount = ownerAccounts[index];

      if (ownerAccount && !ownerAccount.owner.equals(SystemProgram.programId)) {
        return [];
      }

      return [{
        wallet: candidate.owner,
        balance: candidate.amount,
        pctSupply: candidate.amount / totalAmount,
        firstSeenAt: new Date().toISOString()
      }];
    });
  }

  async raw<T>(path: string, init?: RequestInit): Promise<T> {
    const apiKey = requireEnv("BAGS_API_KEY");
    if (!bagsRateLimit.canSpend()) {
      throw new Error("Bags API hourly request budget exhausted");
    }

    bagsRateLimit.spend();
    const response = await fetch(`${BAGS_BASE_URL}${path}`, {
      ...init,
      headers: {
        "x-api-key": apiKey,
        "content-type": "application/json",
        ...init?.headers
      }
    });
    bagsRateLimit.observe(response.headers);
    const json = (await response.json()) as BagsApiResponse<T>;

    if (!response.ok || !json.success) {
      throw new Error(json.error ?? `Bags API request failed: ${response.status}`);
    }

    return json.response as T;
  }
}

function normalize(value: number, max: number) {
  return Math.max(0, Math.min(1, value / max));
}

function parseRpcFallbacks(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueRpcUrls(urls: string[]) {
  return [...new Set(urls.filter(Boolean))];
}

function isRateLimitError(error: unknown) {
  return RATE_LIMIT_ERROR_PATTERN.test(formatError(error));
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function statusPriority(status: TokenLaunchFeedItem["status"]) {
  switch (status) {
    case "PRE_GRAD":
      return 0;
    case "PRE_LAUNCH":
      return 1;
    case "MIGRATING":
      return 2;
    case "MIGRATED":
      return 3;
  }
}


export const bagsApi = new BagsApi();
