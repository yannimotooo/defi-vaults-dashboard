import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Combine Tailwind classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format large numbers (e.g., 1.5B, 420M)
// compact: true for shorter format on chart axes (e.g., $1B instead of $1.00B)
export function formatTvl(value: number, compact: boolean = false): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    const formatted = compact ? (absValue / 1_000_000_000).toFixed(1) : (absValue / 1_000_000_000).toFixed(2);
    return `${sign}$${formatted.replace(/\.0$/, '')}B`;
  }
  if (absValue >= 1_000_000) {
    const formatted = compact ? (absValue / 1_000_000).toFixed(1) : (absValue / 1_000_000).toFixed(2);
    return `${sign}$${formatted.replace(/\.0$/, '')}M`;
  }
  if (absValue >= 1_000) {
    const formatted = compact ? (absValue / 1_000).toFixed(0) : (absValue / 1_000).toFixed(1);
    return `${sign}$${formatted}K`;
  }
  return `${sign}$${absValue.toFixed(0)}`;
}

// Format flow values with sign (e.g., +$1.5M, -$420K)
export function formatFlow(value: number): string {
  const absValue = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';

  if (absValue >= 1_000_000_000) {
    return `${sign}$${(absValue / 1_000_000_000).toFixed(2)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}$${(absValue / 1_000).toFixed(0)}K`;
  }
  if (absValue === 0) {
    return '$0';
  }
  return `${sign}$${absValue.toFixed(0)}`;
}

// Format percentage
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

// Format APY
export function formatApy(value: number): string {
  return `${value.toFixed(2)}%`;
}

// Get color for change values
export function getChangeColor(value: number): string {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-500';
}

// Shorten curator names for chart labels
export function formatCuratorShortName(name: string): string {
  const shortNames: Record<string, string> = {
    'Steakhouse Financial': 'Steakhouse',
    'UltraYield by Edge': 'UltraYield',
    'Varlamore Capital': 'Varlamore',
    'Block Analitica': 'Block Anal.',
  };
  if (shortNames[name]) return shortNames[name];
  if (name.length > 14) return name.slice(0, 12) + '...';
  return name;
}

// Chain name normalization
export function normalizeChainName(chain: string): string {
  const chainMap: Record<string, string> = {
    'ethereum': 'Ethereum',
    'eth': 'Ethereum',
    'solana': 'Solana',
    'sol': 'Solana',
    'base': 'Base',
    'arbitrum': 'Arbitrum',
    'optimism': 'Optimism',
    'polygon': 'Polygon',
    'avalanche': 'Avalanche',
    'bsc': 'BSC',
  };

  return chainMap[chain.toLowerCase()] || chain;
}
