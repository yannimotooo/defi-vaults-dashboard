'use client';

import { Shield, AlertTriangle, AlertOctagon } from 'lucide-react';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface RiskBadgeProps {
  riskLevel: RiskLevel;
  riskScore?: number;
  compact?: boolean;
  showTooltip?: boolean;
}

const riskConfig: Record<RiskLevel, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Shield;
  label: string;
}> = {
  LOW: {
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: Shield,
    label: 'Low Risk',
  },
  MEDIUM: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: AlertTriangle,
    label: 'Medium Risk',
  },
  HIGH: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: AlertTriangle,
    label: 'High Risk',
  },
  CRITICAL: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: AlertOctagon,
    label: 'Critical Risk',
  },
};

export function RiskBadge({ riskLevel, riskScore, compact = false, showTooltip = true }: RiskBadgeProps) {
  const config = riskConfig[riskLevel];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className="group relative inline-flex items-center">
        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${config.bgColor} border ${config.borderColor}`}>
          <Icon className={`w-3 h-3 ${config.color}`} />
          <span className={`text-[10px] font-medium ${config.color}`}>{riskLevel}</span>
        </div>

        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-white border border-gray-200 rounded text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
            <p className={config.color}>{config.label}</p>
            {riskScore !== undefined && (
              <p className="text-gray-500">Score: {riskScore}/100</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
      <Icon className={`w-4 h-4 ${config.color}`} />
      <div>
        <span className={`text-[12px] font-medium ${config.color}`}>{config.label}</span>
        {riskScore !== undefined && (
          <span className="text-[11px] text-gray-500 ml-2">({riskScore}/100)</span>
        )}
      </div>
    </div>
  );
}

// Risk score bar visualization
interface RiskScoreBarProps {
  score: number;
  showLabel?: boolean;
}

export function RiskScoreBar({ score, showLabel = true }: RiskScoreBarProps) {
  const getColor = (s: number) => {
    if (s >= 70) return 'bg-red-500';
    if (s >= 40) return 'bg-orange-500';
    if (s >= 20) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor(score)} rounded-full transition-all`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] text-gray-500 font-mono w-8">{score}</span>
      )}
    </div>
  );
}
