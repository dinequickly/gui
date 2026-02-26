import { supabase } from '../../shared/store/supabase';
import type { DashboardLayout, WidgetLayoutItem } from './types';

export const DEFAULT_DASHBOARD_KEY = 'dashboard-2';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface UserDashboardComponentRow {
  id: string;
  user_id: string;
  dashboard_key: string;
  component_type: string;
  title: string;
  body: string;
  position: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

interface ComponentMetadata {
  local_widget_id?: string;
  local_widget?: Json;
  [key: string]: Json | undefined;
}

type EditableWidget = {
  id: string;
  type: string;
  column: number;
  order: number;
  props: Record<string, unknown>;
};

export type EditPageOperation =
  | {
    operation: 'swap_content';
    target_uuid?: string;
    target_title?: string;
    props_patch?: Record<string, unknown>;
  }
  | {
    operation: 'reorder';
    target_uuid?: string;
    target_title?: string;
    to_column: number;
    to_order: number;
  }
  | {
    operation: 'replace_slot';
    target_uuid?: string;
    target_title?: string;
    component_type: string;
    props_patch?: Record<string, unknown>;
  };

type EditPageResult =
  | {
    operation: 'swap_content';
    target_uuid: string;
    props_patch: Record<string, unknown>;
    component_type?: string;
  }
  | {
    operation: 'replace_slot';
    target_uuid: string;
    component_type: string;
    props_patch: Record<string, unknown>;
  }
  | {
    operation: 'reorder';
    target_uuid: string;
    to_column: number;
    to_order: number;
    affected_order: Array<{ uuid: string; column: number; order: number }>;
  };

export interface GeneratedAgentComponent {
  slot: string;
  component_type?: string;
  title: string;
  subtitle?: string;
  body: string;
  label?: string;
  embedUrl?: string;
  linkUrl?: string;
  fileId?: string;
  cta?: string;
  source?: string;
  iconUrl?: string;
  column?: 1 | 2 | 3 | 4;
  order?: number;
  width?: number;
  height?: number;
}

export interface UpsertGeneratedComponentsResult {
  widgets: WidgetLayoutItem[];
  uuidByLocalWidgetId: Record<string, string>;
}

const DEFAULT_GENERATED_LAYOUT = { column: 1 as const, order: 1, width: 500, height: 420 };
const LEGACY_GENERATED_IDS = new Set(['page_creator_a', 'page_creator_b', 'citation_creator', 'agent-citations-1']);

function defaultPropsForComponentType(componentType: string): Record<string, unknown> {
  if (componentType === 'calendarCard') {
    return {
      title: 'Calendar',
      description: 'No details yet.',
      items: [],
    };
  }
  if (componentType === 'videoCard') {
    return {
      title: 'Video content',
      subtitle: '',
      label: 'No video configured',
      embedUrl: 'https://www.youtube.com/embed/knsHR4Z_LcM?si=aWzVZ641wvGYJinL',
    };
  }
  if (componentType === 'readerCard') {
    return {
      subtitle: '',
      title: 'Untitled',
      body: '',
      cta: 'Open',
    };
  }
  if (componentType === 'sourceLinkCard') {
    return {
      source: '',
      title: 'Source',
      url: '',
      cta: 'Open Link',
      iconUrl: '',
    };
  }
  return {};
}

function getText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function inferTitle(widget: WidgetLayoutItem): string {
  return (
    getText(widget.props.title) ||
    getText(widget.props.kicker) ||
    widget.id
  );
}

function inferBody(widget: WidgetLayoutItem): string {
  return (
    getText(widget.props.subtitle) ||
    getText(widget.props.description) ||
    getText(widget.props.body) ||
    getText(widget.props.label) ||
    ''
  );
}

function normalizeOrder(widgets: WidgetLayoutItem[]) {
  return widgets
    .slice()
    .sort((a, b) => (a.column - b.column) || (a.order - b.order));
}

export async function fetchUserDashboardComponents(userId: string, dashboardKey = DEFAULT_DASHBOARD_KEY) {
  const { data, error } = await supabase
    .from('user_dashboard_components')
    .select('*')
    .eq('user_id', userId)
    .eq('dashboard_key', dashboardKey)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data ?? []) as UserDashboardComponentRow[];
}

