// Centralized color definitions for consistent styling across the dashboard

// Curator colors - spread across the spectrum for maximum distinction
export const CURATOR_COLORS: Record<string, string> = {
  // Primary curators - most distinct colors
  'Steakhouse Financial': '#10B981', // Emerald green
  'Gauntlet': '#A855F7',             // Vivid purple
  'Sentora': '#F97316',              // Orange
  'RE7 Labs': '#EC4899',             // Pink
  'MEV Capital': '#FBBF24',          // Yellow/gold
  'K3 Capital': '#06B6D4',           // Cyan
  'Block Analitica': '#3B82F6',      // Blue
  'Euler DAO': '#EF4444',            // Red
  'B.Protocol': '#8B5CF6',           // Violet
  'Summer.fi': '#F43F5E',            // Rose

  // Secondary curators
  'UltraYield': '#84CC16',           // Lime
  'Hyperithm': '#14B8A6',            // Teal
  'Vault Bridge': '#0EA5E9',         // Sky blue
  'Clearstar': '#D946EF',            // Fuchsia
  'Tulipa Capital': '#FB7185',       // Light rose
  '9summits': '#22C55E',             // Green
  'Telos Consilium': '#6366F1',      // Indigo
  'KPK': '#2DD4BF',                  // Teal light
  'Alphaping': '#818CF8',            // Indigo light
};

// Fallback colors for unknown curators - maximally distinct
export const FALLBACK_CURATOR_COLORS = [
  '#10B981', // Green
  '#A855F7', // Purple
  '#F97316', // Orange
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#FBBF24', // Yellow
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F43F5E', // Rose
];

// Chain colors - official brand colors
export const CHAIN_COLORS: Record<string, string> = {
  'Ethereum': '#627EEA',
  'Arbitrum': '#28A0F0',
  'Base': '#0052FF',
  'Optimism': '#FF0420',
  'Polygon': '#8247E5',
  'Solana': '#9945FF',
  'BSC': '#F0B90B',
  'Avalanche': '#E84142',
  'Gnosis': '#04795B',
  'Fantom': '#1969FF',
  'zkSync': '#8C8DFC',
  'Linea': '#61DFFF',
  'Scroll': '#FFEEDA',
  'Mantle': '#000000',
  'Blast': '#FCFC03',
};

// Protocol colors
export const PROTOCOL_COLORS: Record<string, string> = {
  'Morpho': '#2470FF',
  'morpho': '#2470FF',
  'Euler': '#E04141',
  'euler': '#E04141',
  'Kamino': '#13C4A3',
  'kamino': '#13C4A3',
  'Yearn': '#006AE3',
  'yearn-finance': '#006AE3',
  'Aave': '#B6509E',
  'aave': '#B6509E',
  'Spark': '#F7931A',
  'spark': '#F7931A',
  'Compound': '#00D395',
  'compound': '#00D395',
  'Gearbox': '#8B5CF6',
  'gearbox': '#8B5CF6',
  'Sommelier': '#EC4899',
  'sommelier': '#EC4899',
  'Mellow': '#84CC16',
  'mellow-protocol': '#84CC16',
  'Symbiotic': '#F43F5E',
  'symbiotic': '#F43F5E',
  'Drift': '#9945FF',
  'drift-protocol': '#9945FF',
  'Meteora': '#00D1FF',
  'meteora': '#00D1FF',
};

// Helper functions
export function getCuratorColor(name: string, index: number = 0): string {
  return CURATOR_COLORS[name] || FALLBACK_CURATOR_COLORS[index % FALLBACK_CURATOR_COLORS.length];
}

export function getChainColor(chain: string): string {
  return CHAIN_COLORS[chain] || '#6366F1';
}

export function getProtocolColor(protocol: string): string {
  return PROTOCOL_COLORS[protocol] || PROTOCOL_COLORS[protocol.toLowerCase()] || '#8B5CF6';
}
