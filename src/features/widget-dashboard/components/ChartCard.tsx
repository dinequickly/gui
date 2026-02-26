import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';

interface ChartProps {
  title: string;
  labels: string[];
  series: number[];
}

export function ChartCard({ item }: WidgetComponentProps) {
  const { title, labels, series } = item.props as unknown as ChartProps;
  const maxValue = Math.max(...series, 1);

  const points = series
    .map((value, index) => {
      const x = 28 + (index * 432) / Math.max(series.length - 1, 1);
      const y = 180 - (value / maxValue) * 132;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `28,180 ${points} 460,180`;

  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="chart-card">
        <h3>{title}</h3>
        <svg viewBox="0 0 488 190" role="img" aria-label={`${title} line chart`}>
          <defs>
            <linearGradient id={`${item.id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(148, 227, 154, 0.72)" />
              <stop offset="100%" stopColor="rgba(148, 227, 154, 0.06)" />
            </linearGradient>
          </defs>
          {Array.from({ length: 5 }).map((_, i) => {
            const y = 26 + i * 38;
            return <line key={i} x1="28" y1={y} x2="460" y2={y} className="chart-grid" />;
          })}
          {labels.map((_, i) => {
            const x = 28 + (i * 432) / Math.max(labels.length - 1, 1);
            return <line key={i} x1={x} y1="24" x2={x} y2="180" className="chart-grid chart-grid-v" />;
          })}
          <polygon points={areaPoints} fill={`url(#${item.id}-fill)`} />
          <polyline points={points} fill="none" stroke="rgba(139, 226, 144, 0.94)" strokeWidth="2.2" />
          {labels.map((label, i) => {
            const x = 28 + (i * 432) / Math.max(labels.length - 1, 1);
            return (
              <text key={label + i} x={x} y="188" textAnchor="middle" className="chart-label">
                {label}
              </text>
            );
          })}
        </svg>
      </div>
    </GlassCardShell>
  );
}
