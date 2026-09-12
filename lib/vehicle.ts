type VehicleBand = { make: string; model: string; liquidity: 'HIGH' | 'MEDIUM' | 'LOW'; residualPct: number; annualDepreciationPct: number };

// Initial Kampala used-import assumptions. These are policy inputs, not market truth;
// replace with a dated valuation feed when one is contracted.
export const ugandaVehicleBands: VehicleBand[] = [
  { make: 'Toyota', model: 'Premio', liquidity: 'HIGH', residualPct: .63, annualDepreciationPct: .07 },
  { make: 'Toyota', model: 'Vitz', liquidity: 'HIGH', residualPct: .58, annualDepreciationPct: .08 },
  { make: 'Toyota', model: 'Fielder', liquidity: 'HIGH', residualPct: .62, annualDepreciationPct: .07 },
  { make: 'Toyota', model: 'Wish', liquidity: 'MEDIUM', residualPct: .54, annualDepreciationPct: .09 },
  { make: 'Nissan', model: 'X-Trail', liquidity: 'MEDIUM', residualPct: .52, annualDepreciationPct: .10 },
  { make: 'Honda', model: 'Fit', liquidity: 'MEDIUM', residualPct: .52, annualDepreciationPct: .09 },
];

export function vehicleBand(make: string, model: string) {
  return ugandaVehicleBands.find(v => v.make.toLowerCase() === make.toLowerCase() && v.model.toLowerCase() === model.toLowerCase()) ?? { make, model, liquidity: 'LOW' as const, residualPct: .42, annualDepreciationPct: .12 };
}
