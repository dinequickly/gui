import { useEffect, useMemo, useState } from 'react';
import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';

interface ChartProps {
  title: string;
  labels: string[];
  series: number[];
}

interface LiveQuote {
  price: number;
  label: string;
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
  const outputs = asRecord(root.outputs) ?? asRecord(asRecord(root.data)?.outputs) ?? asRecord(root.output);

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

  // Fallback: derive a compact quote graph directly from workflow outputs.
  if (outputs) {
    const derived = [
      { label: 'Prev', value: asNumber(outputs.previousClose) },
      { label: 'Open', value: asNumber(outputs.open) },
      { label: 'Low', value: asNumber(outputs.low) },
      { label: 'High', value: asNumber(outputs.high) },
      { label: 'Now', value: asNumber(outputs.tradePrice ?? outputs.price) },
    ].filter((point): point is { label: string; value: number } => point.value != null);

    if (derived.length > 1) {
      return {
        labels: derived.map((point) => point.label),
        series: derived.map((point) => point.value),
      };
    }
  }

  return null;
}

function parseLiveQuote(payload: unknown): LiveQuote | null {
  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  };
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
  const outputs = asRecord(root.outputs) ?? asRecord(asRecord(root.data)?.outputs) ?? asRecord(root.output);
  if (!outputs) return null;

  const price = asNumber(outputs.tradePrice ?? outputs.price ?? outputs.close ?? outputs.value);
  if (price == null) return null;

  const label = typeof outputs.tradeDate === 'string'
    ? outputs.tradeDate
    : (typeof outputs.timestamp === 'string' ? outputs.timestamp : 'Latest');
  return { price, label };
}

export function ChartCard({ item }: WidgetComponentProps) {
  const { title, labels, series } = item.props as unknown as ChartProps;
  const isAppleCard = item.id === 'appl-chart' || title.toUpperCase() === 'AAPL' || title.toUpperCase() === 'APPL';
  const [liveSeries, setLiveSeries] = useState<{ labels: string[]; series: number[] } | null>(null);
  const [liveQuote, setLiveQuote] = useState<LiveQuote | null>(null);
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
        const quote = parseLiveQuote(json);
        if (!parsed && !quote) throw new Error('Unrecognized payload shape');
        if (!cancelled) {
          setLiveSeries(parsed);
          setLiveQuote(quote);
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

  const liveSeriesReady = useMemo(
    () => (liveSeries && liveSeries.series.length > 1 ? liveSeries : null),
    [liveSeries],
  );

  const effective = useMemo(() => {
    if (isAppleCard) {
      return liveSeriesReady ?? { labels: [], series: [] };
    }
    return { labels, series };
  }, [isAppleCard, labels, liveSeriesReady, series]);

  const plotLeft = 52;
  const plotRight = 460;
  const plotTop = 20;
  const plotBottom = 150;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const maxValue = Math.max(...effective.series, 1);
  const latestPrice = liveQuote?.price ?? liveSeriesReady?.series[liveSeriesReady.series.length - 1];
  const latestLabel = liveQuote?.label ?? liveSeriesReady?.labels[liveSeriesReady.labels.length - 1];
  const hasLatestPrice = typeof latestPrice === 'number' && Number.isFinite(latestPrice);

  const points = effective.series
    .map((value, index) => {
      const x = plotLeft + (index * plotWidth) / Math.max(effective.series.length - 1, 1);
      const y = plotBottom - (value / maxValue) * plotHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `${plotLeft},${plotBottom} ${points} ${plotRight},${plotBottom}`;
  const yTicks = Array.from({ length: 5 }).map((_, i) => {
    const y = plotTop + i * (plotHeight / 4);
    const value = maxValue * (1 - i / 4);
    const label = maxValue < 100 ? value.toFixed(2) : Math.round(value).toString();
    return { y, label };
  });

  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="chart-card">
        <h3>{title}</h3>
        {isAppleCard && hasLatestPrice ? (
          <div className="chart-meta">
            <p className="chart-price">${latestPrice.toFixed(2)}</p>
            <p className="chart-price-label">{latestLabel ?? 'Latest'}</p>
          </div>
        ) : null}
        {!isAppleCard || liveSeriesReady ? (
          <svg viewBox="0 0 488 190" role="img" aria-label={`${title} line chart`}>
            <defs>
              <linearGradient id={`${item.id}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(148, 227, 154, 0.72)" />
                <stop offset="100%" stopColor="rgba(148, 227, 154, 0.06)" />
              </linearGradient>
            </defs>
            {yTicks.map((tick, i) => {
              return <line key={i} x1={plotLeft} y1={tick.y} x2={plotRight} y2={tick.y} className="chart-grid" />;
            })}
            {yTicks.map((tick, i) => (
              <text key={`y-${i}`} x={plotLeft - 6} y={tick.y + 4} textAnchor="end" className="chart-label-y">
                {tick.label}
              </text>
            ))}
            {effective.labels.map((_, i) => {
              const x = plotLeft + (i * plotWidth) / Math.max(effective.labels.length - 1, 1);
              return <line key={i} x1={x} y1={plotTop} x2={x} y2={plotBottom} className="chart-grid chart-grid-v" />;
            })}
            <polygon points={areaPoints} fill={`url(#${item.id}-fill)`} />
            <polyline points={points} fill="none" stroke="rgba(139, 226, 144, 0.94)" strokeWidth="2.2" />
            <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} className="chart-axis-line" />
            <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} className="chart-axis-line" />
            {effective.labels.map((label, i) => {
              const x = plotLeft + (i * plotWidth) / Math.max(effective.labels.length - 1, 1);
              return (
                <text key={label + i} x={x} y="174" textAnchor="middle" className="chart-label-x">
                  {label}
                </text>
              );
            })}
          </svg>
        ) : null}
        {isAppleCard && isLoading ? <small className="chart-live-status">Loading live AAPL…</small> : null}
        {isAppleCard && liveError ? <small className="chart-live-status">Live update failed: {liveError}</small> : null}
        {isAppleCard && !isLoading && !liveError && !liveSeriesReady && !liveQuote ? (
          <small className="chart-live-status">No live data returned.</small>
        ) : null}
      </div>
    </GlassCardShell>
  );
}
