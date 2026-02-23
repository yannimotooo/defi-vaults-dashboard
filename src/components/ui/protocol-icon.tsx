'use client';

import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

function MorphoIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#2470FF" />
      <path d="M8 22V12l8 5 8-5v10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EulerIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#E8394A" />
      <text x="16" y="21" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700" fontFamily="serif">e</text>
    </svg>
  );
}

function KaminoIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#00D1A0" />
      <path d="M10 22V10l6 6 6-6v12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AaveIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#B6509E" />
      <path d="M11 22l5-12 5 12M13 18h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#F4B731" />
      <path d="M16 8l2 7h7l-6 4 2 7-5-4-5 4 2-7-6-4h7z" fill="#fff" />
    </svg>
  );
}

function YearnIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#006AE3" />
      <path d="M10 12l6 6 6-6M16 18v4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CompoundIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#00D395" />
      <circle cx="16" cy="16" r="6" stroke="#fff" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

function DefaultProtocolIcon({ size = 16, className, label }: IconProps & { label: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#475569" />
      <text x="16" y="21" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="600">
        {label.charAt(0).toUpperCase()}
      </text>
    </svg>
  );
}

const PROTOCOL_ICON_MAP: Record<string, (props: IconProps) => ReactNode> = {
  'Morpho': MorphoIcon,
  'morpho': MorphoIcon,
  'Morpho V2': MorphoIcon,
  'Morpho v2': MorphoIcon,
  'Euler': EulerIcon,
  'euler': EulerIcon,
  'Euler v2': EulerIcon,
  'Euler V2': EulerIcon,
  'Kamino': KaminoIcon,
  'kamino': KaminoIcon,
  'Aave': AaveIcon,
  'aave': AaveIcon,
  'Spark': SparkIcon,
  'spark': SparkIcon,
  'Yearn': YearnIcon,
  'yearn': YearnIcon,
  'Yearn Finance': YearnIcon,
  'Compound': CompoundIcon,
  'compound': CompoundIcon,
};

export function ProtocolIcon({ name, size = 16, className }: IconProps & { name: string }) {
  // Try exact match first
  let IconComponent = PROTOCOL_ICON_MAP[name];
  // Fallback: prefix match (handles "Euler v2", "Yearn Finance", etc.)
  if (!IconComponent) {
    const lower = name.toLowerCase();
    for (const [key, component] of Object.entries(PROTOCOL_ICON_MAP)) {
      if (lower.startsWith(key.toLowerCase()) || key.toLowerCase().startsWith(lower)) {
        IconComponent = component;
        break;
      }
    }
  }
  if (IconComponent) return <IconComponent size={size} className={className} />;
  return <DefaultProtocolIcon size={size} className={className} label={name} />;
}

// Chain icons

function EthereumIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path d="M16 4l-0.2 0.7V20l0.2 0.2 8-4.7z" fill="#fff" fillOpacity="0.6" />
      <path d="M16 4l-8 11.5 8 4.7z" fill="#fff" />
      <path d="M16 22l-0.1 0.1v6.1l0.1 0.2 8-11.3z" fill="#fff" fillOpacity="0.6" />
      <path d="M16 28.4V22l-8-4.9z" fill="#fff" />
    </svg>
  );
}

function ArbitrumIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#213147" />
      <path d="M16 6l8 14H8z" stroke="#28A0F0" strokeWidth="2" fill="none" />
      <path d="M16 12l4 8h-8z" fill="#28A0F0" />
    </svg>
  );
}

function BaseIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#0052FF" />
      <circle cx="16" cy="16" r="8" stroke="#fff" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

function OptimismIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#FF0420" />
      <circle cx="16" cy="16" r="6" fill="#fff" />
    </svg>
  );
}

function SolanaIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#000" />
      <path d="M10 20.5h10l2-2.5H12z" fill="url(#sol-grad)" />
      <path d="M10 14h10l2-2.5H12z" fill="url(#sol-grad)" />
      <path d="M22 17.5H12l-2 2.5h10z" fill="url(#sol-grad)" />
      <defs>
        <linearGradient id="sol-grad" x1="10" y1="14" x2="22" y2="20">
          <stop stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function PolygonIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#8247E5" />
      <path d="M20 13l-4-2.3-4 2.3v4.6l4 2.3 4-2.3z" fill="#fff" />
    </svg>
  );
}

function DefaultChainIcon({ size = 16, className, label }: IconProps & { label: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="16" fill="#334155" />
      <text x="16" y="21" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="600">
        {label.slice(0, 2).toUpperCase()}
      </text>
    </svg>
  );
}

const CHAIN_ICON_MAP: Record<string, (props: IconProps) => ReactNode> = {
  'Ethereum': EthereumIcon,
  'ethereum': EthereumIcon,
  'Arbitrum': ArbitrumIcon,
  'arbitrum': ArbitrumIcon,
  'Base': BaseIcon,
  'base': BaseIcon,
  'Optimism': OptimismIcon,
  'optimism': OptimismIcon,
  'Solana': SolanaIcon,
  'solana': SolanaIcon,
  'Polygon': PolygonIcon,
  'polygon': PolygonIcon,
};

export function ChainIcon({ name, size = 16, className }: IconProps & { name: string }) {
  const IconComponent = CHAIN_ICON_MAP[name];
  if (IconComponent) return <IconComponent size={size} className={className} />;
  return <DefaultChainIcon size={size} className={className} label={name} />;
}