export async function fetchUserDashboardKeys(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_dashboard_components')
    .select('dashboard_key')
    .eq('user_id', userId);

  if (error) throw error;
  const unique = new Set<string>();
  for (const row of data ?? []) {
    if (row.dashboard_key && typeof row.dashboard_key === 'string') {
      unique.add(row.dashboard_key);
    }
  }
  unique.add(DEFAULT_DASHBOARD_KEY);
  return Array.from(unique);
}

export async function renameDashboardView(
  userId: string,
  fromDashboardKey: string,
  toDashboardKey: string,
): Promise<void> {
  if (!fromDashboardKey || !toDashboardKey || fromDashboardKey === toDashboardKey) return;

  const sourceRows = await fetchUserDashboardComponents(userId, fromDashboardKey);
  if (sourceRows.length === 0) return;

  const reassignedRows = sourceRows.map((row) => ({
    ...row,
    dashboard_key: toDashboardKey,
  }));

  const { error: upsertError } = await supabase
    .from('user_dashboard_components')
    .upsert(reassignedRows, { onConflict: 'id' });
  if (upsertError) throw upsertError;

  const { error: deleteError } = await supabase
    .from('user_dashboard_components')
    .delete()
    .eq('user_id', userId)
    .eq('dashboard_key', fromDashboardKey);
  if (deleteError) throw deleteError;
}

export async function syncLayoutToSupabase(
  userId: string,
  layout: DashboardLayout,
  dashboardKey = DEFAULT_DASHBOARD_KEY,
) {
  const localWidgets = normalizeOrder(layout.widgets);
  const existing = await fetchUserDashboardComponents(userId, dashboardKey);

  const byLocalId = new Map<string, UserDashboardComponentRow>();
  const byTypeAndPosition = new Map<string, UserDashboardComponentRow>();

  for (const row of existing) {
    const metadata = (row.metadata ?? {}) as ComponentMetadata;
    if (metadata.local_widget_id) {
      byLocalId.set(metadata.local_widget_id, row);
    }
    byTypeAndPosition.set(`${row.component_type}::${row.position}`, row);
  }

  const upserts = localWidgets.map((widget, index) => {
    const position = index;
    const byLocal = byLocalId.get(widget.id);
    const byPosition = byTypeAndPosition.get(`${widget.type}::${position}`);
    const existingRow = byLocal ?? byPosition;

    const metadata: ComponentMetadata = {
      local_widget_id: widget.id,
      local_widget: widget as unknown as Json,
    };

    return {
      id: existingRow?.id ?? crypto.randomUUID(),
      user_id: userId,
      dashboard_key: dashboardKey,
      component_type: widget.type,
      title: inferTitle(widget),
      body: inferBody(widget),
      position,
      metadata,
    };
  });

  const { error } = await supabase
    .from('user_dashboard_components')
    .upsert(upserts, { onConflict: 'id' });

  if (error) throw error;

  const refreshed = await fetchUserDashboardComponents(userId, dashboardKey);
  const uuidByLocalWidgetId: Record<string, string> = {};
  for (const row of refreshed) {
    const metadata = (row.metadata ?? {}) as ComponentMetadata;
    const localId = metadata.local_widget_id;
    if (localId) uuidByLocalWidgetId[localId] = row.id;
  }

  return { rows: refreshed, uuidByLocalWidgetId };
}

