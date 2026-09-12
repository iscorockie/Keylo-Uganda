import type { RiskResult } from './risk';

export type RiskPolicy = {
  tier: 'A' | 'B' | 'C' | 'Decline';
  minScore: number;
  maxTermMonths: number;
  minDepositPct: number;
  marginPct: number;
};

export const defaultPolicy: RiskPolicy[] = [
  { tier: 'A', minScore: 75, maxTermMonths: 24, minDepositPct: 0.15, marginPct: 18.4 },
  { tier: 'B', minScore: 58, maxTermMonths: 18, minDepositPct: 0.20, marginPct: 23.7 },
  { tier: 'C', minScore: 42, maxTermMonths: 12, minDepositPct: 0.30, marginPct: 29.5 },
  { tier: 'Decline', minScore: 0, maxTermMonths: 0, minDepositPct: 1, marginPct: 0 },
];

export function policyFor(score: number, policies: RiskPolicy[] = defaultPolicy) {
  return [...policies].sort((a, b) => b.minScore - a.minScore).find(p => score >= p.minScore) ?? policies[policies.length - 1];
}

export function structureOffer(valueUgx: number, result: Pick<RiskResult, 'combined'>, policies?: RiskPolicy[]) {
  const policy = policyFor(result.combined, policies);
  if (policy.tier === 'Decline') return { ...policy, depositUgx: valueUgx, monthlyUgx: 0 };
  const depositUgx = Math.round(valueUgx * policy.minDepositPct);
  const monthlyUgx = Math.round(((valueUgx - depositUgx) * (1 + policy.marginPct / 100)) / policy.maxTermMonths);
  return { ...policy, depositUgx, monthlyUgx };
}
