// Manual fee overrides for curators whose fees are published but not set on-chain
// These override API values only when the API returns 0 (i.e., fee not in smart contract)
// Fees are stored as decimals: 0.01 = 1%

export const CURATOR_FEE_OVERRIDES: Record<
  string,
  { managementFee?: number; performanceFee?: number; source?: string }
> = {
  Sentora: {
    managementFee: 0.01, // 1% AUM annual fee
    source: 'Published fee schedule (not set on-chain in Morpho V2 contract)',
  },
};
