# Dashboard Improvements Implementation Plan

## Overview

This plan covers 6 feature additions with a focus on:
- **Performance**: Minimal API calls, leverage existing data
- **UX/UI**: Clean, consistent design patterns
- **Data integrity**: Surface existing data, don't over-engineer

---

## Feature 1: Surface Hidden Data

**Goal**: Display already-fetched data that's currently hidden

### 1.1 Curator Leaderboard Enhancements

**Current state**: Expanded row shows chains, protocols, 30d flow, Dune TVL, perf fee
**Add to expanded row**:

| Field | Data Source | Display |
|-------|-------------|---------|
| 7d Liquidation Volume | `curator.liquidationVolume7d` | `$2.3M liquidated` (amber if >$1M) |
| Bad Debt Flag | `curator.hasBadDebt` | Red "Bad Debt" badge |
| Critical Warnings | `curator.redWarningCount` | `3 critical warnings` (red text) |
| Avg Utilization | `curator.avgUtilization` | `67% utilized` with color scale |
| Gross vs Net APY | `curator.grossApy`, `curator.netApy` | Tooltip on APY column |

**File**: `src/components/charts/curator-leaderboard.tsx`
**Effort**: Low (data already in API response)

### 1.2 Vault Table Risk Badges

**Current state**: Risk badges only on curator leaderboard, not vault table
**Add**: Risk level badge to each vault row (when available)

**File**: `src/components/charts/vault-table.tsx`
**Data**: Already in vault response (`vault.riskLevel`, `vault.riskScore`)
**Effort**: Low

### 1.3 APY Tooltip with Gross/Net Breakdown

**Add tooltip on APY showing**:
```
APY: 5.2%
├── Gross: 5.8%
├── Performance Fee: -10%
└── Net to depositor: 5.2%
```

**Files**:
- `src/components/charts/curator-leaderboard.tsx`
- `src/components/charts/vault-table.tsx`

**Effort**: Low

---

## Feature 2: Fee Comparison Table

**Goal**: Side-by-side fee comparison for all curators

### 2.1 New Component: `fee-comparison-table.tsx`

**Columns**:
| Curator | Perf Fee | Mgmt Fee | Gross APY | Net APY | Fee Burden | Est. Revenue |
|---------|----------|----------|-----------|---------|------------|--------------|
| Steakhouse | 10% | 0.5% | 4.0% | 3.5% | 12.5% | $12M/yr |

**Sorting**: By any column
**Color coding**:
- Fee Burden: Green (<10%), Yellow (10-20%), Red (>20%)

**File**: `src/components/charts/fee-comparison-table.tsx` (NEW)
**Data**: All from existing `/api/curators` response
**Effort**: Medium

### 2.2 Add to Curators Tab

Add as collapsible section below leaderboard:
```
[Curator Leaderboard]
[▼ Fee Comparison] <- expandable
```

**File**: `src/app/page.tsx`
**Effort**: Low

---

## Feature 3: APY Quality Indicator

**Goal**: Show how much APY is sustainable (organic) vs temporary (rewards)

### 3.1 APY Breakdown Badge

**Display format**:
```
APY: 8.5% [████████░░] 61% organic
         ↳ Base: 5.2% | Rewards: 3.3%
```

**Logic**:
```typescript
const organicPct = vault.apyBase / vault.apy * 100;
// Green if >70% organic, Yellow 40-70%, Red <40%
```

### 3.2 Implementation Locations

1. **Vault Table**: Add "Yield Quality" column
2. **Curator Detail Page**: Show avg yield quality for curator's vaults
3. **Overview Stats**: Show market-wide organic yield %

**Files**:
- `src/components/ui/apy-quality-badge.tsx` (NEW)
- `src/components/charts/vault-table.tsx`
- `src/app/curator/[slug]/page.tsx`

**Data**: `apyBase` and `apyReward` already in vault response
**Effort**: Medium

---

## Feature 4: Risk Dashboard Section

**Goal**: Protocol-wide risk overview on main dashboard

### 4.1 Risk Summary Card

**Add to Overview tab**:
```
┌─────────────────────────────────────────────────┐
│ Protocol Risk Summary                            │
├─────────────────────────────────────────────────┤
│ 7d Liquidations    │ Curators at Risk │ Bad Debt │
│ $2.3M              │ 3 HIGH/CRITICAL  │ 2        │
├─────────────────────────────────────────────────┤
│ Avg Utilization: 67%  │ Critical Warnings: 5     │
└─────────────────────────────────────────────────┘
```

### 4.2 Data Aggregation

**Compute from existing curator data** (no new API call):
```typescript
const riskSummary = {
  totalLiquidations7d: curators.reduce((sum, c) => sum + (c.liquidationVolume7d || 0), 0),
  highRiskCount: curators.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL').length,
  badDebtCount: curators.filter(c => c.hasBadDebt).length,
  avgUtilization: curators.reduce((sum, c) => sum + (c.avgUtilization || 0), 0) / curators.length,
  criticalWarnings: curators.reduce((sum, c) => sum + (c.redWarningCount || 0), 0),
};
```

**File**:
- `src/components/charts/risk-summary-card.tsx` (NEW)
- `src/app/page.tsx`

**Effort**: Low-Medium

---

## Feature 5: Curator Strategy Tags

**Goal**: Categorize curators by strategy for quick filtering

