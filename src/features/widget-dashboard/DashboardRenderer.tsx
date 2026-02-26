import { useMemo, useLayoutEffect, useRef, useState } from 'react';
import type { DashboardLayout, WidgetLayoutItem } from './types';
import { widgetRegistry } from './widgetRegistry';
import { validateLayout } from './validateLayout';

interface DashboardRendererProps {
  layout: DashboardLayout;
}

interface ColumnMap {
  1: WidgetLayoutItem[];
  2: WidgetLayoutItem[];
  3: WidgetLayoutItem[];
  4: WidgetLayoutItem[];
}

function UnknownWidget({ type }: { type: string }) {
  return <div className="widget-fallback">Unknown widget: {type}</div>;
}

export function DashboardRenderer({ layout }: DashboardRendererProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [baseSize, setBaseSize] = useState({ width: 2084, height: 1200 });

  const validWidgets = useMemo(() => validateLayout(layout), [layout]);

  const chromeWidgets = validWidgets
    .filter(item => item.group === 'chrome')
    .sort((a, b) => a.order - b.order);

  const columns = useMemo<ColumnMap>(() => {
    const initial: ColumnMap = { 1: [], 2: [], 3: [], 4: [] };
    for (const item of validWidgets) {
      if (item.group === 'chrome') continue;
      initial[item.column].push(item);
    }
    for (const key of [1, 2, 3, 4] as const) {
      initial[key].sort((a, b) => a.order - b.order);
    }
    return initial;
  }, [validWidgets]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;

    const resize = () => {
      const baseWidth = canvas.scrollWidth;
      const baseHeight = canvas.scrollHeight;

      if (baseWidth === 0 || baseHeight === 0) {
        setScale(1);
        return;
      }

      setBaseSize({ width: baseWidth, height: baseHeight });

      const padding = 20;
      const widthScale = (viewport.clientWidth - padding * 2) / baseWidth;
      const heightScale = (viewport.clientHeight - padding * 2) / baseHeight;
      const nextScale = Math.min(widthScale, heightScale, 1);

      if (Number.isFinite(nextScale) && nextScale > 0) {
        setScale(nextScale);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    observer.observe(canvas);
    window.addEventListener('resize', resize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [validWidgets]);

  return (
    <div className="dashboard-viewport" ref={viewportRef}>
      <div className="dashboard-scale-shell" style={{ width: baseSize.width * scale, height: baseSize.height * scale }}>
        <div className="dashboard-canvas" ref={canvasRef} style={{ transform: `scale(${scale})` }}>
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

          <div className="dashboard-grid">
            {([1, 2, 3, 4] as const).map((columnIndex) => (
              <section className="dashboard-column" key={columnIndex}>
                {columns[columnIndex].map((item) => {
                  const Component = widgetRegistry[item.type];
                  return Component ? <Component key={item.id} item={item} /> : <UnknownWidget key={item.id} type={item.type} />;
                })}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
