import { NextRequest, NextResponse } from 'next/server';
import { getCuratorVaults, getTopVaults } from '@/lib/defillama';
import { getAllVaultsTvl } from '@/lib/dune';
import { getVaultRiskMetrics } from '@/lib/risk';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const curatorSlug = searchParams.get('curator');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const includeRisk = searchParams.get('risk') !== 'false'; // Include risk by default

    // Fetch from all sources in parallel
    const [vaults, duneVaults, vaultRiskData] = await Promise.all([
      curatorSlug ? getCuratorVaults(curatorSlug) : getTopVaults(limit),
      getAllVaultsTvl().catch(() => []),
      includeRisk ? getVaultRiskMetrics().catch(() => []) : Promise.resolve([]),
    ]);

    // Create lookup maps
    const duneMap = new Map(
      duneVaults.map(v => [`${v.protocol.toLowerCase()}-${v.chain.toLowerCase()}`, v])
    );

    // Create risk lookup by vault name (normalized)
    const normalizeName = (s: string) => s.toLowerCase().replace(/[\s\-_]/g, '');
    const riskMap = new Map(
      vaultRiskData.map(v => [normalizeName(v.name), v])
    );

    // Transform to a cleaner format with risk data
    const transformedVaults = vaults.map(vault => {
      const duneKey = `${vault.project.toLowerCase()}-${vault.chain.toLowerCase()}`;
      const duneVault = duneMap.get(duneKey);

      // Try to match risk data by name or symbol
      const riskData = riskMap.get(normalizeName(vault.symbol))
        || riskMap.get(normalizeName(vault.poolMeta || ''))
        || Array.from(riskMap.values()).find(r =>
            normalizeName(r.name).includes(normalizeName(vault.symbol)) ||
            normalizeName(vault.symbol).includes(normalizeName(r.symbol))
          );

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
        // Risk metrics (from Morpho on-chain data)
        riskScore: riskData?.riskScore,
        riskLevel: riskData?.riskLevel,
        maxUtilization: riskData?.maxUtilization,
        avgLltv: riskData?.avgLltv,
        hasBadDebt: riskData?.hasBadDebt,
        redWarningCount: riskData?.redWarningCount,
        criticalWarnings: riskData?.criticalWarnings,
        markets: riskData?.markets,
      };
    });

    // Also include Morpho vaults that might not be in DeFiLlama
    // (if we have risk data for them)
    if (includeRisk && !curatorSlug) {
      const existingSymbols = new Set(vaults.map(v => normalizeName(v.symbol)));

      for (const riskVault of vaultRiskData) {
        if (!existingSymbols.has(normalizeName(riskVault.symbol))) {
          transformedVaults.push({
            id: riskVault.address,
            name: riskVault.name,
            chain: riskVault.chain === 1 ? 'Ethereum' : riskVault.chain === 8453 ? 'Base' : `Chain ${riskVault.chain}`,
            project: 'morpho',
            symbol: riskVault.symbol,
            tvl: riskVault.tvlUsd,
            apy: riskVault.apy,
            apyBase: riskVault.apy,
            apyReward: 0,
            apyChange7d: 0,
            stablecoin: false,
            exposure: 'single',
            poolMeta: riskVault.curator,
            duneTvl: null,
            dataVerified: true, // On-chain data
            riskScore: riskVault.riskScore,
            riskLevel: riskVault.riskLevel,
            maxUtilization: riskVault.maxUtilization,
            avgLltv: riskVault.avgLltv,
            hasBadDebt: riskVault.hasBadDebt,
            redWarningCount: riskVault.redWarningCount,
            criticalWarnings: riskVault.criticalWarnings,
            markets: riskVault.markets,
          });
        }
      }
    }

    // Sort by TVL
    transformedVaults.sort((a, b) => b.tvl - a.tvl);

    return NextResponse.json({
      vaults: transformedVaults.slice(0, limit),
      count: transformedVaults.length,
      curator: curatorSlug || null,
      dataSource: vaultRiskData.length > 0
        ? 'DeFiLlama + Morpho On-chain Risk'
        : duneVaults.length > 0 ? 'DeFiLlama + Dune' : 'DeFiLlama',
      vaultsWithRiskData: transformedVaults.filter(v => v.riskScore !== undefined).length,
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
