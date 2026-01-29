'use client';

interface DataSourceBadgeProps {
  source: string;
  timestamp?: string;
  verified?: boolean;
  url?: string;
}

export function DataSourceBadge({ source, verified = true, url }: DataSourceBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 text-[12px]">
      <div className={`w-1.5 h-1.5 rounded-full ${verified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          {source}
        </a>
      ) : (
        <span className="text-zinc-400">{source}</span>
      )}
    </div>
  );
}

// Data confidence indicator for cross-referenced data
interface DataConfidenceBadgeProps {
  confidence: 'high' | 'medium' | 'low' | undefined;
  duneTvl?: number | null;
  defillamaTvl?: number;
  showTooltip?: boolean;
}

export function DataConfidenceBadge({
  confidence,
  duneTvl,
  defillamaTvl,
  showTooltip = true
}: DataConfidenceBadgeProps) {
  if (!confidence) return null;

  const config = {
    high: {
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      label: 'Verified',
      description: 'DeFiLlama & Dune data match (<5% difference)',
    },
    medium: {
      color: 'bg-amber-500',
      textColor: 'text-amber-400',
      label: 'Partial',
      description: duneTvl ? 'Data sources differ (5-15%)' : 'Single source only',
    },
    low: {
      color: 'bg-red-500',
      textColor: 'text-red-400',
      label: 'Unverified',
      description: 'Significant data discrepancy (>15%)',
    },
  };

  const { color, textColor, label, description } = config[confidence];

  // Calculate difference if both values exist
  const difference = duneTvl && defillamaTvl
    ? ((defillamaTvl - duneTvl) / defillamaTvl * 100).toFixed(1)
    : null;

  return (
    <div className="group relative inline-flex items-center gap-1">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className={`text-[10px] ${textColor}`}>{label}</span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-[11px] text-zinc-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          <p>{description}</p>
          {difference && (
            <p className="text-zinc-500 mt-0.5">
              Difference: {difference}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}
