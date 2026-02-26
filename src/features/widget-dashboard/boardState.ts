import type { WidgetLayoutItem } from './types';

export interface WidgetBoardStateItem {
  uuid: string;
  title: string;
  component_type: string;
  column: number;
  order: number;
  summary: string;
}

export interface WidgetIframeTarget {
  widget_uuid: string;
  widget_title: string;
  embedUrl: string;
  subtitle: string;
}

export interface WidgetPageTarget {
  widget_uuid: string;
  widget_title: string;
  url: string;
  slug: string;
}

export interface WidgetToolContext {
  iframes: WidgetIframeTarget[];
  pages: WidgetPageTarget[];
  editable: WidgetBoardStateItem[];
  nav_items: string[];
}

const SUMMARY_KEYS = ['title', 'subtitle', 'kicker', 'description', 'body', 'label', 'cta'];

function getString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function inferTitle(widget: WidgetLayoutItem): string {
  return (
    getString(widget.props.title) ||
    getString(widget.props.kicker) ||
    widget.id
  );
}

function inferSummary(widget: WidgetLayoutItem): string {
  const parts = SUMMARY_KEYS
    .map((key) => {
      const raw = widget.props[key];
      const text = getString(raw);
      return text ? `${key}: ${text}` : '';
    })
    .filter(Boolean);
  return parts.join(' | ');
}

export function buildWidgetBoardState(
  widgets: WidgetLayoutItem[],
  uuidByLocalWidgetId: Record<string, string>,
): WidgetBoardStateItem[] {
  return widgets
    .slice()
    .sort((a, b) => (a.column - b.column) || (a.order - b.order))
    .map((widget) => ({
      uuid: uuidByLocalWidgetId[widget.id] ?? '',
      title: inferTitle(widget),
      component_type: widget.type,
      column: widget.column,
      order: widget.order,
      summary: inferSummary(widget),
    }));
}

export function buildWidgetToolContext(
  widgets: WidgetLayoutItem[],
  uuidByLocalWidgetId: Record<string, string>,
): WidgetToolContext {
  const iframes: WidgetIframeTarget[] = [];
  const pages: WidgetPageTarget[] = [];
  const editable = buildWidgetBoardState(widgets, uuidByLocalWidgetId);
  const navItems: string[] = [];

  for (const widget of widgets) {
    const uuid = uuidByLocalWidgetId[widget.id] ?? '';
    const title = inferTitle(widget);
    const embedUrl = getString(widget.props.embedUrl);
    const subtitle = getString(widget.props.subtitle);
    const fileId = getString(widget.props.fileId);

    if (embedUrl) {
      iframes.push({
        widget_uuid: uuid,
        widget_title: title,
        embedUrl,
        subtitle,
      });
    }

    if (fileId) {
      const url = `/page?fileId=${encodeURIComponent(fileId)}`;
      pages.push({
        widget_uuid: uuid,
        widget_title: title,
        url,
        slug: fileId,
      });
    }

    if (widget.type === 'topNav' && Array.isArray(widget.props.items)) {
      for (const raw of widget.props.items) {
        const label = getString(raw);
        if (label) navItems.push(label);
      }
    }
  }

  return { iframes, pages, editable, nav_items: Array.from(new Set(navItems)) };
}
