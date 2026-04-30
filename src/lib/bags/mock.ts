import type { BagsHolder, BagsToken, BagsTrade, TokenSnapshot, WalletSignal } from "./types";

const now = Date.now();

export const mockTokens: BagsToken[] = [
  {
    mint: "Hype1wdK6UjVwP4nKYBki8NPvH3Rdr1FG9BwWkzBAGS",
    name: "Creator Hype",
    symbol: "HYPE",
    imageUrl: "https://dd.dexscreener.com/ds-data/tokens/solana/So11111111111111111111111111111111111111112.png",
    creator: "7Yf1N5Xsu5oQefwH9gR9rHqgzx4YcVb4aKh1ZKp1n2St",
    launchedAt: new Date(now - 11 * 60_000).toISOString(),
    holderCount: 184,
    marketCapUsd: 284_000,
    liquidityUsd: 49_500,
    lifetimeFeesSol: 18.4,
    score: {
      holderGrowth: 0.91,
      concentration: 0.72,
      smartWallet: 0.88,
      composite: 86
    },
    source: "mock",
    status: "PRE_GRAD"
  },
  {
    mint: "MuseZcTkX3ZzKqA3kzjrJRYfSCqvuLPcWAEg8zDxbags",
    name: "Meme Museum",
    symbol: "MUSE",
    imageUrl: "https://dd.dexscreener.com/ds-data/tokens/solana/Es9vMFrzaCERmJfrF4H2FYD4KCoJY6E65QAdawreUSDC.png",
    creator: "A3k8cPAZQSwKvCDq36BUfHXfUim6P86LfRYDWTNysr4G",
    launchedAt: new Date(now - 37 * 60_000).toISOString(),
    holderCount: 91,
    marketCapUsd: 96_000,
    liquidityUsd: 21_300,
    lifetimeFeesSol: 6.2,
    score: {
      holderGrowth: 0.66,
      concentration: 0.64,
      smartWallet: 0.58,
      composite: 63
    },
    source: "mock",
    status: "PRE_GRAD"
  },
  {
    mint: "TaleHqf5tW6KxS1wLq8bnr2ar4wQQnBJTgtd2Bags",
    name: "Story Coin",
    symbol: "TALE",
    imageUrl: "https://dd.dexscreener.com/ds-data/tokens/solana/So11111111111111111111111111111111111111112.png",
    creator: "GcbzYq7wQ4ZuRrSfuuYhZLs47RtbA4TdPBbRr7C4bV53",
    launchedAt: new Date(now - 68 * 60_000).toISOString(),
    holderCount: 42,
    marketCapUsd: 41_000,
    liquidityUsd: 12_100,
    lifetimeFeesSol: 1.7,
    score: {
      holderGrowth: 0.31,
      concentration: 0.39,
      smartWallet: 0.22,
      composite: 31
    },
    source: "mock",
    status: "MIGRATED"
  }
];

export const mockTrades: BagsTrade[] = [
  {
    signature: "5xD4j6JpFvYEzVMdCJin7g8Qfv4xbSmdGqYAXW4fQa3sL9Y1N5",
    mint: mockTokens[0].mint,
    buyer: "Alpha8mqS7XFApMfJRzP9eZm8V4sP5xcV8X9S3Y5vdr",
    side: "buy",
    solAmount: 3.2,
    tokenAmount: 1_840_000,
    priceUsd: 0.000154,
    timestamp: new Date(now - 2 * 60_000).toISOString()
  },
  {
    signature: "4NmN3sGpA9U1wmh6LUo87eAE9Z8J8FUHquK7yqRzAJpZ28R",
    mint: mockTokens[0].mint,
    buyer: "Signal38pBj3uaNhKmfZXW9BXn7CnxGL4qsTC9gMrb",
    side: "buy",
    solAmount: 1.1,
    tokenAmount: 612_000,
    priceUsd: 0.000149,
    timestamp: new Date(now - 5 * 60_000).toISOString()
  },
  {
    signature: "3XYdGEGh7wmqkS9kZe14xXGFgT51G5dg5tQGRbKRW5qgS5j",
    mint: mockTokens[0].mint,
    buyer: "Fresh7yLUEe6nGajvVQgVVAxJe9RiPYoNw4KcS4rC",
    side: "sell",
    solAmount: 0.4,
    tokenAmount: 191_000,
    priceUsd: 0.000151,
    timestamp: new Date(now - 8 * 60_000).toISOString()
  }
];

export const mockHolders: BagsHolder[] = [
  {
    wallet: "Alpha8mqS7XFApMfJRzP9eZm8V4sP5xcV8X9S3Y5vdr",
    balance: 7_420_000,
    pctSupply: 0.0742,
    firstSeenAt: new Date(now - 10 * 60_000).toISOString()
  },
  {
    wallet: "Signal38pBj3uaNhKmfZXW9BXn7CnxGL4qsTC9gMrb",
    balance: 4_110_000,
    pctSupply: 0.0411,
    firstSeenAt: new Date(now - 9 * 60_000).toISOString()
  },
  {
    wallet: "CreatorVaultxz2BqAMbMEQFzP5AFmfQqwZ3uT",
    balance: 3_980_000,
    pctSupply: 0.0398,
    firstSeenAt: new Date(now - 11 * 60_000).toISOString()
  },
  {
    wallet: "Fresh7yLUEe6nGajvVQgVVAxJe9RiPYoNw4KcS4rC",
    balance: 1_440_000,
    pctSupply: 0.0144,
    firstSeenAt: new Date(now - 8 * 60_000).toISOString()
  }
];

export const mockWallets: WalletSignal[] = [
  {
    wallet: "Alpha8mqS7XFApMfJRzP9eZm8V4sP5xcV8X9S3Y5vdr",
    alphaScore: 92,
    winningCalls: 18,
    losingCalls: 4,
    lastActiveAt: new Date(now - 2 * 60_000).toISOString()
  },
  {
    wallet: "Signal38pBj3uaNhKmfZXW9BXn7CnxGL4qsTC9gMrb",
    alphaScore: 81,
    winningCalls: 11,
    losingCalls: 5,
    lastActiveAt: new Date(now - 5 * 60_000).toISOString()
  },
  {
    wallet: "Fresh7yLUEe6nGajvVQgVVAxJe9RiPYoNw4KcS4rC",
    alphaScore: 47,
    winningCalls: 3,
    losingCalls: 6,
    lastActiveAt: new Date(now - 8 * 60_000).toISOString()
  }
];

export const mockSnapshot: TokenSnapshot = {
  token: mockTokens[0],
  trades: mockTrades,
  holders: mockHolders,
  wallets: mockWallets
};