### 5.1 Strategy Definitions

| Tag | Criteria | Color |
|-----|----------|-------|
| `Stablecoin Focus` | >70% stablecoin vaults | Blue |
| `High Yield` | Avg APY >8% | Green |
| `Conservative` | Risk score <30, no bad debt | Emerald |
| `Multi-chain` | >3 chains | Purple |
| `Multi-protocol` | >2 protocols | Indigo |
| `Large Cap` | TVL >$500M | Gold |

### 5.2 Implementation

**Compute in API** (add to curator response):
```typescript
// In /api/curators/route.ts
const strategies: string[] = [];
if (avgApy > 8) strategies.push('High Yield');
if (riskScore && riskScore < 30 && !hasBadDebt) strategies.push('Conservative');
if (chains.length > 3) strategies.push('Multi-chain');
if (protocols.length > 2) strategies.push('Multi-protocol');
if (totalTvl > 500_000_000) strategies.push('Large Cap');
// Stablecoin focus requires vault-level data check
```

**Display**: Tags below curator name in leaderboard

**Files**:
- `src/app/api/curators/route.ts`
- `src/types/index.ts`
- `src/components/charts/curator-leaderboard.tsx`
- `src/components/ui/strategy-tag.tsx` (NEW)

**Effort**: Medium

---

## Feature 6: Data Freshness Indicator

**Goal**: Show users when data was last updated

### 6.1 Header Badge

**Display in page header**:
```
Data: Live │ Updated 2m ago │ Sources: Morpho · DeFiLlama · Dune
```

### 6.2 Implementation

**Track in API response**:
```typescript
validation: {
  timestamp: new Date().toISOString(),
  sources: ['Morpho On-chain', 'DeFiLlama', 'Dune'],
  cacheStatus: 'fresh' | 'stale',
}
```

**Display component**:
```typescript
// Calculate "2m ago" from timestamp
const minutesAgo = Math.floor((Date.now() - new Date(timestamp)) / 60000);
```

**Files**:
- `src/components/ui/data-freshness-badge.tsx` (NEW)
- `src/app/page.tsx`

**Effort**: Low

---

## Performance Optimization Strategy

### Principle: No New API Calls for Display Features

All 6 features use **existing data** from current API responses:
- Features 1, 2, 4, 5, 6: Use `/api/curators` response (already fetched)
- Feature 3: Uses `apyBase`/`apyReward` from `/api/vaults` (already fetched)

### Caching Already in Place

| Data Source | Cache TTL | Status |
|-------------|-----------|--------|
| Kamino Solana | 10 min | ✅ Implemented |
| Morpho APY | 5 min | ✅ Implemented |
| DeFiLlama | Next.js revalidate | ✅ Built-in |

### Compute-Heavy Operations

Strategy tags (Feature 5) add minor computation in API:
- ~0.5ms per curator for strategy classification
- Acceptable for 43 curators

---

## Implementation Order

**Phase 1: Quick Wins (Day 1)**
1. ✅ Feature 1.1: Surface hidden data in curator expanded row
2. ✅ Feature 1.3: APY tooltip with gross/net
3. ✅ Feature 6: Data freshness indicator

**Phase 2: New Components (Day 2)**
4. Feature 4: Risk dashboard section
5. Feature 3: APY quality indicator
6. Feature 1.2: Vault table risk badges

**Phase 3: Medium Effort (Day 3)**
7. Feature 5: Curator strategy tags
8. Feature 2: Fee comparison table

---

## File Changes Summary

### New Files (5)
- `src/components/ui/apy-quality-badge.tsx`
- `src/components/ui/strategy-tag.tsx`
- `src/components/ui/data-freshness-badge.tsx`
- `src/components/charts/fee-comparison-table.tsx`
- `src/components/charts/risk-summary-card.tsx`

### Modified Files (5)
- `src/app/api/curators/route.ts` (add strategies)
- `src/types/index.ts` (add strategies field)
- `src/app/page.tsx` (add new sections)
- `src/components/charts/curator-leaderboard.tsx` (surface data, tooltips, tags)
- `src/components/charts/vault-table.tsx` (risk badges, APY quality)

---

## Roadmap Items (Deferred)

### For Later Implementation
1. **Comparison Mode** - Side-by-side curator/vault comparison
2. **Whale Flow Tracking** - Large deposit/withdrawal alerts
3. **Aave/Spark Integration** - New data source (see research below)

### Aave/Spark Research Summary

**Aave Earn Vaults**:
- ERC-4626 compliant vaults with curator (manager) role
- Minimum 10% performance fee, 50% to Aave Labs
- Similar to Morpho model but newer (less curator data available)
- Would require new API integration with Aave subgraph

**Spark Protocol**:
- Part of Sky (formerly MakerDAO) ecosystem
- Deploys DAI markets ON Morpho (already captured in our data)
- Has own Spark Liquidity Layer for stablecoin routing
- SPK token launched June 2025

**Recommendation**: Spark's Morpho activity is already captured. Aave Earn is worth adding when curator ecosystem matures. Track for Q2 2026.

---

## Ready for Implementation

All features are scoped with:
- ✅ Specific file locations
- ✅ Data sources identified (all existing)
- ✅ No new API calls needed
- ✅ Performance impact assessed
- ✅ Implementation order prioritized

**Ping: Ready to start implementation when you approve this plan.**
