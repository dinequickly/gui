import { useMemo, useLayoutEffect, useRef, useState } from 'react';
import type { DashboardLayout, WidgetLayoutItem } from './types';
import { widgetRegistry } from './widgetRegistry';
import { validateLayout } from './validateLayout';

interface DashboardRendererProps {
  layout: DashboardLayout;
  collapseSourceLinks?: boolean;
  compactTwoColumn?: boolean;
}

const CARD_WIDTH = 500;
const COLUMN_GAP = 28;

function canvasWidthForColumns(columnCount: number): number {
  return CARD_WIDTH * columnCount + COLUMN_GAP * (columnCount - 1);
}

interface CitationItem {
  id: string;
  source: string;
  title: string;
  url: string;
}

function normalizeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function toCitationItem(item: WidgetLayoutItem): CitationItem {
  const props = item.props as Record<string, unknown>;
  const url = typeof props.url === 'string' ? props.url.trim() : '';
  const source = typeof props.source === 'string'
    ? props.source.trim()
    : normalizeHost(url).trim();
  const title = typeof props.title === 'string' ? props.title.trim() : '';
  return {
    id: item.id,
    source,
    title,
    url,
  };
}

function CitationCluster({ citations }: { citations: CitationItem[] }) {
  const defaultOpen = citations.length <= 12;

  return (
    <section className="dashboard-glass-card citation-cluster-card">
      <details className="citation-cluster-details" open={defaultOpen}>
        <summary className="citation-cluster-summary">
          <span className="citation-cluster-title">Citations</span>
          <span className="citation-cluster-count">{citations.length}</span>
        </summary>
        <div className="citation-cluster-list">
          {citations.map((citation, index) => {
            const content = (
              <>
                <span className="citation-cluster-index">{index + 1}</span>
                <span className="citation-cluster-copy">
                  <span className="citation-cluster-item-title">{citation.title || 'Source'}</span>
                  <span className="citation-cluster-item-source">{citation.source || normalizeHost(citation.url)}</span>
                </span>
              </>
            );
            if (citation.url) {
              return (
                <a
                  key={citation.id}
                  className="citation-cluster-item"
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {content}
                </a>
              );
            }
            return (
              <div key={citation.id} className="citation-cluster-item is-static">
                {content}
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}

function UnknownWidget({ type }: { type: string }) {
  return <div className="widget-fallback">Unknown widget: {type}</div>;
}

export function DashboardRenderer({
  layout,
  collapseSourceLinks = false,
  compactTwoColumn = false,
}: DashboardRendererProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [baseSize, setBaseSize] = useState({ width: canvasWidthForColumns(compactTwoColumn ? 2 : 4), height: 1200 });

  const validWidgets = useMemo(() => validateLayout(layout), [layout]);
  const gridColumnCount = compactTwoColumn ? 2 : 4;
  const canvasWidth = canvasWidthForColumns(gridColumnCount);
  const collapsedCitations = useMemo(() => {
    if (!collapseSourceLinks) return [];
    return validWidgets
      .filter((item) => item.type === 'sourceLinkCard' && item.group !== 'chrome')
      .sort((a, b) => (a.order - b.order) || (a.column - b.column))
      .map(toCitationItem)
      .filter((item) => item.title || item.source || item.url);
  }, [collapseSourceLinks, validWidgets]);
  const shouldCollapseCitations = collapseSourceLinks && collapsedCitations.length > 0;
  const hasEmbeddedMedia = useMemo(() => {
    return validWidgets.some((item) => {
      const embedUrl = (item.props as Record<string, unknown>).embedUrl;
      return typeof embedUrl === 'string' && embedUrl.trim().length > 0;
    });
  }, [validWidgets]);

  const chromeWidgets = validWidgets
    .filter(item => item.group === 'chrome')
    .sort((a, b) => a.order - b.order);

  const columns = useMemo<WidgetLayoutItem[][]>(() => {
    const initial = Array.from({ length: gridColumnCount }, () => [] as WidgetLayoutItem[]);

    const contentWidgets = validWidgets.filter((item) => {
      if (item.group === 'chrome') return false;
      if (shouldCollapseCitations && item.type === 'sourceLinkCard') return false;
      return true;
    });

    if (compactTwoColumn) {
      const ordered = [...contentWidgets].sort((a, b) => (a.order - b.order) || (a.column - b.column));
      for (const [index, item] of ordered.entries()) {
        const targetIndex = index % gridColumnCount;
        initial[targetIndex]?.push(item);
      }
      return initial;
    }

    for (const item of contentWidgets) {
      const targetIndex = Math.max(0, Math.min(gridColumnCount - 1, item.column - 1));
      initial[targetIndex]?.push(item);
    }

    for (const column of initial) {
      column.sort((a, b) => a.order - b.order);
    }
    return initial;
  }, [compactTwoColumn, gridColumnCount, shouldCollapseCitations, validWidgets]);

  const compactOrderedWidgets = useMemo(() => {
    if (!compactTwoColumn) return [] as WidgetLayoutItem[];
    return validWidgets
      .filter((item) => {
        if (item.group === 'chrome') return false;
        if (shouldCollapseCitations && item.type === 'sourceLinkCard') return false;
        return true;
      })
      .sort((a, b) => (a.order - b.order) || (a.column - b.column));
  }, [compactTwoColumn, shouldCollapseCitations, validWidgets]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;

    const resize = () => {
      const baseWidth = canvasWidth;
      const baseHeight = canvas.scrollHeight;

      if (baseHeight === 0) {
        setScale(1);
        return;
      }

      setBaseSize((prev) =>
        prev.width === baseWidth && prev.height === baseHeight
          ? prev
          : { width: baseWidth, height: baseHeight },
      );

      const padding = 20;
      const widthScale = (viewport.clientWidth - padding * 2) / baseWidth;
      // Keep scale stable on content reorders: fit to width, and let height scroll.
      const nextScale = Math.min(widthScale, 1);
      const roundedScale = Math.round(nextScale * 1000) / 1000;

      if (Number.isFinite(roundedScale) && roundedScale > 0) {
        setScale((prev) => (Math.abs(prev - roundedScale) < 0.001 ? prev : roundedScale));
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    if (!hasEmbeddedMedia) observer.observe(canvas);
    window.addEventListener('resize', resize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [canvasWidth, hasEmbeddedMedia, validWidgets]);

  return (
    <div className="dashboard-viewport" ref={viewportRef}>
      <div className="dashboard-scale-shell" style={{ width: baseSize.width * scale, height: baseSize.height * scale }}>
        <div className="dashboard-canvas" ref={canvasRef} style={{ transform: `scale(${scale})`, width: canvasWidth }}>
          <div className="dashboard-chrome-layer">
            {chromeWidgets.map((item) => {
              const Component = widgetRegistry[item.type];
              return (
                <div key={item.id} className={item.type === 'topCornerIcons' ? 'chrome-right' : 'chrome-center'}>
                  {Component ? <Component item={item} /> : <UnknownWidget type={item.type} />}
                </div>
              );
            })}
          </div>

          <div
            className={`dashboard-grid ${compactTwoColumn ? 'is-compact-two-column' : ''}`}
            style={{ gridTemplateColumns: `repeat(${gridColumnCount}, var(--dashboard-card-width))` }}
          >
            {compactTwoColumn
              ? compactOrderedWidgets.map((item) => {
                const props = item.props as Record<string, unknown>;
                const hasEmbed = typeof props.embedUrl === 'string' && props.embedUrl.trim().length > 0;
                const spanFullWidth = item.type === 'videoCard' || hasEmbed;
                const Component = widgetRegistry[item.type];
                return (
                  <div key={item.id} className={spanFullWidth ? 'dashboard-grid-item-span-2' : undefined}>
                    {Component ? <Component item={item} /> : <UnknownWidget type={item.type} />}
                  </div>
                );
              })
              : columns.map((column, columnIndex) => (
              <section className="dashboard-column" key={columnIndex}>
                {column.map((item) => {
                  const Component = widgetRegistry[item.type];
                  return Component ? <Component key={item.id} item={item} /> : <UnknownWidget key={item.id} type={item.type} />;
                })}
              </section>
            ))}
          </div>

          {shouldCollapseCitations ? (
            <section className="dashboard-citation-cluster-row">
              <CitationCluster citations={collapsedCitations} />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