function toEditableWidget(metadata: ComponentMetadata, row: UserDashboardComponentRow): EditableWidget {
  const candidate = (metadata.local_widget ?? {}) as Record<string, unknown>;
  const id = typeof metadata.local_widget_id === 'string' && metadata.local_widget_id
    ? metadata.local_widget_id
    : (typeof candidate.id === 'string' ? candidate.id : row.id);
  const type = typeof row.component_type === 'string' ? row.component_type : 'readerCard';
  const column = Number(candidate.column ?? 1);
  const order = Number(candidate.order ?? 0);
  const props = (candidate.props && typeof candidate.props === 'object')
    ? (candidate.props as Record<string, unknown>)
    : {};

  return {
    id,
    type,
    column: Number.isFinite(column) ? Math.min(4, Math.max(1, column)) : 1,
    order: Number.isFinite(order) ? Math.max(0, order) : 0,
    props,
  };
}

function inferRowTitle(row: UserDashboardComponentRow, metadata: ComponentMetadata): string {
  const widget = toEditableWidget(metadata, row);
  const fromProps = widget.props.title;
  if (typeof fromProps === 'string' && fromProps.trim()) return fromProps.trim();
  if (row.title?.trim()) return row.title.trim();
  return row.id;
}

function findTargetRow(
  rows: UserDashboardComponentRow[],
  operation: EditPageOperation,
): UserDashboardComponentRow | undefined {
  if (operation.target_uuid) {
    const byUuid = rows.find((row) => row.id === operation.target_uuid);
    if (byUuid) return byUuid;
  }

  const targetTitle = operation.target_title?.trim().toLowerCase();
  if (targetTitle) {
    return rows.find((row) => {
      const metadata = (row.metadata ?? {}) as ComponentMetadata;
      return inferRowTitle(row, metadata).toLowerCase().includes(targetTitle);
    });
  }

  return rows[0];
}

export async function applyEditPageOperation(
  userId: string,
  operation: EditPageOperation,
  dashboardKey = DEFAULT_DASHBOARD_KEY,
): Promise<EditPageResult> {
  const rows = await fetchUserDashboardComponents(userId, dashboardKey);
  if (rows.length === 0) throw new Error('No dashboard components found.');

  const target = findTargetRow(rows, operation);
  if (!target) throw new Error('No matching component found for edit operation.');

  if (operation.operation === 'swap_content') {
    const metadata = (target.metadata ?? {}) as ComponentMetadata;
    const widget = toEditableWidget(metadata, target);
    const patch = operation.props_patch ?? {};
    const nextProps = { ...widget.props, ...patch };

    const updatedMetadata: ComponentMetadata = {
      ...metadata,
      local_widget: {
        ...widget,
        type: target.component_type,
        props: nextProps,
      } as unknown as Json,
    };

    const nextTitle = typeof nextProps.title === 'string' ? nextProps.title : target.title;
    const nextBody = typeof nextProps.body === 'string' ? nextProps.body : target.body;

    const { error } = await supabase
      .from('user_dashboard_components')
      .update({
        title: nextTitle,
        body: nextBody,
        metadata: updatedMetadata,
      })
      .eq('id', target.id)
      .eq('user_id', userId)
      .eq('dashboard_key', dashboardKey);
    if (error) throw error;

    return {
      operation: 'swap_content',
      target_uuid: target.id,
      props_patch: patch,
      component_type: target.component_type,
    };
  }

  if (operation.operation === 'replace_slot') {
    const metadata = (target.metadata ?? {}) as ComponentMetadata;
    const widget = toEditableWidget(metadata, target);
    const patch = operation.props_patch ?? {};
    const nextProps = {
      ...defaultPropsForComponentType(operation.component_type),
      ...widget.props,
      ...patch,
    };

    const updatedMetadata: ComponentMetadata = {
      ...metadata,
      local_widget: {
        ...widget,
        type: operation.component_type,
        props: nextProps,
      } as unknown as Json,
    };

    const nextTitle = typeof nextProps.title === 'string'
      ? nextProps.title
      : (target.title || operation.component_type);
    const nextBody = typeof nextProps.body === 'string' ? nextProps.body : target.body;

    const { error } = await supabase
      .from('user_dashboard_components')
      .update({
        component_type: operation.component_type,
        title: nextTitle,
        body: nextBody,
        metadata: updatedMetadata,
      })
      .eq('id', target.id)
      .eq('user_id', userId)
      .eq('dashboard_key', dashboardKey);
    if (error) throw error;

    return {
      operation: 'replace_slot',
      target_uuid: target.id,
      component_type: operation.component_type,
      props_patch: patch,
    };
  }

  const rowWidgets = rows.map((row) => {
    const metadata = (row.metadata ?? {}) as ComponentMetadata;
    return {
      row,
      metadata,
      widget: toEditableWidget(metadata, row),
    };
  });

  const targetIndex = rowWidgets.findIndex((entry) => entry.row.id === target.id);
  if (targetIndex < 0) throw new Error('Target row vanished before reorder.');

  rowWidgets[targetIndex].widget = {
    ...rowWidgets[targetIndex].widget,
    column: Math.min(4, Math.max(1, operation.to_column)),
    order: Math.max(0, operation.to_order),
  };

  const byColumn: Record<number, typeof rowWidgets> = { 1: [], 2: [], 3: [], 4: [] };
  for (const entry of rowWidgets) {
    byColumn[entry.widget.column].push(entry);
  }
  for (const column of [1, 2, 3, 4]) {
    byColumn[column].sort((a, b) => a.widget.order - b.widget.order);
    byColumn[column].forEach((entry, index) => {
      entry.widget.order = index;
    });
  }

  const sorted = [...rowWidgets].sort((a, b) => {
    if (a.widget.column !== b.widget.column) return a.widget.column - b.widget.column;
    return a.widget.order - b.widget.order;
  });

  const updates = sorted.map((entry, position) => {
    const nextMetadata: ComponentMetadata = {
      ...entry.metadata,
      local_widget: {
        ...entry.widget,
      } as unknown as Json,
    };
    return {
      id: entry.row.id,
      user_id: userId,
      dashboard_key: dashboardKey,
      component_type: entry.row.component_type,
      title: entry.row.title,
      body: entry.row.body,
      position,
      metadata: nextMetadata,
    };
  });

  const { error } = await supabase
    .from('user_dashboard_components')
    .upsert(updates, { onConflict: 'id' });
  if (error) throw error;

  const targetAfter = sorted.find((entry) => entry.row.id === target.id);
  if (!targetAfter) throw new Error('Could not resolve reordered target.');

  return {
    operation: 'reorder',
    target_uuid: target.id,
    to_column: targetAfter.widget.column,
    to_order: targetAfter.widget.order,
    affected_order: sorted.map((entry) => ({
      uuid: entry.row.id,
      column: entry.widget.column,
      order: entry.widget.order,
    })),
  };
}

