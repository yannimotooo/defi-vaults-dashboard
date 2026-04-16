/**
 * Manual fee overrides for curators whose published fees differ from what's
 * exposed on-chain (or aren't on-chain at all).
 *
 * **When an override is applied:** only when the on-chain API returns 0/missing
 * for that fee field. Real on-chain fees always take precedence.
 *
 * **Schema:**
 *   - managementFee, performanceFee — DECIMALS (0.01 = 1%, 0.1 = 10%)
 *   - source — short human-readable provenance ("Sentora docs", "vault source", etc.)
 *   - lastVerified — ISO date when this entry was last manually checked
 *   - confidence — 'high' (direct from team docs/governance), 'medium' (inferred
 *     from public statements), 'low' (estimate / industry default)
 *
 * **Maintenance:** when adding a curator, fill ALL fields. Stale entries are a
 * known risk — the dashboard surfaces `source` in the UI tooltip so users can
 * spot questionable values. Audit at least quarterly.
 */

export interface CuratorFeeOverride {
  managementFee?: number;     // decimal (0.01 = 1%)
  performanceFee?: number;    // decimal (0.10 = 10%)
  source: string;             // human-readable provenance
  lastVerified: string;       // ISO date YYYY-MM-DD
  confidence: 'high' | 'medium' | 'low';
}

export const CURATOR_FEE_OVERRIDES: Record<string, CuratorFeeOverride> = {
  // Sentora — original entry, restated with new schema
  Sentora: {
    managementFee: 0.01,
    source: 'Sentora published fee schedule (not set on-chain in Morpho V2 contract)',
    lastVerified: '2026-04-16',
    confidence: 'high',
  },

  // Veda — BoringVault platform; performance fee model published in vault contracts
  // and confirmed via team-published documentation. No management fee in the
  // standard model (revenue is purely performance-based).
  Veda: {
    performanceFee: 0.10,
    source: 'Veda BoringVault standard model (vault source code + docs)',
    lastVerified: '2026-04-16',
    confidence: 'medium', // model documented, exact per-vault values may vary
  },

  // Mellow — restaking vaults; standard 10% performance fee per their governance
  // proposal and current vault deployments.
  Mellow: {
    performanceFee: 0.10,
    source: 'Mellow governance proposal MIP-001 + current vault deployments',
    lastVerified: '2026-04-16',
    confidence: 'medium',
  },

  // Steakhouse Financial — ~10% performance fee on Morpho V1 vaults that don't
  // expose fee on-chain (V1 legacy). V2 vaults set the fee on-chain and override
  // is bypassed automatically.
  'Steakhouse Financial': {
    performanceFee: 0.10,
    source: 'Steakhouse public fee disclosures (Morpho V1 legacy vaults only)',
    lastVerified: '2026-04-16',
    confidence: 'low', // V1 fees vary by vault; this is a typical-case fallback
  },

  // Gauntlet — performance fee on managed vaults per their public fee schedule.
  // Most Morpho vaults set this on-chain, but Kamino and other protocols may
  // not expose it via API.
  Gauntlet: {
    performanceFee: 0.15,
    source: 'Gauntlet public fee schedule (typical-case for off-chain protocols)',
    lastVerified: '2026-04-16',
    confidence: 'low',
  },

  // MEV Capital — performance fee per their published terms.
  'MEV Capital': {
    performanceFee: 0.15,
    source: 'MEV Capital public terms (typical-case fallback)',
    lastVerified: '2026-04-16',
    confidence: 'low',
  },

  // RE7 Labs — performance fee on managed vaults.
  'RE7 Labs': {
    performanceFee: 0.10,
    source: 'RE7 Labs public terms (typical-case fallback)',
    lastVerified: '2026-04-16',
    confidence: 'low',
  },
};
