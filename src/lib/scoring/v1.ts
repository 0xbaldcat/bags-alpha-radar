export type RealHolder = {
  wallet: string;
  balance: number;
  pct: number;
};

export type ScoreWeights = {
  holderGrowth: number;
  concentration: number;
  smartWallet: number;
};

export type ScoreInputs = {
  launchedAt: Date;
  status: "PRE_LAUNCH" | "PRE_GRAD" | "MIGRATING" | "MIGRATED";
  currentHolderCount: number;
  realHolders: RealHolder[];
  weights: ScoreWeights;
  now?: Date;
};

export type ScoreOutput = {
  holderGrowth: number;
  concentration: number;
  smartWallet: number;
  composite: number;
  computedAt: Date;
  notes: string[];
};

// Current Bags PRE_GRAD launches are sparse: most fresh tokens have 0-3 real
// holders after bonding-curve exclusion, and only the first live alert had 19.
// Keep the cold-start target reachable until enough mature samples exist for
// the z-score baseline in docs/SCORING.md Sec 1.
const HOLDER_GROWTH_COLD_START_TARGET = 20;
const HHI_REF = 0.5;

export function computeScoreV1(input: ScoreInputs): ScoreOutput {
  const computedAt = input.now ?? new Date();
  const notes: string[] = ["cold_start_baseline", "smart_wallet_neutral_until_trade_ingestion"];
  const holderGrowth = computeHolderGrowthScore(input.launchedAt, input.currentHolderCount, computedAt);
  const concentration = computeConcentrationScore(input.realHolders, notes);
  const smartWallet = 0.5;
  const weights = normalizeWeights(input.weights);
  const lifecycleMultiplier = input.status === "MIGRATED" ? 0.75 : 1;
  const rawComposite = 100 * (
    weights.holderGrowth * holderGrowth +
    weights.concentration * concentration +
    weights.smartWallet * smartWallet
  );
  const composite = Math.round(clamp(rawComposite * lifecycleMultiplier, 0, 100));

  if (input.status === "MIGRATED") {
    notes.push("migrated_lifecycle_discount");
  }

  return {
    holderGrowth,
    concentration,
    smartWallet,
    composite,
    computedAt,
    notes
  };
}

function computeHolderGrowthScore(launchedAt: Date, currentHolderCount: number, now: Date) {
  const ageMinutes = Math.max(1, (now.getTime() - launchedAt.getTime()) / 60_000);
  const projectedFirstHour = ageMinutes < 60
    ? currentHolderCount * (60 / ageMinutes)
    : currentHolderCount;

  return clamp(projectedFirstHour / HOLDER_GROWTH_COLD_START_TARGET, 0, 1);
}

function computeConcentrationScore(realHolders: RealHolder[], notes: string[]) {
  if (!realHolders.length) {
    notes.push("no_real_holders_after_exclusion");
    return 0.5;
  }

  if (realHolders.length < 3) {
    notes.push("few_real_holders");
    return 0.2;
  }

  const totalPct = realHolders.reduce((sum, holder) => sum + holder.pct, 0);

  if (!totalPct) {
    notes.push("zero_real_holder_pct");
    return 0.5;
  }

  const herfindahl = realHolders.reduce((sum, holder) => {
    const normalizedPct = holder.pct / totalPct;
    return sum + normalizedPct ** 2;
  }, 0);

  return clamp(1 - herfindahl / HHI_REF, 0, 1);
}

function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const total = weights.holderGrowth + weights.concentration + weights.smartWallet;

  if (!Number.isFinite(total) || total <= 0) {
    return { holderGrowth: 0.4, concentration: 0.3, smartWallet: 0.3 };
  }

  return {
    holderGrowth: weights.holderGrowth / total,
    concentration: weights.concentration / total,
    smartWallet: weights.smartWallet / total
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
