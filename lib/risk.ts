export type Intake = {
  make: string; model: string; year: number; mileage: number; value: number;
  income: number; incomeType: string; mobileMoney: string; crb: string; location: string;
};
export type RiskResult = { asset: number; subscriber: number; combined: number; tier: 'A'|'B'|'C'|'Decline'; factors: string[]; monthly: number; deposit: number; term: number; margin: number };

const popular = ['Toyota', 'Nissan', 'Honda', 'Suzuki'];
export function scoreDeal(i: Intake): RiskResult {
  const age = Math.max(0, new Date().getFullYear() - i.year);
  let asset = 72;
  asset -= Math.min(28, age * 3);
  asset -= Math.min(18, Math.max(0, i.mileage - 80000) / 10000 * 2);
  if (popular.includes(i.make)) asset += 10;
  if (i.value < 15000000) asset += 3;
  let subscriber = 54;
  if (i.mobileMoney === 'Strong') subscriber += 22;
  if (i.mobileMoney === 'Regular') subscriber += 12;
  if (i.mobileMoney === 'Limited') subscriber -= 8;
  if (i.crb === 'Clear') subscriber += 16;
  if (i.crb === 'Unknown') subscriber -= 2;
  if (i.crb === 'Flagged') subscriber -= 30;
  if (i.incomeType === 'Formal') subscriber += 8;
  if (i.incomeType === 'Business') subscriber += 4;
  subscriber += Math.min(10, i.income / 1000000);
  asset = Math.round(Math.max(0, Math.min(100, asset)));
  subscriber = Math.round(Math.max(0, Math.min(100, subscriber)));
  const combined = Math.round(asset * .45 + subscriber * .55);
  const tier = combined >= 75 ? 'A' : combined >= 58 ? 'B' : combined >= 42 ? 'C' : 'Decline';
  const factors = [
    `${i.make} ${i.model} retains ${popular.includes(i.make) ? 'strong' : 'moderate'} local demand`,
    `${i.mobileMoney.toLowerCase()} mobile-money activity`,
    `${i.crb === 'Clear' ? 'No CRB flags reported' : i.crb === 'Flagged' ? 'CRB flag requires review' : 'CRB status not verified'}`
  ];
  const term = tier === 'A' ? 24 : tier === 'B' ? 18 : 12;
  const deposit = Math.round(i.value * (tier === 'A' ? .15 : tier === 'B' ? .2 : .3));
  const financed = Math.max(0, i.value - deposit);
  const monthly = Math.round((financed * (tier === 'A' ? 1.18 : tier === 'B' ? 1.28 : 1.4)) / term);
  return { asset, subscriber, combined, tier, factors, monthly, deposit, term, margin: tier === 'Decline' ? 0 : tier === 'A' ? 18.4 : tier === 'B' ? 23.7 : 29.5 };
}
