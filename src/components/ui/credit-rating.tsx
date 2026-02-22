'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  type CreditRating,
  type PillarRating,
  type VaultCreditRating,
  type RatingFactor,
  RATING_COLORS,
  RATING_LABELS,
  isInvestmentGrade,
} from '@/lib/risk-rating';
import {
  Shield,
  Droplets,
  Users,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

// =============================================================================
// RATING BADGE - Compact display (like S&P bond ratings)
// =============================================================================

interface RatingBadgeProps {
  rating: CreditRating;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIG?: boolean; // Show Investment Grade indicator
  className?: string;
}

export function RatingBadge({
  rating,
  size = 'md',
  showLabel = false,
  showIG = false,
  className,
}: RatingBadgeProps) {
  const colors = RATING_COLORS[rating];
  const label = RATING_LABELS[rating];
  const ig = isInvestmentGrade(rating);

  const sizeClasses = {
    sm: 'text-[11px] px-1.5 py-0.5',
    md: 'text-[13px] px-2 py-1',
    lg: 'text-[15px] px-3 py-1.5',
  };

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'font-mono font-semibold rounded border',
          colors.bg,
          colors.text,
          colors.border,
          sizeClasses[size]
        )}
      >
        {rating}
      </span>
      {showLabel && (
        <span className={cn('text-slate-400', size === 'sm' ? 'text-[10px]' : 'text-[12px]')}>
          {label}
        </span>
      )}
      {showIG && (
        <span
          className={cn(
            'text-[9px] px-1.5 py-0.5 rounded-full font-medium',
            ig ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
          )}
        >
          {ig ? 'Investment Grade' : 'Speculative'}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// PILLAR BADGE - Shows individual pillar rating
// =============================================================================

interface PillarBadgeProps {
  pillar: 'capital' | 'liquidity' | 'curator';
  rating: PillarRating;
  compact?: boolean;
}

const PILLAR_CONFIG = {
  capital: {
    icon: Shield,
    label: 'Capital Safety',
    shortLabel: 'Capital',
    description: 'Risk of losing your deposit',
  },
  liquidity: {
    icon: Droplets,
    label: 'Liquidity Health',
    shortLabel: 'Liquidity',
    description: 'Ability to withdraw when needed',
  },
  curator: {
    icon: Users,
    label: 'Curator Quality',
    shortLabel: 'Curator',
    description: 'Management track record & practices',
  },
};

export function PillarBadge({ pillar, rating, compact = false }: PillarBadgeProps) {
  const config = PILLAR_CONFIG[pillar];
  const Icon = config.icon;
  const colors = RATING_COLORS[rating.rating];

  if (compact) {
    return (
      <div className="group relative inline-flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', colors.text)} />
        <span className={cn('font-mono text-[12px] font-medium', colors.text)}>
          {rating.rating}
        </span>

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-2 bg-[#111827]/90 border border-slate-700/40 rounded-lg text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
          <p className="text-white font-medium mb-1">{config.label}</p>
          <p className="text-slate-500">{config.description}</p>
          <p className={cn('mt-1', colors.text)}>
            Rating: {rating.rating} ({RATING_LABELS[rating.rating]})
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-3 rounded-lg border', colors.bg, colors.border)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', colors.text)} />
          <span className="text-[12px] text-slate-300 font-medium">{config.label}</span>
        </div>
        <span className={cn('font-mono text-[14px] font-semibold', colors.text)}>
          {rating.rating}
        </span>
      </div>
      <p className="text-[10px] text-slate-500">{config.description}</p>
    </div>
  );
}

// =============================================================================
// THREE PILLAR SUMMARY - Shows all three pillars in a row
// =============================================================================

interface ThreePillarSummaryProps {
  capitalSafety: PillarRating;
  liquidityHealth: PillarRating;
  curatorQuality: PillarRating;
  compact?: boolean;
}

export function ThreePillarSummary({
  capitalSafety,
  liquidityHealth,
  curatorQuality,
  compact = false,
}: ThreePillarSummaryProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <PillarBadge pillar="capital" rating={capitalSafety} compact />
        <span className="text-slate-600">|</span>
        <PillarBadge pillar="liquidity" rating={liquidityHealth} compact />
        <span className="text-slate-600">|</span>
        <PillarBadge pillar="curator" rating={curatorQuality} compact />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <PillarBadge pillar="capital" rating={capitalSafety} />
      <PillarBadge pillar="liquidity" rating={liquidityHealth} />
      <PillarBadge pillar="curator" rating={curatorQuality} />
    </div>
  );
}

// =============================================================================
// RATING FACTOR ROW - Shows individual factor assessment
// =============================================================================

interface RatingFactorRowProps {
  factor: RatingFactor;
}

function RatingFactorRow({ factor }: RatingFactorRowProps) {
  const assessmentConfig = {
    STRONG: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
    ADEQUATE: { color: 'text-slate-400', bg: 'bg-slate-500/10', icon: Minus },
    WEAK: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: AlertTriangle },
    CRITICAL: { color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle },
  };

  const config = assessmentConfig[factor.assessment];
  const Icon = config.icon;

  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-700/40 last:border-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-3.5 w-3.5', config.color)} />
          <span className="text-[12px] text-slate-300">{factor.name}</span>
          <span className="text-[10px] text-slate-600">({(factor.weight * 100).toFixed(0)}%)</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5 pl-5">{factor.detail}</p>
      </div>
      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', config.bg, config.color)}>
        {factor.assessment}
      </span>
    </div>
  );
}

