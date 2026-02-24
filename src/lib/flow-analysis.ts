// Flow computation library — all derived from existing API data (no new endpoints)
import type { Curator, VaultData, MarketOverview, FlowDataPoint, YieldFlowCorrelation } from '@/types';

export interface FlowSummary {
  totalFlow7d: number;
  totalFlow30d: number;
  totalInflow7d: number;
  totalOutflow7d: number;
  biggestInflow: { name: string; flow: number } | null;
  biggestOutflow: { name: string; flow: number } | null;
}

export interface FlowBreakdownItem {
  name: string;
  stablecoinInflow: number;
  stablecoinOutflow: number;
  nonStableInflow: number;
  nonStableOutflow: number;
}

// Compute flows by chain — since overview.tvlByChain.change7d is hardcoded to 0,
// we derive chain flows from curator chain allocations × their flows
export function computeChainFlows(curators: Curator[], vaults: VaultData[]): FlowDataPoint[] {
  const chainFlows = new Map<string, { flow7d: number; flow30d: number; tvl: number }>();

  // Build per-curator chain TVL weights from vaults
  const curatorChainTvl = new Map<string, Map<string, number>>();
  for (const vault of vaults) {
    if (!vault.curator || vault.isRawMarket) continue;
    if (!curatorChainTvl.has(vault.curator)) curatorChainTvl.set(vault.curator, new Map());
    const chainMap = curatorChainTvl.get(vault.curator)!;
    chainMap.set(vault.chain, (chainMap.get(vault.chain) || 0) + vault.tvl);
  }

  for (const curator of curators) {
    const chainTvlMap = curatorChainTvl.get(curator.name);
    const curatorTotalTvl = chainTvlMap
      ? Array.from(chainTvlMap.values()).reduce((s, v) => s + v, 0)
      : 0;

    // If we have vault-level chain data, distribute proportionally
    if (chainTvlMap && curatorTotalTvl > 0) {
      for (const [chain, tvl] of chainTvlMap) {
        const weight = tvl / curatorTotalTvl;
        const existing = chainFlows.get(chain) || { flow7d: 0, flow30d: 0, tvl: 0 };
        existing.flow7d += curator.netFlow7d * weight;
        existing.flow30d += curator.netFlow30d * weight;
        existing.tvl += tvl;
        chainFlows.set(chain, existing);
      }
    } else {
      // Fallback: distribute evenly across curator chains
      const chainCount = curator.chains.length || 1;
      const weight = 1 / chainCount;
      for (const chain of curator.chains) {
        const existing = chainFlows.get(chain) || { flow7d: 0, flow30d: 0, tvl: 0 };
        existing.flow7d += curator.netFlow7d * weight;
        existing.flow30d += curator.netFlow30d * weight;
        existing.tvl += curator.totalTvl * weight;
        chainFlows.set(chain, existing);
      }
    }
  }

  return Array.from(chainFlows.entries())
    .map(([name, data]) => ({
      name,
      flow7d: data.flow7d,
      flow30d: data.flow30d,
      tvl: data.tvl,
      flowPercent7d: data.tvl > 0 ? (data.flow7d / data.tvl) * 100 : 0,
      flowPercent30d: data.tvl > 0 ? (data.flow30d / data.tvl) * 100 : 0,
    }))
    .filter(d => Math.abs(d.flow7d) > 100 || Math.abs(d.flow30d) > 100)
    .sort((a, b) => Math.abs(b.flow7d) - Math.abs(a.flow7d));
}

// Compute flows by protocol using overview.tvlByProtocol change percentages × TVL
export function computeProtocolFlows(overview: MarketOverview): FlowDataPoint[] {
  return overview.tvlByProtocol
    .map(p => {
      const flow7d = p.tvl * (p.change7d / 100);
      const flow30d = p.change30d ? p.tvl * (p.change30d / 100) : 0;
      return {
        name: p.name,
        flow7d,
        flow30d,
        tvl: p.tvl,
        flowPercent7d: p.change7d,
        flowPercent30d: p.change30d || 0,
      };
    })
    .filter(d => Math.abs(d.flow7d) > 1000)
    .sort((a, b) => b.flow7d - a.flow7d);
}

// Compute flows by curator (directly from existing netFlow data)
export function computeCuratorFlows(curators: Curator[]): FlowDataPoint[] {
  return curators
    .map(c => ({
      name: c.name,
      flow7d: c.netFlow7d,
      flow30d: c.netFlow30d,
      tvl: c.totalTvl,
      flowPercent7d: c.totalTvl > 0 ? (c.netFlow7d / c.totalTvl) * 100 : 0,
      flowPercent30d: c.totalTvl > 0 ? (c.netFlow30d / c.totalTvl) * 100 : 0,
    }))
    .filter(d => Math.abs(d.flow7d) > 1000)
    .sort((a, b) => b.flow7d - a.flow7d);
}

