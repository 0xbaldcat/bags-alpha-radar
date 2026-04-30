export type BagsToken = {
  mint: string;
  name: string;
  symbol: string;
  imageUrl: string;
  creator: string;
  launchedAt: string;
  holderCount: number;
  marketCapUsd: number;
  liquidityUsd: number;
  lifetimeFeesSol: number;
  score: TokenScore | null;
  source: "launch-feed" | "top-fee-fixture" | "mock";
  status?: "PRE_LAUNCH" | "PRE_GRAD" | "MIGRATING" | "MIGRATED";
};

export type TokenScore = {
  holderGrowth: number;
  concentration: number;
  smartWallet: number;
  composite: number;
};

export type BagsTrade = {
  signature: string;
  mint: string;
  buyer: string;
  side: "buy" | "sell";
  solAmount: number;
  tokenAmount: number;
  priceUsd: number;
  timestamp: string;
};

export type BagsHolder = {
  wallet: string;
  balance: number;
  pctSupply: number;
  firstSeenAt: string;
};

export type WalletSignal = {
  wallet: string;
  alphaScore: number;
  winningCalls: number;
  losingCalls: number;
  lastActiveAt: string;
};

export type TokenSnapshot = {
  token: BagsToken;
  trades: BagsTrade[];
  holders: BagsHolder[];
  wallets: WalletSignal[];
};

export type TokenLaunchFeedItem = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  tokenMint: string;
  status: "PRE_LAUNCH" | "PRE_GRAD" | "MIGRATING" | "MIGRATED";
  twitter?: string | null;
  website?: string | null;
  launchSignature?: string | null;
  accountKeys?: string[] | null;
  numRequiredSigners?: number | null;
  uri?: string | null;
  dbcPoolKey?: string | null;
  dbcConfigKey?: string | null;
};
