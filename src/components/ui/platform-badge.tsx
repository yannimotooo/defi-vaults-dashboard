import { cn } from '@/lib/utils';

/**
 * Subtle "Used by X" badges shown next to a curator's name when we know
 * which institutional platform consumes their vaults (e.g. "Coinbase Earn"
 * for Steakhouse, "Kraken Earn" for Veda).
 *
 * Visual treatment is distinct from StrategyTag — these are *external*
 * relationships rather than internal classifications, so we render them with
 * a "Used by" prefix and a softer slate-blue color to differentiate at a
 * glance. The `source` is exposed via title attribute for hover provenance.
 */

interface PlatformBadgeProps {
  name: string;
  source?: string;
  className?: string;
}

export function PlatformBadge({ name, source, className }: PlatformBadgeProps) {
  return (
    <span
      title={source ? `${name} — Source: ${source}` : name}
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium rounded',
        'bg-slate-100 text-slate-700 border border-slate-200',
        className,
      )}
    >
      <span className="text-slate-400 font-normal">Used by</span> {name}
    </span>
  );
}

interface PlatformBadgesProps {
  platforms: Array<{ name: string; source?: string }>;
  max?: number;
  className?: string;
}

export function PlatformBadges({ platforms, max = 2, className }: PlatformBadgesProps) {
  if (!platforms || platforms.length === 0) return null;
  const visible = platforms.slice(0, max);
  const remaining = platforms.length - max;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visible.map(p => (
        <PlatformBadge key={p.name} name={p.name} source={p.source} />
      ))}
      {remaining > 0 && (
        <span className="text-[9px] text-gray-400 self-center">+{remaining}</span>
      )}
    </div>
  );
}
