import type { BagsHolder, BagsTrade, TokenScore, WalletSignal } from "@/lib/bags/types";

export function computeScore(input: {
  holderCount: number;
  holders: BagsHolder[];
  trades: BagsTrade[];
  wallets: WalletSignal[];
}): TokenScore {
  const holderGrowth = Math.min(1, input.holderCount / 200);
  const concentration = concentrationScore(input.holders);
  const smartWallet = smartWalletScore(input.wallets, input.trades);

  return {
    holderGrowth,
    concentration,
    smartWallet,
    composite: Math.round(holderGrowth * 40 + concentration * 30 + smartWallet * 30)
  };
}

function concentrationScore(holders: BagsHolder[]) {
  if (!holders.length) {
    return 0.5;
  }

  const herfindahl = holders.reduce((sum, holder) => sum + holder.pctSupply ** 2, 0);
  return Math.max(0, Math.min(1, 1 - herfindahl * 12));
}

function smartWalletScore(wallets: WalletSignal[], trades: BagsTrade[]) {
  if (!wallets.length || !trades.length) {
    return 0.35;
  }

  const walletScores = new Map(wallets.map((wallet) => [wallet.wallet, wallet.alphaScore]));
  const buyTrades = trades.filter((trade) => trade.side === "buy");
  const smartBuyVolume = buyTrades.reduce((sum, trade) => {
    const alphaScore = walletScores.get(trade.buyer) ?? 0;
    return sum + (alphaScore >= 75 ? trade.solAmount : 0);
  }, 0);
  const totalBuyVolume = buyTrades.reduce((sum, trade) => sum + trade.solAmount, 0);

  if (!totalBuyVolume) {
    return 0.35;
  }

  return Math.max(0, Math.min(1, smartBuyVolume / totalBuyVolume));
}