export async function upsertGeneratedAgentComponents(
  userId: string,
  dashboardKey: string,
  components: GeneratedAgentComponent[],
): Promise<UpsertGeneratedComponentsResult> {
  if (!components.length) {
    return { widgets: [], uuidByLocalWidgetId: {} };
  }

  const existingRows = await fetchUserDashboardComponents(userId, dashboardKey);
  const byLocalId = new Map<string, UserDashboardComponentRow>();
  for (const row of existingRows) {
    const metadata = (row.metadata ?? {}) as ComponentMetadata;
    if (typeof metadata.local_widget_id === 'string' && metadata.local_widget_id) {
      byLocalId.set(metadata.local_widget_id, row);
    }
  }
  const normalizedComponents = components
    .slice()
    .sort((a, b) => {
      const aColumn = a.column ?? DEFAULT_GENERATED_LAYOUT.column;
      const bColumn = b.column ?? DEFAULT_GENERATED_LAYOUT.column;
      if (aColumn !== bColumn) return aColumn - bColumn;
      const aOrder = a.order ?? DEFAULT_GENERATED_LAYOUT.order;
      const bOrder = b.order ?? DEFAULT_GENERATED_LAYOUT.order;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.slot.localeCompare(b.slot);
    });

  const incomingSlotIds = new Set(normalizedComponents.map((component) => component.slot));

  const upserts = normalizedComponents.map((component, index) => {
    const layout = {
      id: component.slot,
      column: component.column ?? DEFAULT_GENERATED_LAYOUT.column,
      order: component.order ?? DEFAULT_GENERATED_LAYOUT.order,
      width: component.width ?? DEFAULT_GENERATED_LAYOUT.width,
      height: component.height ?? DEFAULT_GENERATED_LAYOUT.height,
    };
    const existing = byLocalId.get(layout.id);
    const componentType = component.component_type ?? 'readerCard';
    const defaultProps = defaultPropsForComponentType(componentType);
    const widget: WidgetLayoutItem = {
      id: layout.id,
      type: componentType,
      column: layout.column,
      order: layout.order,
      width: layout.width,
      height: layout.height,
      props: {
        ...defaultProps,
        source: component.source ?? '',
        subtitle: component.subtitle ?? '',
        title: component.title,
        body: component.body,
        label: component.label ?? '',
        embedUrl: component.embedUrl ?? '',
        cta: component.cta ?? 'Open',
        fileId: component.fileId ?? '',
        linkUrl: component.linkUrl ?? '',
        url: component.linkUrl ?? '',
        iconUrl: component.iconUrl ?? '',
      },
    };

    return {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: userId,
      dashboard_key: dashboardKey,
      component_type: componentType,
      title: component.title,
      body: component.body,
      position: 1000 + index,
      metadata: {
        local_widget_id: layout.id,
        local_widget: widget as unknown as Json,
      } satisfies ComponentMetadata,
    };
  });

  const staleGeneratedRows = existingRows.filter((row) => {
    const metadata = (row.metadata ?? {}) as ComponentMetadata;
    const localId = typeof metadata.local_widget_id === 'string' ? metadata.local_widget_id : '';
    const isGenerated = localId.startsWith('agent-') || LEGACY_GENERATED_IDS.has(localId);
    if (!isGenerated) return false;
    return !incomingSlotIds.has(localId);
  });
  if (staleGeneratedRows.length > 0) {
    const staleIds = staleGeneratedRows.map((row) => row.id);
    const { error: deleteError } = await supabase
      .from('user_dashboard_components')
      .delete()
      .in('id', staleIds)
      .eq('user_id', userId)
      .eq('dashboard_key', dashboardKey);
    if (deleteError) throw deleteError;
  }

  const { error } = await supabase
    .from('user_dashboard_components')
    .upsert(upserts, { onConflict: 'id' });
  if (error) throw error;

  const widgets: WidgetLayoutItem[] = normalizedComponents.map((component) => {
    const layout = {
      id: component.slot,
      column: component.column ?? DEFAULT_GENERATED_LAYOUT.column,
      order: component.order ?? DEFAULT_GENERATED_LAYOUT.order,
      width: component.width ?? DEFAULT_GENERATED_LAYOUT.width,
      height: component.height ?? DEFAULT_GENERATED_LAYOUT.height,
    };
    const componentType = component.component_type ?? 'readerCard';
    const defaultProps = defaultPropsForComponentType(componentType);
    return {
      id: layout.id,
      type: componentType,
      column: layout.column,
      order: layout.order,
      width: layout.width,
      height: layout.height,
      props: {
        ...defaultProps,
        source: component.source ?? '',
        subtitle: component.subtitle ?? '',
        title: component.title,
        body: component.body,
        label: component.label ?? '',
        embedUrl: component.embedUrl ?? '',
        cta: component.cta ?? 'Open',
        fileId: component.fileId ?? '',
        linkUrl: component.linkUrl ?? '',
        url: component.linkUrl ?? '',
        iconUrl: component.iconUrl ?? '',
      },
    };
  });

  const uuidByLocalWidgetId: Record<string, string> = {};
  const refreshedRows = await fetchUserDashboardComponents(userId, dashboardKey);
  for (const row of refreshedRows) {
    const metadata = (row.metadata ?? {}) as ComponentMetadata;
    const localId = metadata.local_widget_id;
    if (typeof localId === 'string' && localId) {
      uuidByLocalWidgetId[localId] = row.id;
    }
  }

  return {
    widgets,
    uuidByLocalWidgetId,
  };
}