// Compute yield vs flow correlation for scatter plot
export function computeYieldFlowCorrelation(
  curators: Curator[],
  vaults: VaultData[]
): YieldFlowCorrelation[] {
  // Determine if a curator is stablecoin-focused (>50% stablecoin vaults by TVL)
  const curatorStablecoinPct = new Map<string, number>();
  const curatorVaultTvl = new Map<string, number>();

  for (const vault of vaults) {
    if (!vault.curator || vault.isRawMarket) continue;
    curatorVaultTvl.set(vault.curator, (curatorVaultTvl.get(vault.curator) || 0) + vault.tvl);
    if (vault.stablecoin) {
      curatorStablecoinPct.set(vault.curator, (curatorStablecoinPct.get(vault.curator) || 0) + vault.tvl);
    }
  }

  return curators
    .filter(c => c.avgApy > 0 && c.totalTvl > 100_000)
    .map(c => {
      const totalVaultTvl = curatorVaultTvl.get(c.name) || 0;
      const stableTvl = curatorStablecoinPct.get(c.name) || 0;
      const isStablecoin = totalVaultTvl > 0 ? stableTvl / totalVaultTvl > 0.5 : false;

      return {
        name: c.name,
        slug: c.slug,
        apy: c.avgApy,
        flow7d: c.netFlow7d,
        tvl: c.totalTvl,
        stablecoin: isStablecoin,
      };
    });
}

// Compute stablecoin vs non-stable flow breakdown
export function computeFlowBreakdown(
  curators: Curator[],
  vaults: VaultData[]
): FlowBreakdownItem[] {
  // Group vault TVL by curator + stablecoin status
  const curatorBreakdown = new Map<string, { stableTvl: number; nonStableTvl: number; totalTvl: number }>();

  for (const vault of vaults) {
    if (!vault.curator || vault.isRawMarket) continue;
    const existing = curatorBreakdown.get(vault.curator) || { stableTvl: 0, nonStableTvl: 0, totalTvl: 0 };
    existing.totalTvl += vault.tvl;
    if (vault.stablecoin) {
      existing.stableTvl += vault.tvl;
    } else {
      existing.nonStableTvl += vault.tvl;
    }
    curatorBreakdown.set(vault.curator, existing);
  }

  // Group by protocol
  const protocolFlows = new Map<string, FlowBreakdownItem>();

  for (const curator of curators) {
    const breakdown = curatorBreakdown.get(curator.name);
    if (!breakdown || breakdown.totalTvl === 0) continue;

    const stableWeight = breakdown.stableTvl / breakdown.totalTvl;
    const nonStableWeight = breakdown.nonStableTvl / breakdown.totalTvl;

    for (const protocol of curator.protocols) {
      const existing = protocolFlows.get(protocol) || {
        name: protocol,
        stablecoinInflow: 0,
        stablecoinOutflow: 0,
        nonStableInflow: 0,
        nonStableOutflow: 0,
      };

      const protocolWeight = 1 / curator.protocols.length;
      const flow = curator.netFlow7d * protocolWeight;

      if (flow >= 0) {
        existing.stablecoinInflow += flow * stableWeight;
        existing.nonStableInflow += flow * nonStableWeight;
      } else {
        existing.stablecoinOutflow += Math.abs(flow) * stableWeight;
        existing.nonStableOutflow += Math.abs(flow) * nonStableWeight;
      }

      protocolFlows.set(protocol, existing);
    }
  }

  return Array.from(protocolFlows.values())
    .filter(p =>
      p.stablecoinInflow > 1000 || p.stablecoinOutflow > 1000 ||
      p.nonStableInflow > 1000 || p.nonStableOutflow > 1000
    )
    .sort((a, b) =>
      (b.stablecoinInflow + b.nonStableInflow + b.stablecoinOutflow + b.nonStableOutflow) -
      (a.stablecoinInflow + a.nonStableInflow + a.stablecoinOutflow + a.nonStableOutflow)
    );
}

// Compute aggregate flow summary stats
export function computeFlowSummary(curators: Curator[]): FlowSummary {
  let totalFlow7d = 0;
  let totalFlow30d = 0;
  let totalInflow7d = 0;
  let totalOutflow7d = 0;
  let biggestInflow: { name: string; flow: number } | null = null;
  let biggestOutflow: { name: string; flow: number } | null = null;

  for (const c of curators) {
    totalFlow7d += c.netFlow7d;
    totalFlow30d += c.netFlow30d;

    if (c.netFlow7d > 0) {
      totalInflow7d += c.netFlow7d;
      if (!biggestInflow || c.netFlow7d > biggestInflow.flow) {
        biggestInflow = { name: c.name, flow: c.netFlow7d };
      }
    } else {
      totalOutflow7d += c.netFlow7d; // negative
      if (!biggestOutflow || c.netFlow7d < biggestOutflow.flow) {
        biggestOutflow = { name: c.name, flow: c.netFlow7d };
      }
    }
  }

  return { totalFlow7d, totalFlow30d, totalInflow7d, totalOutflow7d, biggestInflow, biggestOutflow };
}
