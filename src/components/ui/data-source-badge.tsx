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
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          {source}
        </a>
      ) : (
        <span className="text-gray-500">{source}</span>
      )}
    </div>
  );
}

// Data confidence indicator for cross-referenced data
interface DataConfidenceBadgeProps {
  confidence: 'high' | 'medium' | 'low' | undefined;
  tvlSource?: 'morpho' | 'defillama' | 'euler' | 'kamino';
  duneTvl?: number | null;
  defillamaTvl?: number;
  morphoTvl?: number;
  hasApyData?: boolean;
  showTooltip?: boolean;
}

export function DataConfidenceBadge({
  confidence,
  tvlSource,
  duneTvl,
  defillamaTvl,
  morphoTvl,
  hasApyData = true,
  showTooltip = true
}: DataConfidenceBadgeProps) {
  if (!confidence) return null;

  // On-chain sources get special treatment
  const isOnChain = tvlSource === 'morpho' || tvlSource === 'euler' || tvlSource === 'kamino';
  const hasOnChainData = (morphoTvl ?? 0) > 0;

  // Determine the reason for low confidence
  const getLowConfidenceDetails = () => {
    if (!hasOnChainData && !hasApyData) {
      return {
        label: 'Limited',
        description: 'No on-chain data or APY available. TVL from DeFiLlama protocol tracking only.',
      };
    }
    if (!hasOnChainData) {
      return {
        label: 'Limited',
        description: 'No on-chain verification. TVL from DeFiLlama only.',
      };
    }
    if (!hasApyData) {
      return {
        label: 'Partial',
        description: 'On-chain TVL available but APY data missing.',
      };
    }
    // Actual data discrepancy
    return {
      label: 'Unverified',
      description: 'Significant data discrepancy between sources (>15%)',
    };
  };

  const lowDetails = getLowConfidenceDetails();

  const config = {
    high: {
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
      label: isOnChain ? 'On-chain' : 'Verified',
      description: isOnChain
        ? `Authoritative ${tvlSource === 'morpho' ? 'Morpho' : tvlSource === 'euler' ? 'Euler' : 'Kamino'} smart contract data`
        : 'On-chain TVL verified with APY data available',
    },
    medium: {
      color: 'bg-amber-500',
      textColor: 'text-amber-600',
      label: 'Partial',
      description: hasOnChainData
        ? 'On-chain data available but some metrics missing'
        : (duneTvl ? 'Data sources differ (5-15%)' : 'Single source only, limited verification'),
    },
    low: {
      color: 'bg-gray-400',
      textColor: 'text-gray-500',
      label: lowDetails.label,
      description: lowDetails.description,
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
        <div className="absolute bottom-full right-0 mb-2 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] text-gray-500 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
          <p>{description}</p>
          {difference && (
            <p className="text-gray-400 mt-0.5">
              Difference: {difference}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}
