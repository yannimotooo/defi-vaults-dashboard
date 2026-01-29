import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      'rounded-lg border border-zinc-800/60 bg-zinc-900/40',
      className
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={cn('px-5 py-4 border-b border-zinc-800/60', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-[15px] font-semibold text-zinc-100', className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[13px] text-zinc-500 mt-0.5', className)}>
      {children}
    </p>
  );
}

export function CardContent({ children, className }: CardProps) {
  return (
    <div className={cn('p-5', className)}>
      {children}
    </div>
  );
}
