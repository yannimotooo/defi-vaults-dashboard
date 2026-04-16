import Link from 'next/link';
import { ArrowLeft, Shield, Droplets, Users, Info } from 'lucide-react';
import { RatingScaleLegend } from '@/components/ui/credit-rating';

export const metadata = {
  title: 'Rating Methodology — DeFi Vault Dashboard',
  description: 'How the dashboard computes credit ratings for curator-managed vaults.',
};

/**
 * Static methodology page (no client interactivity, no SWR — pure server
 * component). Linked from the "Est." badge that appears next to ratings
 * computed with fallback inputs (see ratingEstimated on Curator type).
 *
 * The goal here is trust: when a user sees a curator rated B vs BBB, they
 * should be able to click through and understand exactly what produced that
 * number, what data went in, and where defaults were used. This is the
 * "show your work" page.
 */
export default function MethodologyPage() {
  return (
    <div className="min-h-screen text-gray-900" style={{ background: 'var(--bg-primary)' }}>
      <header className="border-b border-gray-200 sticky top-0 z-50 backdrop-blur-md bg-white/95">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
          <span className="text-gray-300">·</span>
          <h1 className="text-[14px] font-semibold text-gray-900">Rating methodology</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Intro */}
        <section>
          <h2 className="text-[20px] font-semibold text-gray-900 mb-2">
            How curator ratings are computed
          </h2>
          <p className="text-[14px] text-gray-600 leading-relaxed">
            Each curator gets an S&amp;P-style letter rating ranging from <span className="font-mono">AAA</span>
            {' '}(strongest) to <span className="font-mono">C</span> (near-default). The composite rating is a
            weighted blend of three independent pillars assessed against real on-chain data.
          </p>
        </section>

        {/* Three pillars */}
        <section>
          <h2 className="text-[16px] font-semibold text-gray-900 mb-4">The three pillars</h2>
          <div className="space-y-3">
            <PillarBlock
              icon={<Shield className="h-4 w-4 text-indigo-600" />}
              name="Capital Safety"
              weight="50%"
              what="Risk that depositors lose principal."
              factors={[
                'Bad-debt exposure (35% of pillar)',
                'Collateral quality — blue-chip vs. exotic asset mix (25%)',
                'Oracle reliability — protocol-flagged red warnings (20%)',
                'LLTV conservatism — distance from liquidation thresholds (15%)',
                'Concentration risk — single-market exposure (5%)',
              ]}
            />
            <PillarBlock
              icon={<Droplets className="h-4 w-4 text-emerald-600" />}
              name="Liquidity Health"
              weight="30%"
              what="Ability to withdraw on demand without forced losses."
              factors={[
                'Available liquidity ratio — withdrawable now / total deposits (40%)',
                'Stress buffer — combined LLTV & utilization headroom (35%)',
                'Market depth — underlying protocol liquidity vs. position size (25%)',
              ]}
            />
            <PillarBlock
              icon={<Users className="h-4 w-4 text-amber-600" />}
              name="Curator Quality"
              weight="20%"
              what="Track record, governance posture, and operational maturity."
              factors={[
                'Track record — historical bad debt, incidents, age (40%)',
                'Risk management — asset allocation aggressiveness (30%)',
                'Diversification — multi-vault, multi-chain, multi-market (20%)',
                'Fee structure reasonableness (10%)',
              ]}
            />
          </div>
        </section>

        {/* Composite scoring */}
        <section>
          <h2 className="text-[16px] font-semibold text-gray-900 mb-3">Composite scoring</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-[13px] text-gray-700 leading-relaxed">
            <p>
              Each pillar produces a 0–100 score (higher = riskier). The composite is:
            </p>
            <p
              className="my-3 px-3 py-2 bg-gray-50 rounded font-mono text-[12px] text-gray-800"
            >
              composite = capital × 0.50 + liquidity × 0.30 + curator × 0.20
            </p>
            <p>
              The composite score is mapped to a letter rating using the scale below.
            </p>
          </div>
        </section>

        {/* Rating scale */}
        <section>
          <RatingScaleLegend />
        </section>

        {/* Estimated badge explainer */}
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h2 className="text-[14px] font-semibold text-amber-900 flex items-center gap-2 mb-2">
            <Info className="h-4 w-4" />
            What does the "Est." badge mean?
          </h2>
          <div className="text-[13px] text-amber-800 leading-relaxed space-y-2">
            <p>
              When a curator's rating is shown with an <strong>Est.</strong> chip, it means we
              didn't have direct on-chain data for one or more rating inputs and used
              conservative defaults instead. Specifically, the affected inputs are:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><span className="font-mono text-[12px]">avgLltv</span> — TVL-weighted average liquidation LTV across the curator's markets</li>
              <li><span className="font-mono text-[12px]">maxUtilization</span> — peak utilization across markets</li>
              <li><span className="font-mono text-[12px]">availableLiquidityUsd</span> — sum of immediately withdrawable liquidity</li>
            </ul>
            <p>
              These defaults (LLTV 0.86, max utilization 0.85, liquidity = 20% of TVL) are chosen
              to be slightly conservative — i.e. they don't artificially boost a rating. But a
              real on-chain measurement might move the rating up or down. We surface the badge
              so you know to weight estimated ratings appropriately.
            </p>
            <p>
              The dashboard has real LLTV data for ~10–12 curators today (those whose vaults
              are mapped to Morpho markets via the protocol's vault-allocation API). Coverage
              for Euler / Kamino / Veda / Mellow markets is in progress.
            </p>
          </div>
        </section>

        {/* Caveats */}
        <section>
          <h2 className="text-[16px] font-semibold text-gray-900 mb-3">Important caveats</h2>
          <div className="space-y-2 text-[13px] text-gray-600 leading-relaxed">
            <p>
              <strong>Not investment advice.</strong> Ratings are mechanical scores from public on-chain
              data. They don't account for off-chain factors like team quality, regulatory exposure,
              or counterparty risk in centralized integrations.
            </p>
            <p>
              <strong>Bad-debt and incident data are limited.</strong> We track Morpho-realized bad
              debt via the protocol API. Pre-Morpho governance incidents, audit failures, and
              CEX-related events are NOT captured in the curator-quality pillar.
            </p>
            <p>
              <strong>New curators are penalized.</strong> Curators with under 3 months of operational
              history get a 20-point maturity penalty in the curator-quality pillar. This may
              under-rate fast-growing legitimate entrants.
            </p>
            <p>
              <strong>Methodology evolves.</strong> Thresholds and weights are calibrated based on
              real-world outcomes; expect changes when the model is improved. See the source at
              {' '}
              <code className="text-[12px] bg-gray-100 px-1 rounded">src/lib/risk-rating.ts</code>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function PillarBlock({
  icon,
  name,
  weight,
  what,
  factors,
}: {
  icon: React.ReactNode;
  name: string;
  weight: string;
  what: string;
  factors: string[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-[14px] font-semibold text-gray-900">{name}</h3>
        </div>
        <span className="text-[11px] text-gray-500 font-mono">weight: {weight}</span>
      </div>
      <p className="text-[12px] text-gray-600 mb-3">{what}</p>
      <ul className="text-[12px] text-gray-700 space-y-1 pl-4 list-disc marker:text-gray-300">
        {factors.map(f => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
