// Centralized curator name mappings — single source of truth
// Used by: curators route, fees route, historical route, morpho.ts

// Maps curator slugs to all known name variations (first entry is canonical)
export const CURATOR_NAME_VARIANTS: Record<string, string[]> = {
  'steakhouse-financial': ['Steakhouse Financial', 'Steakhouse'],
  'gauntlet': ['Gauntlet'],
  'sentora': ['Sentora'],
  'mev-capital': ['MEV Capital', 'Mev Capital'],
  're7-labs': ['RE7 Labs', 'Re7 Labs', 'RE7'],
  'k3-capital': ['K3 Capital', 'K3'],
  'block-analitica': ['Block Analitica', 'BA Labs'],
  'euler-dao': ['Euler DAO', 'Euler'],
  'b-protocol': ['B.Protocol', 'B Protocol'],
  'b.protocol-curator': ['B.Protocol', 'B Protocol', 'B.Protocol Curator'],
  'summer-fi': ['Summer.fi', 'Summerfi'],
  'ultrayield-by-edge': ['UltraYield', 'Ultrayield', 'Edge'],
  'hyperithm': ['Hyperithm'],
  'vault-bridge': ['Vault Bridge', 'VaultBridge'],
  'clearstar': ['Clearstar'],
  'telos-consilium': ['Telos Consilium', 'Telos'],
  'tulipa-capital': ['Tulipa Capital', 'Tulipa'],
  'kpk': ['kpk', 'KPK'],
  'alphaping': ['AlphaPing', 'Alphaping'],
  '9summits': ['9Summits', '9summits'],
  'yearn-curating': ['Yearn', 'Yearn Curating', 'yearn'],
  'hakutora': ['Hakutora'],
  'singularv': ['SingularV'],
  'avantgarde': ['Avantgarde'],
  'apostro': ['Apostro'],
};

// Slug → canonical display name (first variant)
export const CURATOR_SLUG_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(CURATOR_NAME_VARIANTS).map(([slug, names]) => [slug, names[0]])
);

// Top curators for historical data fetching
export const TOP_CURATOR_SLUGS = [
  'steakhouse-financial',
  'gauntlet',
  'sentora',
  'mev-capital',
  're7-labs',
  'k3-capital',
  'block-analitica',
  'euler-dao',
] as const;

// Format a raw curator name to its canonical display form
export function formatCuratorName(name: string): string {
  const displayMap: Record<string, string> = {
    'Re7 Labs': 'RE7 Labs',
    'UltraYield by Edge': 'UltraYield',
    'Mev Capital': 'MEV Capital',
  };
  return displayMap[name] || name;
}

// Get all name variants for a curator slug
export function getCuratorNameVariants(slug: string): string[] {
  return CURATOR_NAME_VARIANTS[slug] || [slug];
}
