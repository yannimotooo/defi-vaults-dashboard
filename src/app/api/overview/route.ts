import { NextResponse } from 'next/server';
import { getAllProtocols, filterVaultProtocols, calculateEcosystemTvl, getProtocol30dChange } from '@/lib/defillama';
import type { MarketOverview, ChainTVL, ProtocolTVL } from '@/types';

// Skip static generation at build time (route fetches too much data)
export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    // Fetch data from DeFiLlama (free)
    const allProtocols = await getAllProtocols();

    // Filter for vault-related protocols only
    const vaultProtocols = filterVaultProtocols(allProtocols);

    // Calculate total TVL from vault protocols
    const totalTvl = vaultProtocols.reduce((sum, p) => sum + (p.tvl || 0), 0);

    // Calculate EVM vs Solana TVL properly
    const ecosystemTvl = calculateEcosystemTvl(vaultProtocols);

    // Get chain breakdown
    const chainMap = new Map<string, number>();
    for (const protocol of vaultProtocols) {
      if (protocol.chainTvls) {
        for (const [chain, tvl] of Object.entries(protocol.chainTvls)) {
          // Skip aggregate keys
          if (chain.includes('-') || ['staking', 'pool2', 'borrowed', 'treasury', 'vesting'].includes(chain)) {
            continue;
          }
          chainMap.set(chain, (chainMap.get(chain) || 0) + tvl);
        }
      }
    }

    const tvlByChain: ChainTVL[] = Array.from(chainMap.entries())
      .map(([chain, tvl]) => ({
        chain,
        tvl,
        change24h: 0,
        change7d: 0,
      }))
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 10);

    // Protocol breakdown - clean up names and sort
    const topProtocols = vaultProtocols
      .filter(p => p.tvl > 0)
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, 12);

    // Fetch 30d changes in parallel for top protocols
    const change30dResults = await Promise.all(
      topProtocols.map(p => getProtocol30dChange(p.slug).catch(() => undefined))
    );

    const tvlByProtocol: ProtocolTVL[] = topProtocols.map((p, i) => ({
      name: cleanProtocolName(p.name),
      slug: p.slug,
      tvl: p.tvl || 0,
      change24h: p.change_1d || 0,
      change7d: p.change_7d || 0,
      change30d: change30dResults[i],
      chains: p.chains || [],
      category: p.category || 'Vault',
    }));

    // Weighted average change (by TVL)
    const totalWeight = vaultProtocols.reduce((sum, p) => sum + (p.tvl || 0), 0);
    const avgChange24h = totalWeight > 0
      ? vaultProtocols.reduce((sum, p) => sum + ((p.change_1d || 0) * (p.tvl || 0)), 0) / totalWeight
      : 0;
    const avgChange7d = totalWeight > 0
      ? vaultProtocols.reduce((sum, p) => sum + ((p.change_7d || 0) * (p.tvl || 0)), 0) / totalWeight
      : 0;

    const overview: MarketOverview = {
      totalTvl,
      totalTvlChange24h: avgChange24h,
      totalTvlChange7d: avgChange7d,
      evmTvl: ecosystemTvl.evm,
      solanaTvl: ecosystemTvl.solana,
      totalVaults: estimateVaultCount(vaultProtocols),
      totalCurators: estimateCuratorCount(vaultProtocols),
      tvlByChain,
      tvlByProtocol,
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error('Error fetching overview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market overview' },
      { status: 500 }
    );
  }
}

// Clean up protocol names for display
function cleanProtocolName(name: string): string {
  return name
    .replace(' V2', ' v2')
    .replace(' V3', ' v3')
    .replace('Morpho Blue', 'Morpho V2')
    .replace('Kamino Lend', 'Kamino');
}

// Estimate vault count based on known data
function estimateVaultCount(protocols: { slug: string; tvl: number }[]): number {
  const vaultCounts: Record<string, number> = {
    'morpho': 200,
    'morpho-blue': 200,
    'euler-v2': 60,
    'euler': 60,
    'kamino': 30,
    'kamino-lend': 30,
    'yearn-finance': 100,
    'meteora': 50,
    'drift-protocol': 20,
    'symbiotic': 40,
    'mellow-protocol': 30,
    'gearbox': 25,
    'sommelier': 20,
  };

  let count = 0;
  for (const p of protocols) {
    const slug = p.slug.toLowerCase();
    for (const [key, vaults] of Object.entries(vaultCounts)) {
      if (slug.includes(key)) {
        count += vaults;
        break;
      }
    }
  }
  return count || 400; // Default estimate
}

// Estimate curator count based on known data
function estimateCuratorCount(protocols: { slug: string }[]): number {
  const curatorCounts: Record<string, number> = {
    'morpho': 15,
    'euler': 8,
    'kamino': 5,
    'symbiotic': 10,
    'mellow': 5,
  };

  let count = 0;
  for (const p of protocols) {
    const slug = p.slug.toLowerCase();
    for (const [key, curators] of Object.entries(curatorCounts)) {
      if (slug.includes(key)) {
        count += curators;
        break;
      }
    }
  }
  return count || 30;
}
