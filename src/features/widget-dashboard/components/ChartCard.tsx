import { useEffect, useMemo, useState } from 'react';
import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';

interface ChartProps {
  title: string;
  labels: string[];
  series: number[];
}

const GRABBIT_URL = '/api/grabbit/run';
const GRABBIT_HEADERS = {
  'Content-Type': 'application/json',
};
const LIVE_POLL_MS = 15_000;

function parseLiveSeries(payload: unknown): { labels: string[]; series: number[] } | null {
  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  };
  const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const asNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/,/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const root = asRecord(payload);
  if (!root) return null;

  const candidates: unknown[] = [
    root.prices,
    root.series,
    asRecord(root.data)?.prices,
    asRecord(root.data)?.series,
    asRecord(root.outputs)?.prices,
    asRecord(root.outputs)?.series,
    asRecord(root.output)?.prices,
    asRecord(root.output)?.series,
    asRecord(asRecord(root.data)?.outputs)?.prices,
    asRecord(asRecord(root.data)?.outputs)?.series,
  ];

  for (const candidate of candidates) {
    const rows = asArray(candidate);
    if (rows.length === 0) continue;
    const points = rows
      .map((row, index) => {
        const rec = asRecord(row);
        if (rec) {
          const value = asNumber(rec.price ?? rec.close ?? rec.value ?? rec.y);
          if (value == null) return null;
          const rawLabel = rec.label ?? rec.time ?? rec.timestamp ?? rec.date ?? rec.x;
          return { label: typeof rawLabel === 'string' ? rawLabel : `${index + 1}`, value };
        }

        const value = asNumber(row);
        if (value == null) return null;
        return { label: `${index + 1}`, value };
      })
      .filter((item): item is { label: string; value: number } => item !== null);

    if (points.length > 1) {
      return {
        labels: points.map((point) => point.label),
        series: points.map((point) => point.value),
      };
    }
  }

  return null;
}

export function ChartCard({ item }: WidgetComponentProps) {
  const { title, labels, series } = item.props as unknown as ChartProps;
  const isAppleCard = item.id === 'appl-chart' || title.toUpperCase() === 'AAPL' || title.toUpperCase() === 'APPL';
  const [liveSeries, setLiveSeries] = useState<{ labels: string[]; series: number[] } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isAppleCard);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAppleCard) return;
    let cancelled = false;
    let pollId: number | null = null;

    const run = async () => {
      try {
        const response = await fetch(GRABBIT_URL, {
          method: 'POST',
          headers: GRABBIT_HEADERS,
          body: JSON.stringify({
            inputs: {
              symbol: 'AAPL',
              exchange: 'XNAS',
            },
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        const parsed = parseLiveSeries(json);
        if (!parsed) throw new Error('Unrecognized payload shape');
        if (!cancelled) {
          setLiveSeries(parsed);
          setLiveError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLiveError(error instanceof Error ? error.message : 'Fetch failed');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    pollId = window.setInterval(() => {
      void run();
    }, LIVE_POLL_MS);

    return () => {
      cancelled = true;
      if (pollId != null) window.clearInterval(pollId);
    };
  }, [isAppleCard]);

  const effective = useMemo(() => {
    if (liveSeries && liveSeries.series.length > 1) return liveSeries;
    return { labels, series };
  }, [labels, liveSeries, series]);

  const maxValue = Math.max(...effective.series, 1);
  const latestPrice = effective.series[effective.series.length - 1];
  const latestLabel = effective.labels[effective.labels.length - 1];

  const points = effective.series
    .map((value, index) => {
      const x = 28 + (index * 432) / Math.max(effective.series.length - 1, 1);
      const y = 180 - (value / maxValue) * 132;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `28,180 ${points} 460,180`;

  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="chart-card">
        <h3>{title}</h3>
        {isAppleCard && Number.isFinite(latestPrice) ? (
          <div className="chart-meta">
            <p className="chart-price">${latestPrice.toFixed(2)}</p>
            <p className="chart-price-label">{latestLabel ?? 'Latest'}</p>
          </div>
        ) : null}
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
          {effective.labels.map((_, i) => {
            const x = 28 + (i * 432) / Math.max(effective.labels.length - 1, 1);
            return <line key={i} x1={x} y1="24" x2={x} y2="180" className="chart-grid chart-grid-v" />;
          })}
          <polygon points={areaPoints} fill={`url(#${item.id}-fill)`} />
          <polyline points={points} fill="none" stroke="rgba(139, 226, 144, 0.94)" strokeWidth="2.2" />
          {effective.labels.map((label, i) => {
            const x = 28 + (i * 432) / Math.max(effective.labels.length - 1, 1);
            return (
              <text key={label + i} x={x} y="188" textAnchor="middle" className="chart-label">
                {label}
              </text>
            );
          })}
        </svg>
        {isAppleCard && isLoading ? <small className="chart-live-status">Loading live AAPL…</small> : null}
        {isAppleCard && liveError ? <small className="chart-live-status">Live update failed: {liveError}</small> : null}
      </div>
    </GlassCardShell>
  );
}
