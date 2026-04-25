'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataFreshnessBadgeProps {
  timestamp: string;
  sources?: string;
  className?: string;
}

type FreshnessStatus = 'fresh' | 'stale' | 'old';

function getFreshness(timestamp: string): { timeAgo: string; status: FreshnessStatus } {
  const now = Date.now();
  const updated = new Date(timestamp).getTime();
  const diffMs = now - updated;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return { timeAgo: 'just now', status: 'fresh' };
  if (diffMins < 60) return { timeAgo: `${diffMins}m ago`, status: diffMins < 5 ? 'fresh' : 'stale' };
  if (diffHours < 24) return { timeAgo: `${diffHours}h ago`, status: 'old' };
  return { timeAgo: `${Math.floor(diffHours / 24)}d ago`, status: 'old' };
}

export function DataFreshnessBadge({ timestamp, sources, className }: DataFreshnessBadgeProps) {
  const [freshness, setFreshness] = useState<{ timeAgo: string; status: FreshnessStatus } | null>(null);

  useEffect(() => {
    const updateTime = () => setFreshness(getFreshness(timestamp));
    const initial = setTimeout(updateTime, 0);
    const interval = setInterval(updateTime, 30000); // Update every 30 seconds

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [timestamp]);

  // Prevent hydration mismatch
  if (!freshness) {
    return (
      <div className={cn('flex items-center gap-3 text-[11px]', className)}>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100">
          <Clock className="h-3 w-3 text-gray-500" />
          <span className="text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  const statusConfig = {
    fresh: {
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      label: 'Live',
    },
    stale: {
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      label: 'Cached',
    },
    old: {
      icon: AlertCircle,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      label: 'Stale',
    },
  };

  const config = statusConfig[freshness.status];
  const Icon = config.icon;

  // Parse sources string to show as badges
  const sourceList = sources?.split(' + ').map(s => {
    // Clean up source names for display
    const cleaned = s.replace(/\s*\(\d+\)/g, '').trim();
    return cleaned;
  }).slice(0, 4) || []; // Show max 4 sources

  return (
    <div className={cn('flex items-center gap-3 text-[11px]', className)}>
      {/* Status indicator */}
      <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full', config.bgColor)}>
        <Icon className={cn('h-3 w-3', config.color)} />
        <span className={config.color}>{config.label}</span>
        <span className="text-gray-500">·</span>
        <span className="text-gray-500">{freshness.timeAgo}</span>
      </div>

      {/* Source badges - hidden on smaller screens to prevent wrapping */}
      {sourceList.length > 0 && (
        <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
          <span className="text-gray-400">Sources:</span>
          {sourceList.slice(0, 3).map((source, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded truncate max-w-[100px]"
              title={source}
            >
              {source}
            </span>
          ))}
          {sourceList.length > 3 && (
            <span className="text-[10px] text-gray-400">+{sourceList.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Compact version for tight spaces
export function DataFreshnessIndicator({ timestamp }: { timestamp: string }) {
  const [status, setStatus] = useState<FreshnessStatus | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setStatus(getFreshness(timestamp).status), 0);
    return () => clearTimeout(id);
  }, [timestamp]);

  const colors = {
    fresh: 'bg-emerald-500',
    stale: 'bg-amber-500',
    old: 'bg-gray-500',
  };

  return (
    <div
      className={cn('w-2 h-2 rounded-full', colors[status ?? 'old'])}
      title={`Data updated: ${new Date(timestamp).toLocaleTimeString()}`}
    />
  );
}