// =============================================================================
// PILLAR DETAIL CARD - Full breakdown of a pillar
// =============================================================================

interface PillarDetailCardProps {
  pillar: 'capital' | 'liquidity' | 'curator';
  rating: PillarRating;
  defaultExpanded?: boolean;
}

export function PillarDetailCard({ pillar, rating, defaultExpanded = false }: PillarDetailCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const config = PILLAR_CONFIG[pillar];
  const Icon = config.icon;
  const colors = RATING_COLORS[rating.rating];

  const outlookConfig = {
    POSITIVE: { icon: TrendingUp, color: 'text-emerald-400', label: 'Positive' },
    STABLE: { icon: Minus, color: 'text-slate-400', label: 'Stable' },
    NEGATIVE: { icon: TrendingDown, color: 'text-red-400', label: 'Negative' },
    WATCH: { icon: AlertTriangle, color: 'text-amber-400', label: 'Watch' },
  };

  const outlook = outlookConfig[rating.outlook];
  const OutlookIcon = outlook.icon;

  return (
    <div className={cn('rounded-lg border', colors.border, 'bg-[#111827]/60')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/25 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-1.5 rounded', colors.bg)}>
            <Icon className={cn('h-4 w-4', colors.text)} />
          </div>
          <div className="text-left">
            <p className="text-[13px] text-white font-medium">{config.label}</p>
            <p className="text-[11px] text-slate-500">{config.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <OutlookIcon className={cn('h-3.5 w-3.5', outlook.color)} />
            <span className={cn('text-[11px]', outlook.color)}>{outlook.label}</span>
          </div>
          <span className={cn('font-mono text-[18px] font-semibold', colors.text)}>
            {rating.rating}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/40">
          <div className="mt-3 space-y-0">
            {rating.factors.map((factor, i) => (
              <RatingFactorRow key={i} factor={factor} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FULL CREDIT RATING CARD - Complete rating with all pillars
// =============================================================================

interface CreditRatingCardProps {
  rating: VaultCreditRating;
  vaultName?: string;
  showDetails?: boolean;
}

export function CreditRatingCard({ rating, vaultName, showDetails = true }: CreditRatingCardProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const colors = RATING_COLORS[rating.compositeRating];

  return (
    <div className="space-y-4">
      {/* Header with composite rating */}
      <div className={cn('p-4 rounded-lg border', colors.border, colors.bg)}>
        <div className="flex items-start justify-between">
          <div>
            {vaultName && (
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">
                Credit Rating
              </p>
            )}
            <div className="flex items-center gap-3">
              <span className={cn('font-mono text-[32px] font-bold', colors.text)}>
                {rating.compositeRating}
              </span>
              <div>
                <p className="text-[14px] text-white font-medium">
                  {RATING_LABELS[rating.compositeRating]}
                </p>
                <p className="text-[11px] text-slate-500">
                  {rating.investmentGrade ? 'Investment Grade' : 'Speculative Grade'}
                </p>
              </div>
            </div>
          </div>

          {/* Three pillar summary */}
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
              Pillar Ratings
            </p>
            <ThreePillarSummary
              capitalSafety={rating.capitalSafety}
              liquidityHealth={rating.liquidityHealth}
              curatorQuality={rating.curatorQuality}
              compact
            />
          </div>
        </div>

        {/* Rationale */}
        <p className="mt-3 text-[12px] text-slate-400 leading-relaxed">
          {rating.ratingRationale}
        </p>

        {/* Key risks and strengths */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          {rating.keyStrengths.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-emerald-400" />
                Key Strengths
              </p>
              <ul className="space-y-1">
                {rating.keyStrengths.map((strength, i) => (
                  <li key={i} className="text-[11px] text-emerald-400/80">
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rating.keyRisks.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-400" />
                Key Risks
              </p>
              <ul className="space-y-1">
                {rating.keyRisks.map((risk, i) => (
                  <li key={i} className="text-[11px] text-amber-400/80">
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Expandable pillar details */}
      {showDetails && (
        <div>
          <button
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="flex items-center gap-2 text-[12px] text-slate-500 hover:text-slate-300 transition-colors mb-3"
          >
            <Info className="h-3.5 w-3.5" />
            {detailsExpanded ? 'Hide' : 'Show'} detailed breakdown
            {detailsExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {detailsExpanded && (
            <div className="space-y-3">
              <PillarDetailCard pillar="capital" rating={rating.capitalSafety} />
              <PillarDetailCard pillar="liquidity" rating={rating.liquidityHealth} />
              <PillarDetailCard pillar="curator" rating={rating.curatorQuality} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COMPACT RATING FOR TABLES
// =============================================================================

interface CompactRatingProps {
  rating: VaultCreditRating;
  showPillars?: boolean;
}

export function CompactRating({ rating, showPillars = false }: CompactRatingProps) {
  const colors = RATING_COLORS[rating.compositeRating];

  return (
    <div className="group relative inline-flex items-center gap-2">
      <span
        className={cn(
          'font-mono text-[13px] font-semibold px-1.5 py-0.5 rounded border',
          colors.bg,
          colors.text,
          colors.border
        )}
      >
        {rating.compositeRating}
      </span>

      {showPillars && (
        <div className="flex items-center gap-1 text-[10px]">
          <span className={RATING_COLORS[rating.capitalSafety.rating].text}>
            {rating.capitalSafety.rating}
          </span>
          <span className="text-slate-600">/</span>
          <span className={RATING_COLORS[rating.liquidityHealth.rating].text}>
            {rating.liquidityHealth.rating}
          </span>
          <span className="text-slate-600">/</span>
          <span className={RATING_COLORS[rating.curatorQuality.rating].text}>
            {rating.curatorQuality.rating}
          </span>
        </div>
      )}

      {/* Hover tooltip - positioned below to avoid clipping */}
      <div className="absolute top-full left-0 mt-2 px-3 py-2.5 bg-[#111827]/90 border border-slate-700/40 rounded-lg text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl min-w-[220px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium">
            {rating.compositeRating} - {RATING_LABELS[rating.compositeRating]}
          </span>
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full',
            rating.investmentGrade ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
          )}>
            {rating.investmentGrade ? 'IG' : 'Spec'}
          </span>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-slate-700/40">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1">
              <Shield className="h-3 w-3" /> Capital
            </span>
            <span className={RATING_COLORS[rating.capitalSafety.rating].text}>
              {rating.capitalSafety.rating}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1">
              <Droplets className="h-3 w-3" /> Liquidity
            </span>
            <span className={RATING_COLORS[rating.liquidityHealth.rating].text}>
              {rating.liquidityHealth.rating}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1">
              <Users className="h-3 w-3" /> Curator
            </span>
            <span className={RATING_COLORS[rating.curatorQuality.rating].text}>
              {rating.curatorQuality.rating}
            </span>
          </div>
        </div>

        {rating.keyRisks.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-700/40">
            <p className="text-amber-400 text-[10px]">{rating.keyRisks[0]}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// RATING SCALE LEGEND
// =============================================================================

export function RatingScaleLegend() {
  const investmentGrade: CreditRating[] = ['AAA', 'AA', 'A', 'BBB'];
  const speculative: CreditRating[] = ['BB', 'B', 'CCC', 'CC', 'C'];

  return (
    <div className="p-4 bg-[#111827]/60 rounded-lg border border-slate-700/40">
      <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-3">
        Credit Rating Scale
      </p>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-emerald-400 mb-1.5">Investment Grade</p>
          <div className="flex flex-wrap gap-2">
            {investmentGrade.map((r) => (
              <div key={r} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'font-mono text-[11px] font-medium px-1.5 py-0.5 rounded border',
                    RATING_COLORS[r].bg,
                    RATING_COLORS[r].text,
                    RATING_COLORS[r].border
                  )}
                >
                  {r}
                </span>
                <span className="text-[10px] text-slate-500">{RATING_LABELS[r]}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-amber-400 mb-1.5">Speculative Grade</p>
          <div className="flex flex-wrap gap-2">
            {speculative.map((r) => (
              <div key={r} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'font-mono text-[11px] font-medium px-1.5 py-0.5 rounded border',
                    RATING_COLORS[r].bg,
                    RATING_COLORS[r].text,
                    RATING_COLORS[r].border
                  )}
                >
                  {r}
                </span>
                <span className="text-[10px] text-slate-500">{RATING_LABELS[r]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">
        Ratings inspired by S&P/Moody&apos;s methodology. Investment grade (BBB and above) indicates
        lower risk of capital loss. Speculative grade indicates elevated risk requiring careful consideration.
      </p>
    </div>
  );
}
