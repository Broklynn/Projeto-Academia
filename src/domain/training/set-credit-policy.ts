// Aggregate fractional modeling reference: Pelland et al. (2026),
// DOI 10.1007/s40279-025-02344-w. This is not a claim that every
// secondary-muscle set produces exactly half a direct set of stimulus.
export const DEFAULT_HYPERTROPHY_INDIRECT_SET_CREDIT = 0.5;

export interface HypertrophySetCreditPolicy {
  readonly indirectSetCredit: number;
}

export function buildDefaultHypertrophySetCreditPolicy(): HypertrophySetCreditPolicy {
  return {
    indirectSetCredit: DEFAULT_HYPERTROPHY_INDIRECT_SET_CREDIT,
  };
}
