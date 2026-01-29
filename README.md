# DeFi Vault Dashboard

A comprehensive analytics dashboard for tracking DeFi vault performance, curator rankings, and TVL across EVM chains and Solana.

## Features

### Overview Tab
- Total Vault TVL with 24h change
- EVM vs Solana TVL breakdown
- TVL by Chain (pie chart with official chain brand colors)
- TVL by Protocol (bar chart)
- Quick curator preview

### Curators Tab
- Historical TVL comparison chart (multi-line, toggleable curators)
- Market share breakdown with progress bars
- Current TVL bar chart (clickable to detail page)
- Full leaderboard table with:
  - Rank, TVL, Vault count, APY, 7d Flow
  - Expandable rows showing chains, protocols, 30d flow
  - Click-through to curator detail pages

### Curator Detail Page (`/curator/[slug]`)
- Key stats: TVL, Market Share, Vaults, APY, 7d Flow
- Historical TVL chart with time period selector (7d/30d/90d/1y/All)
- Individual vault table with APY breakdown (base vs rewards)
- **Yield Quality Analysis** (organic vs incentivized APY)
- Chain allocation breakdown (calculated from real vault TVL)
- Protocol allocation breakdown (calculated from real vault TVL)
- Flow analysis (7d, 30d, % changes)
- Peer comparison table

### Protocols Tab
- Protocol stats (TVL, count, chains, 7d change)
- TVL by protocol chart
- Protocol rankings table with 24h/7d changes

### Vaults Tab
- Aggregate vault statistics (total TVL, vault count, avg APY, stablecoin count)
- **Yield Quality Analysis:**
  - TVL-weighted average APY breakdown (organic vs incentivized)
  - Yield quality score (High/Medium/Low based on organic %)
  - Vault categorization (Pure Organic, Mixed, Pure Incentivized)
  - Top organic yield vaults
- Top vaults by APY cards with yield quality indicators
- Full vault table with sortable columns:
  - Vault name, chain, protocol, TVL
  - Total APY, base APY, reward APY
  - Asset type (Stable/Volatile)

## Data Sources

- **DeFiLlama** - Primary source for TVL, protocol data, historical data
- **Dune Analytics** - Cross-referencing for curator/vault data (API integration ready)

Data is cross-referenced between sources when available, with confidence indicators.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Language**: TypeScript

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard
│   ├── curator/[slug]/page.tsx     # Curator detail page
│   └── api/
│       ├── overview/route.ts       # Market overview data
│       ├── curators/route.ts       # Curator rankings
│       ├── curators/historical/    # Historical TVL data
│       └── vaults/route.ts         # Vault-level data
├── components/
│   ├── ui/
│   │   ├── card.tsx
│   │   ├── stat-card.tsx
│   │   └── data-source-badge.tsx
│   └── charts/
│       ├── tvl-by-chain.tsx
│       ├── tvl-by-protocol.tsx
│       ├── curator-tvl-chart.tsx
│       ├── curator-leaderboard.tsx
│       ├── curator-comparison-chart.tsx
│       ├── historical-tvl-chart.tsx
│       ├── protocol-table.tsx
│       ├── vault-table.tsx
│       └── yield-quality-chart.tsx
├── lib/
│   ├── defillama.ts               # DeFiLlama API client
│   ├── dune.ts                    # Dune Analytics API client
│   └── utils.ts                   # Formatting utilities
└── types/
    └── index.ts                   # TypeScript interfaces
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Dune API key to .env.local
```

### Environment Variables

```env
DUNE_API_KEY=your_dune_api_key_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build

```bash
npm run build
npm start
```

## API Endpoints

### GET /api/overview
Returns market overview data including total TVL, chain breakdown, and protocol breakdown.

### GET /api/curators
Returns curator rankings with TVL, vault counts, APY, and flow data.

### GET /api/curators/historical
Returns historical TVL data for top curators.

Query params:
- `slug` (optional) - Get historical data for a specific curator

### GET /api/vaults
Returns vault-level data with APY breakdown.

Query params:
- `curator` (optional) - Filter vaults by curator slug
- `limit` (optional, default: 50) - Maximum number of vaults to return

## Tracked Protocols

**Vault Protocols:**
- Morpho / Morpho Blue
- Euler / Euler V2
- Yearn Finance
- Kamino (Solana)
- Mellow Protocol
- Gearbox
- Symbiotic
- Meteora (Solana)
- Drift (Solana)
- Sommelier
- Enzyme Finance

**Risk Curators:**
- Steakhouse Financial
- Gauntlet
- Sentora
- MEV Capital
- RE7 Labs
- K3 Capital
- Block Analitica
- Euler DAO
- And more...

## Roadmap

- [x] Overview dashboard with TVL breakdown
- [x] Curator leaderboard with rankings
- [x] Historical TVL charts
- [x] Curator detail pages
- [x] Brand colors for chains/curators/protocols
- [x] Vault-level data (individual vaults per curator)
- [x] Yield quality breakdown (organic vs incentivized)
- [ ] Search & filters
- [ ] Risk metrics (bad debt, drawdown)
- [ ] Smart money flow tracking

## License

MIT
