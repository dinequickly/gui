import type { DashboardLayout, WidgetLayoutItem } from './types';

function isColumn(value: number): value is WidgetLayoutItem['column'] {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validateLayout(input: DashboardLayout): WidgetLayoutItem[] {
  if (!input || !Array.isArray(input.widgets)) {
    console.error('[DashboardRenderer] layout must have a widgets array.');
    return [];
  }

  const valid: WidgetLayoutItem[] = [];

  for (const raw of input.widgets) {
    if (!isRecord(raw)) {
      console.error('[DashboardRenderer] widget entry must be an object:', raw);
      continue;
    }

    const id = raw.id;
    const type = raw.type;
    const column = Number(raw.column);
    const order = Number(raw.order);
    const width = Number(raw.width);
    const height = Number(raw.height);
    const props = raw.props;
    const group = raw.group;

    if (typeof id !== 'string' || id.length === 0) {
      console.error('[DashboardRenderer] widget is missing a valid id:', raw);
      continue;
    }

    if (typeof type !== 'string' || type.length === 0) {
      console.error(`[DashboardRenderer] widget "${id}" is missing a valid type.`);
      continue;
    }

    if (!isColumn(column)) {
      console.error(`[DashboardRenderer] widget "${id}" has invalid column "${raw.column}". Expected 1-4.`);
      continue;
    }

    if (!Number.isFinite(order)) {
      console.error(`[DashboardRenderer] widget "${id}" has invalid order.`);
      continue;
    }

    if (!Number.isFinite(width) || width <= 0) {
      console.error(`[DashboardRenderer] widget "${id}" has invalid width "${raw.width}".`);
      continue;
    }

    if (!Number.isFinite(height) || height <= 0) {
      console.error(`[DashboardRenderer] widget "${id}" has invalid height "${raw.height}".`);
      continue;
    }

    if (!isRecord(props)) {
      console.error(`[DashboardRenderer] widget "${id}" must include an object props payload.`);
      continue;
    }

    valid.push({
      id,
      type,
      column,
      order,
      width,
      height,
      props,
      group: typeof group === 'string' ? group : undefined,
    });
  }

  return valid;
}
