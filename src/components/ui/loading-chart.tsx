'use client';

import { useMemo } from 'react';
import { Vault } from 'lucide-react';

interface LoadingChartProps {
  progress: number; // 0-100
  stage?: string;
}

export function LoadingChart({ progress, stage }: LoadingChartProps) {
  const width = 480;
  const height = 220;
  const pad = { top: 20, right: 20, bottom: 35, left: 52 };

  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  // Deterministic zigzag path that looks like TVL growth
  const points = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    const steps = 28;
    // Pseudo-random noise values (deterministic)
    const noise = [
      0.32, 0.71, 0.18, 0.84, 0.53, 0.09, 0.91, 0.42, 0.67, 0.28, 0.76,
      0.14, 0.88, 0.36, 0.62, 0.47, 0.79, 0.21, 0.55, 0.38, 0.83, 0.11,
      0.69, 0.44, 0.73, 0.26, 0.58, 0.95, 0.87,
    ];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = pad.left + t * chartW;
      // S-curve upward trend (slow start, fast middle, slowing top)
      const trend = chartH * 0.7 * (1 / (1 + Math.exp(-8 * (t - 0.4))));
      // Zigzag noise
      const jitter = (noise[i % noise.length] - 0.5) * chartH * 0.18;
      const y = pad.top + chartH - trend + jitter;
      pts.push({ x, y });
    }
    return pts;
  }, [chartW, chartH, pad.left, pad.top]);

  // Path strings
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    linePath +
    ` L${points[points.length - 1].x.toFixed(1)},${(height - pad.bottom).toFixed(1)}` +
    ` L${pad.left},${height - pad.bottom} Z`;

  // Path length for stroke-dasharray animation
  const pathLength = useMemo(() => {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return Math.ceil(len);
  }, [points]);

  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const dashOffset = pathLength * (1 - clampedProgress / 100);

  // Current tip position
  const tipIdx = Math.min(
    Math.floor((clampedProgress / 100) * (points.length - 1)),
    points.length - 1,
  );
  const tip = points[tipIdx];

  // Y-axis grid lines (fake TVL values for atmosphere)
  const yGrid = [
    { pct: 0.25, label: '$5B' },
    { pct: 0.5, label: '$10B' },
    { pct: 0.75, label: '$15B' },
  ];

  // X-axis month labels — dynamic last 6 months
  const months = useMemo(() => {
    const now = new Date();
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleString('en-US', { month: 'short' }));
    }
    return labels;
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Branding */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
          <Vault className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-gray-900 leading-tight">
            DeFi Vault Dashboard
          </h1>
          <p className="text-[11px] text-gray-500">
            Cross-chain vault & curator analytics
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full max-w-[520px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ filter: 'drop-shadow(0 0 20px rgba(79, 70, 229, 0.06))' }}
        >
          {/* Y-axis grid lines */}
          {yGrid.map((line, i) => {
            const y = pad.top + chartH * (1 - line.pct);
            return (
              <g key={i}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeDasharray="3 6"
                  strokeOpacity={0.8}
                />
                <text
                  x={pad.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#9CA3AF"
                  fontSize={9}
                  fontFamily="var(--font-jetbrains-mono), monospace"
                >
                  {line.label}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {months.map((m, i) => {
            const x = pad.left + (i / (months.length - 1)) * chartW;
            return (
              <text
                key={`${m}-${i}`}
                x={x}
                y={height - pad.bottom + 18}
                textAnchor="middle"
                fill="#9CA3AF"
                fontSize={9}
                fontFamily="var(--font-jetbrains-mono), monospace"
              >
                {m}
              </text>
            );
          })}

          {/* Baseline */}
          <line
            x1={pad.left}
            y1={height - pad.bottom}
            x2={width - pad.right}
            y2={height - pad.bottom}
            stroke="#E5E7EB"
            strokeOpacity={0.8}
          />

          {/* Area fill (clipped to progress) */}
          <defs>
            <linearGradient id="load-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.02} />
            </linearGradient>
            <clipPath id="load-clip">
              <rect
                x={pad.left}
                y={0}
                width={chartW * (clampedProgress / 100)}
                height={height}
                style={{ transition: 'width 0.5s ease-out' }}
              />
            </clipPath>
          </defs>
          <path d={areaPath} fill="url(#load-area)" clipPath="url(#load-clip)" />

          {/* Chart line (stroke reveal) */}
          <path
            d={linePath}
            fill="none"
            stroke="#4F46E5"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
          />

          {/* Pulsing tip dot */}
          {clampedProgress > 2 && clampedProgress < 100 && (
            <g>
              <circle cx={tip.x} cy={tip.y} r={8} fill="#4F46E5" opacity={0.12}>
                <animate
                  attributeName="r"
                  values="6;12;6"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.15;0.04;0.15"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx={tip.x} cy={tip.y} r={3.5} fill="#4F46E5" />
              <circle cx={tip.x} cy={tip.y} r={1.5} fill="#fff" />
            </g>
          )}

          {/* Completion checkmark at end */}
          {clampedProgress >= 100 && (
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r={4}
              fill="#059669"
              className="animate-pulse"
            />
          )}
        </svg>

        {/* Progress bar + text */}
        <div className="mt-5 px-1">
          {/* Thin progress bar */}
          <div className="h-[3px] bg-gray-200 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full"
              style={{
                width: `${clampedProgress}%`,
                background:
                  clampedProgress >= 100
                    ? '#059669'
                    : 'linear-gradient(90deg, #4F46E5, #6366f1)',
                transition: 'width 0.5s ease-out, background 0.3s',
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-gray-500">{stage || 'Initializing...'}</span>
            <span
              className="text-[15px] font-semibold tabular-nums"
              style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                color: clampedProgress >= 100 ? '#059669' : '#4F46E5',
              }}
            >
              {Math.round(clampedProgress)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
