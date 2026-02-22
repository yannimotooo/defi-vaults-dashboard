import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      'rounded-[14px] border border-[#2d3548] bg-[#1a1f2e] transition-colors duration-200 hover:bg-[#212738]',
      className
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div className={cn('px-5 py-4 border-b border-[#2d3548]/50', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-[15px] font-semibold text-slate-100', className)}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[13px] text-slate-400 mt-0.5', className)}>
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
