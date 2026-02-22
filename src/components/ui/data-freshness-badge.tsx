'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataFreshnessBadgeProps {
  timestamp: string;
  sources?: string;
  className?: string;
}

export function DataFreshnessBadge({ timestamp, sources, className }: DataFreshnessBadgeProps) {
  const [timeAgo, setTimeAgo] = useState<string>('updating...');
  const [status, setStatus] = useState<'fresh' | 'stale' | 'old'>('fresh');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const updateTime = () => {
      const now = Date.now();
      const updated = new Date(timestamp).getTime();
      const diffMs = now - updated;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);

      if (diffMins < 1) {
        setTimeAgo('just now');
        setStatus('fresh');
      } else if (diffMins < 60) {
        setTimeAgo(`${diffMins}m ago`);
        setStatus(diffMins < 5 ? 'fresh' : 'stale');
      } else if (diffHours < 24) {
        setTimeAgo(`${diffHours}h ago`);
        setStatus('old');
      } else {
        setTimeAgo(`${Math.floor(diffHours / 24)}d ago`);
        setStatus('old');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [timestamp]);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={cn('flex items-center gap-3 text-[11px]', className)}>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-500/10">
          <Clock className="h-3 w-3 text-slate-400" />
          <span className="text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  const statusConfig = {
    fresh: {
      icon: CheckCircle,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      label: 'Live',
    },
    stale: {
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      label: 'Cached',
    },
    old: {
      icon: AlertCircle,
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/10',
      label: 'Stale',
    },
  };

  const config = statusConfig[status];
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
        <span className="text-slate-500">·</span>
        <span className="text-slate-400">{timeAgo}</span>
      </div>

      {/* Source badges - hidden on smaller screens to prevent wrapping */}
      {sourceList.length > 0 && (
        <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
          <span className="text-slate-600">Sources:</span>
          {sourceList.slice(0, 3).map((source, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 text-[10px] bg-slate-800/60 text-slate-400 rounded truncate max-w-[100px]"
              title={source}
            >
              {source}
            </span>
          ))}
          {sourceList.length > 3 && (
            <span className="text-[10px] text-slate-600">+{sourceList.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

// Compact version for tight spaces
export function DataFreshnessIndicator({ timestamp }: { timestamp: string }) {
  const [status, setStatus] = useState<'fresh' | 'stale' | 'old'>('fresh');

  useEffect(() => {
    const diffMins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (diffMins < 5) setStatus('fresh');
    else if (diffMins < 60) setStatus('stale');
    else setStatus('old');
  }, [timestamp]);

  const colors = {
    fresh: 'bg-emerald-500',
    stale: 'bg-amber-500',
    old: 'bg-slate-500',
  };

  return (
    <div
      className={cn('w-2 h-2 rounded-full', colors[status])}
      title={`Data updated: ${new Date(timestamp).toLocaleTimeString()}`}
    />
  );
}
