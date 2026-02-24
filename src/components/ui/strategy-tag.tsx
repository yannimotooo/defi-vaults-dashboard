import { cn } from '@/lib/utils';

const TAG_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'High Yield': { bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-500/20' },
  'Conservative': { bg: 'bg-blue-500/10', text: 'text-blue-700', border: 'border-blue-500/20' },
  'Multi-Chain': { bg: 'bg-purple-500/10', text: 'text-purple-700', border: 'border-purple-500/20' },
  'Multi-Protocol': { bg: 'bg-indigo-500/10', text: 'text-indigo-700', border: 'border-indigo-500/20' },
  'Large Cap': { bg: 'bg-amber-500/10', text: 'text-amber-700', border: 'border-amber-500/20' },
  'Stablecoin Focus': { bg: 'bg-cyan-500/10', text: 'text-cyan-700', border: 'border-cyan-500/20' },
};

const DEFAULT_STYLE = { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };

interface StrategyTagProps {
  tag: string;
  className?: string;
}

export function StrategyTag({ tag, className }: StrategyTagProps) {
  const style = TAG_STYLES[tag] || DEFAULT_STYLE;

  return (
    <span
      className={cn(
        'inline-block px-1.5 py-0.5 text-[9px] font-medium rounded border',
        style.bg, style.text, style.border,
        className
      )}
    >
      {tag}
    </span>
  );
}

interface StrategyTagsProps {
  tags: string[];
  max?: number;
  className?: string;
}

export function StrategyTags({ tags, max = 3, className }: StrategyTagsProps) {
  if (!tags || tags.length === 0) return null;

  const visible = tags.slice(0, max);
  const remaining = tags.length - max;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visible.map(tag => (
        <StrategyTag key={tag} tag={tag} />
      ))}
      {remaining > 0 && (
        <span className="text-[9px] text-gray-400 self-center">+{remaining}</span>
      )}
    </div>
  );
}
