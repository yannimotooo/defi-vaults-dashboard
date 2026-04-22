/**
 * Curator → external-platform relationships.
 *
 * **Why this exists:** for competitive intelligence (Bitwise's use case for
 * this dashboard), one of the highest-signal facts about a curator is which
 * institutional platforms / earn products use it. "Veda powers Kraken Earn"
 * is the kind of thing that matters when assessing curator significance —
 * far more so than raw TVL alone.
 *
 * **Data source:** manual research, hand-curated. DeFiLlama doesn't expose
 * this and there's no on-chain primitive for it. When a relationship is
 * publicly disclosed by either party (press release, blog post, integration
 * announcement), add it here with `lastVerified` so we can audit staleness.
 *
 * **Maintenance:** revisit at least quarterly. Mergers, breakups, and new
 * integrations happen often. When in doubt about a relationship, leave it
 * OUT — false positives mislead users worse than missing data.
 */

export interface PlatformRelationship {
  /** Display name of the consumer platform (e.g. "Kraken Earn"). */
  platform: string;
  /** Free-text source URL or citation. */
  source: string;
  /** ISO date when this entry was last manually verified. */
  lastVerified: string;
}

/**
 * Map curator slug (matches CURATOR_NAME_VARIANTS keys in curator-names.ts)
 * to the institutional platforms / earn products that consume their vaults.
 *
 * Conservative list — only includes relationships I have direct evidence for.
 * Add more as research uncovers them.
 */
export const CURATOR_PLATFORMS: Record<string, PlatformRelationship[]> = {
  // Coinbase Earn uses Morpho with Steakhouse as the curator
  'steakhouse-financial': [
    {
      platform: 'Coinbase Earn',
      source: 'Coinbase + Morpho integration announcement',
      lastVerified: '2026-04-16',
    },
  ],

  // Kraken Earn uses a multi-curator setup on Morpho-style vaults
  veda: [
    {
      platform: 'Kraken Earn',
      source: 'Kraken Earn announcement; Veda BoringVault integration',
      lastVerified: '2026-04-16',
    },
  ],
  gauntlet: [
    {
      platform: 'Kraken Earn',
      source: 'Kraken Earn curator lineup (public docs)',
      lastVerified: '2026-04-16',
    },
  ],
  sentora: [
    {
      platform: 'Kraken Earn',
      source: 'Kraken Earn curator lineup (public docs)',
      lastVerified: '2026-04-16',
    },
  ],

  // Mellow runs vaults for a number of Symbiotic / EigenLayer restaking partners
  'mellow-core': [
    {
      platform: 'Symbiotic',
      source: 'Mellow vaults are deployed across Symbiotic restaking',
      lastVerified: '2026-04-16',
    },
  ],
};

/** Return the platform list for a curator slug, or [] if no known relationships. */
export function getCuratorPlatforms(slug: string): PlatformRelationship[] {
  return CURATOR_PLATFORMS[slug] ?? [];
}
