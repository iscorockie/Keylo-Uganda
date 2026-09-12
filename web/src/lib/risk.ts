/**
 * Risk scoring: combine gnuGrid mobile score + internal asset score,
 * then bucket into a tier and produce a recommended structure.
 */

export type RiskRules = {
  weights: { gnuGrid: number; asset: number };
  tiers: { tier: string; min: number; maxLtv: number }[];
};

export const DEFAULT_RULES: RiskRules = {
  weights: { gnuGrid: 0.6, asset: 0.4 },
  tiers: [
    { tier: "A", min: 700, maxLtv: 0.75 },
    { tier: "B", min: 600, maxLtv: 0.6 },
    { tier: "C", min: 500, maxLtv: 0.5 },
    { tier: "D", min: 0, maxLtv: 0.4 },
  ],
};

export function parseRules(config: string): RiskRules {
  try {
    const parsed = JSON.parse(config);
    return { ...DEFAULT_RULES, ...parsed, tiers: parsed.tiers ?? DEFAULT_RULES.tiers };
  } catch {
    return DEFAULT_RULES;
  }
}

export type StructureInput = {
  assetValue: number; // vehicle market value
  desiredAmount?: number; // amount to finance
};

export type RiskOutput = {
  combinedScore: number;
  tier: string;
  maxLtv: number;
  gnuGridScore: number;
  internalAssetScore: number;
  explanation: string[];
  recommended: { deposit: number; termMonths: number; monthlyAmount: number; financed: number };
};

/**
 * internalAssetScore: 0–100 based on how well the asset covers the desired
 * finance amount (LTV). Lower LTV → higher score.
 */
function assetScore(assetValue: number, desiredAmount: number): number {
  const ltv = desiredAmount / Math.max(assetValue, 1);
  return Math.round(Math.max(0, Math.min(100, (1 - ltv) * 100)));
}

export function computeRisk(
  rules: RiskRules,
  gnuGrid: number,
  input: StructureInput,
): RiskOutput {
  const desired = input.desiredAmount ?? input.assetValue * 0.7;
  const internalAssetScore = assetScore(input.assetValue, desired);
  const combined = Math.round(
    gnuGrid * rules.weights.gnuGrid + internalAssetScore * (rules.weights.asset * 10),
  );

  const tierRow =
    [...rules.tiers].sort((a, b) => b.min - a.min).find((t) => combined >= t.min) ??
    rules.tiers[rules.tiers.length - 1];

  const ltv = desired / Math.max(input.assetValue, 1);
  const maxLtv = tierRow.maxLtv;
  const financed = Math.min(desired, input.assetValue * maxLtv);
  const deposit = Math.round(((desired - financed) / desired) * 100) / 100;
  const termMonths = tierRow.tier === "A" ? 12 : tierRow.tier === "B" ? 18 : 24;
  const monthlyAmount = Math.round(financed / termMonths);

  const explanation: string[] = [];
  if (ltv > maxLtv) explanation.push(`Asset value covers only ${(ltv * 100).toFixed(0)}% of exposure — capped at tier ${tierRow.tier} (${(maxLtv * 100).toFixed(0)}%).`);
  explanation.push(`Combined score ${combined} places subscriber in tier ${tierRow.tier}.`);

  return {
    combinedScore: combined,
    tier: tierRow.tier,
    maxLtv,
    gnuGridScore: gnuGrid,
    internalAssetScore,
    explanation,
    recommended: { deposit, termMonths, monthlyAmount, financed },
  };
}
