import { NextRequest, NextResponse } from 'next/server';
import { getCuratorVaults, getTopVaults } from '@/lib/defillama';
import { getAllVaultsTvl } from '@/lib/dune';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const curatorSlug = searchParams.get('curator');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Fetch from both DeFiLlama and Dune in parallel
    const [vaults, duneVaults] = await Promise.all([
      curatorSlug ? getCuratorVaults(curatorSlug) : getTopVaults(limit),
      getAllVaultsTvl().catch(() => []), // Don't fail if Dune fails
    ]);

    // Create a map of Dune vault data for cross-referencing
    const duneMap = new Map(
      duneVaults.map(v => [`${v.protocol.toLowerCase()}-${v.chain.toLowerCase()}`, v])
    );

    // Transform to a cleaner format with Dune cross-reference
    const transformedVaults = vaults.map(vault => {
      const duneKey = `${vault.project.toLowerCase()}-${vault.chain.toLowerCase()}`;
      const duneVault = duneMap.get(duneKey);

      return {
        id: vault.pool,
        name: formatVaultName(vault),
        chain: vault.chain,
        project: vault.project,
        symbol: vault.symbol,
        tvl: vault.tvlUsd,
        apy: vault.apy || 0,
        apyBase: vault.apyBase || 0,
        apyReward: vault.apyReward || 0,
        apyChange7d: vault.apyPct7D || 0,
        stablecoin: vault.stablecoin,
        exposure: vault.exposure,
        poolMeta: vault.poolMeta,
        // Dune cross-reference data
        duneTvl: duneVault?.tvl || null,
        dataVerified: duneVault ? Math.abs((vault.tvlUsd - duneVault.tvl) / vault.tvlUsd) < 0.15 : false,
      };
    });

    return NextResponse.json({
      vaults: transformedVaults,
      count: transformedVaults.length,
      curator: curatorSlug || null,
      dataSource: duneVaults.length > 0 ? 'DeFiLlama + Dune' : 'DeFiLlama',
      duneVaultsCount: duneVaults.length,
    });
  } catch (error) {
    console.error('Error fetching vaults:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault data' },
      { status: 500 }
    );
  }
}

function formatVaultName(vault: {
  symbol: string;
  poolMeta: string | null;
  project: string;
}): string {
  // Create a readable vault name from symbol and metadata
  let name = vault.symbol;

  if (vault.poolMeta) {
    // Add pool metadata if it provides useful context
    const meta = vault.poolMeta;
    if (!name.toLowerCase().includes(meta.toLowerCase())) {
      name = `${name} (${meta})`;
    }
  }

  return name;
}
