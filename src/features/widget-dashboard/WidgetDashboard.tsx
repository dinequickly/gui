import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import waterlilies from '../../assets/waterlilies.webp';
import layoutData from './dashboard.layout.json';
import { DashboardRenderer } from './DashboardRenderer';
import { getDatabase } from '../../shared/store/fileStore';
import { useFileStore } from '../../shared/store/fileStore';
import { useAuthStore } from '../../shared/store/authStore';
import {
  CALENDAR_DB_ID,
  WIDGET_MEDIA_DB_ID,
  WIDGET_PAGES_DB_ID,
  WIDGET_REMINDERS_DB_ID,
  WIDGET_TODOS_DB_ID,
  widgetPageFileId,
} from '../../shared/constants/widgetContent';
import type { DashboardLayout } from './types';
import type { DatabaseDocument, DatabaseRecord } from '../../shared/types';
import {
  DEFAULT_DASHBOARD_KEY,
  fetchUserDashboardComponents,
  fetchUserDashboardKeys,
  syncLayoutToSupabase,
} from './supabaseComponents';
import { buildWidgetBoardState, buildWidgetToolContext } from './boardState';
import { WidgetChatBar } from './WidgetChatBar';
import { subscribeWidgetAgentEvents } from './agentToolEvents';
import { labelFromDashboardKey, navItemsFromDashboardKeys } from './viewRoutes';
import './dashboard.css';
import './widgets.css';

interface WidgetDashboardProps {
  dashboardKey?: string;
}

export function WidgetDashboard({ dashboardKey = DEFAULT_DASHBOARD_KEY }: WidgetDashboardProps) {
  const navigate = useNavigate();
  const { loaded } = useFileStore();
  const { user } = useAuthStore();
  const [layout, setLayout] = useState<DashboardLayout>(layoutData as DashboardLayout);
  const [uuidByLocalWidgetId, setUuidByLocalWidgetId] = useState<Record<string, string>>({});
  const [topNavItems, setTopNavItems] = useState<string[]>(['Overview', 'AM Brief', 'News', "To-Do's"]);
  const localIdByUuid = useMemo(() => {
    return Object.fromEntries(Object.entries(uuidByLocalWidgetId).map(([localId, uuid]) => [uuid, localId]));
  }, [uuidByLocalWidgetId]);

  const boardState = useMemo(() => {
    return buildWidgetBoardState(layout.widgets, uuidByLocalWidgetId);
  }, [layout, uuidByLocalWidgetId]);
  const toolContext = useMemo(() => {
    return buildWidgetToolContext(layout.widgets, uuidByLocalWidgetId);
  }, [layout, uuidByLocalWidgetId]);
  const isEmptyView = useMemo(() => {
    return layout.widgets.every((widget) => widget.group === 'chrome');
  }, [layout.widgets]);
  const activeNavLabel = useMemo(() => labelFromDashboardKey(dashboardKey), [dashboardKey]);
  const chatMode = dashboardKey === DEFAULT_DASHBOARD_KEY ? 'default' : 'new_view';

  useEffect(() => {
    return subscribeWidgetAgentEvents((event) => {
      if (event.type === 'open_iframe') {
        const params = new URLSearchParams({
          embedUrl: event.payload.embedUrl,
          title: event.payload.title ?? 'Video content',
          subtitle: event.payload.subtitle ?? '',
        });
        navigate(`/widgets/iframe-theater?${params.toString()}`);
      }

      if (event.type === 'open_page') {
        const url = event.payload.url;
        if (url.startsWith('/')) {
          navigate(url);
        } else {
          window.open(url, '_blank', 'noopener');
        }
      }

      if (event.type === 'edit_page_applied') {
        setLayout((prev) => {
          const next = structuredClone(prev) as DashboardLayout;
          const localId = localIdByUuid[event.payload.target_uuid];
          if (!localId) return prev;
          const widget = next.widgets.find((item) => item.id === localId);
          if (!widget) return prev;

          if (event.payload.operation === 'swap_content') {
            const propsPatch = event.payload.props_patch ?? {};
            widget.props = { ...widget.props, ...propsPatch };
          }

          if (event.payload.operation === 'replace_slot') {
            if (event.payload.component_type) widget.type = event.payload.component_type;
            const propsPatch = event.payload.props_patch ?? {};
            widget.props = { ...widget.props, ...propsPatch };
          }

          if (event.payload.operation === 'reorder' && event.payload.affected_order) {
            for (const entry of event.payload.affected_order) {
              const entryLocalId = localIdByUuid[entry.uuid];
              if (!entryLocalId) continue;
              const entryWidget = next.widgets.find((item) => item.id === entryLocalId);
              if (!entryWidget) continue;
              entryWidget.column = entry.column as 1 | 2 | 3 | 4;
              entryWidget.order = entry.order;
            }
          }

          return next;
        });
      }

      if (event.type === 'generated_components_applied') {
        setLayout((prev) => {
          const next = structuredClone(prev) as DashboardLayout;
          const incomingById = new Map(event.payload.widgets.map((widget) => [widget.id, widget]));
          const filtered = next.widgets.filter((widget) => !incomingById.has(widget.id));
          next.widgets = [...filtered, ...event.payload.widgets.map((widget) => ({
            ...widget,
            column: Math.min(4, Math.max(1, widget.column)) as 1 | 2 | 3 | 4,
            order: Math.max(0, widget.order),
          }))];
          return next;
        });
        setUuidByLocalWidgetId((prev) => ({
          ...prev,
          ...event.payload.uuidByLocalWidgetId,
        }));
      }
    });
  }, [localIdByUuid, navigate]);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;

    async function hydrateFromWorkspace() {
      const [pagesDb, remindersDb, todosDb, calendarDb, mediaDb] = await Promise.all([
        getDatabase(WIDGET_PAGES_DB_ID),
        getDatabase(WIDGET_REMINDERS_DB_ID),
        getDatabase(WIDGET_TODOS_DB_ID),
        getDatabase(CALENDAR_DB_ID),
        getDatabase(WIDGET_MEDIA_DB_ID),
      ]);

      if (cancelled) return;
      const hydrated = buildHydratedLayout(layoutData as DashboardLayout, {
        pagesDb,
        remindersDb,
        todosDb,
        calendarDb,
        mediaDb,
      });

      if (!user?.id) {
        setLayout(applyTopNav(hydrated, topNavItems, activeNavLabel));
        return;
      }

      let dashboardKeys: string[] = [];
      try {
        dashboardKeys = await fetchUserDashboardKeys(user.id);
      } catch (error) {
        console.error('[WidgetDashboard] Failed to fetch dashboard keys:', error);
      }
      if (!dashboardKeys.includes(dashboardKey)) dashboardKeys.push(dashboardKey);
      const computedNavItems = navItemsFromDashboardKeys(dashboardKeys);
      if (!cancelled) setTopNavItems(computedNavItems);

      const existingRows = await fetchUserDashboardComponents(user.id, dashboardKey);
      if (cancelled) return;

      if (existingRows.length > 0) {
        const restoredWidgets: DashboardLayout['widgets'] = [];
        const seenWidgetIds = new Set<string>();
        for (const row of existingRows) {
          const metadata = (row.metadata ?? {}) as { local_widget?: unknown };
          const localWidget = metadata.local_widget as {
            id?: unknown;
            type?: unknown;
            column?: unknown;
            order?: unknown;
            width?: unknown;
            height?: unknown;
            props?: unknown;
            group?: unknown;
          } | undefined;
          if (!localWidget) continue;
          if (typeof localWidget.id !== 'string' || typeof localWidget.type !== 'string') continue;
          if (seenWidgetIds.has(localWidget.id)) continue;
          seenWidgetIds.add(localWidget.id);
          restoredWidgets.push({
            id: localWidget.id,
            type: localWidget.type,
            column: Number(localWidget.column ?? 1) as 1 | 2 | 3 | 4,
            order: Number(localWidget.order ?? 0),
            width: Number(localWidget.width ?? 500),
            height: Number(localWidget.height ?? 180),
            props: (localWidget.props && typeof localWidget.props === 'object')
              ? (localWidget.props as Record<string, unknown>)
              : {},
            group: typeof localWidget.group === 'string' ? localWidget.group : undefined,
          });
        }

        const restored: DashboardLayout = {
          widgets: restoredWidgets,
        };
        setLayout(applyTopNav(restored.widgets.length > 0 ? restored : hydrated, computedNavItems, activeNavLabel));
        const map: Record<string, string> = {};
        for (const row of existingRows) {
          const metadata = (row.metadata ?? {}) as { local_widget_id?: unknown };
          if (typeof metadata.local_widget_id === 'string' && metadata.local_widget_id) {
            map[metadata.local_widget_id] = row.id;
          }
        }
        setUuidByLocalWidgetId(map);
        return;
      }

      const initialForView = dashboardKey === DEFAULT_DASHBOARD_KEY
        ? hydrated
        : {
          widgets: hydrated.widgets.filter((widget) => widget.group === 'chrome'),
        };

      setLayout(applyTopNav(initialForView, computedNavItems, activeNavLabel));
      if (user?.id) {
        void syncLayoutToSupabase(user.id, initialForView, dashboardKey)
          .then((synced) => {
            if (!cancelled) setUuidByLocalWidgetId(synced.uuidByLocalWidgetId);
          })
          .catch((error) => {
            console.error('[WidgetDashboard] Failed to sync components to Supabase:', error);
          });
      }
    }

    void hydrateFromWorkspace();
    return () => { cancelled = true; };
  }, [activeNavLabel, dashboardKey, loaded, user?.id]);

  return (
    <div className={`widget-dashboard-root ${isEmptyView ? 'is-empty-view' : ''}`}>
      <div className="widget-dashboard-bg" style={{ backgroundImage: `url(${waterlilies})` }} />
      {isEmptyView ? (
        <section className="dashboard-empty-theater" aria-live="polite">
          <div className="dashboard-empty-theater-card">
            <p className="dashboard-empty-kicker">New View</p>
            <h2>What do you want this page to show?</h2>
            <p>Describe the intent and I can add cards, move sections, and shape this dashboard for you.</p>
          </div>
        </section>
      ) : null}
      <DashboardRenderer layout={layout} />
      <WidgetChatBar
        boardState={boardState}
        toolContext={toolContext}
        userId={user?.id ?? ''}
        dashboardKey={dashboardKey}
        chatMode={chatMode}
        theaterMode={isEmptyView}
        starterPrompt={
          isEmptyView
            ? (chatMode === 'new_view'
              ? 'Ahoy matey, what should this fresh view show?'
              : 'What do you want this page to show?')
            : ''
        }
      />
    </div>
  );
}

type DashboardSources = {
  pagesDb?: DatabaseDocument;
  remindersDb?: DatabaseDocument;
  todosDb?: DatabaseDocument;
  calendarDb?: DatabaseDocument;
  mediaDb?: DatabaseDocument;
};

function getField(record: DatabaseRecord, fieldId?: string): string {
  if (!fieldId) return '';
  const value = record.fields[fieldId];
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function fieldMapByName(dbDoc?: DatabaseDocument) {
  if (!dbDoc) return {};
  return Object.fromEntries(dbDoc.schema.map((field) => [field.name, field.id]));
}

function upsertProps(base: DashboardLayout, id: string, patch: Record<string, unknown>) {
  const widget = base.widgets.find((item) => item.id === id);
  if (!widget) return;
  widget.props = { ...widget.props, ...patch };
}

function applyTopNav(base: DashboardLayout, items: string[], active: string): DashboardLayout {
  const next = structuredClone(base) as DashboardLayout;
  const topNav = next.widgets.find((widget) => widget.type === 'topNav');
  if (!topNav) return next;
  topNav.props = {
    ...topNav.props,
    items,
    active,
  };
  return next;
}

export function buildHydratedLayout(baseLayout: DashboardLayout, sources: DashboardSources): DashboardLayout {
  const next = structuredClone(baseLayout) as DashboardLayout;

  const remindersFieldMap = fieldMapByName(sources.remindersDb);
  const reminderActions = (sources.remindersDb?.records ?? [])
    .slice(0, 6)
    .map((record) => getField(record, remindersFieldMap['Label']))
    .filter(Boolean);

  if (reminderActions.length > 0) {
    upsertProps(next, 'quick-actions', { actions: reminderActions.slice(0, 4) });
    upsertProps(next, 'mini-actions', { actions: reminderActions });
  }

  const todosFieldMap = fieldMapByName(sources.todosDb);
  const todoRecords = [...(sources.todosDb?.records ?? [])];
  const rows = todoRecords.slice(0, 3).map((record) => ({
    title: getField(record, todosFieldMap['Title']) || 'Title',
    subtitle: getField(record, todosFieldMap['Assignee']) || 'Description',
    time: getField(record, todosFieldMap['Date']) || '9:41 AM',
  }));

  if (rows.length > 0) {
    upsertProps(next, 'btc-reminders', { rows });
    upsertProps(next, 'appl-reminders', { rows });
  }

  const todoSeries = todoRecords.slice(0, 7).map((record, index) => {
    const date = new Date(getField(record, todosFieldMap['Date']));
    if (Number.isNaN(date.getTime())) return 15 + index * 8;
    return Math.max(12, date.getDate() * 3);
  });
  if (todoSeries.length > 0) {
    upsertProps(next, 'btc-chart', { series: todoSeries });
    upsertProps(next, 'appl-chart', { series: [...todoSeries].reverse() });
  }

  const pagesFieldMap = fieldMapByName(sources.pagesDb);
  const pageRecords = sources.pagesDb?.records ?? [];
  if (pageRecords.length > 0) {
    const getPageContent = (index: number) => {
      const fallback = pageRecords[0];
      const record = pageRecords[index] ?? fallback;
      return {
        title: getField(record, pagesFieldMap['Title']) || 'Title',
        subtitle: getField(record, pagesFieldMap['Subtitle']) || 'Subtitle',
        body: getField(record, pagesFieldMap['Body']) || '',
        fileId: widgetPageFileId(record.id),
      };
    };

    const leftPage = getPageContent(0);
    const rightPage = getPageContent(1);
    const financePage = getPageContent(0);

    upsertProps(next, 'left-reader', {
      title: leftPage.title,
      subtitle: leftPage.subtitle,
      body: leftPage.body,
      fileId: leftPage.fileId,
    });
    upsertProps(next, 'right-reader', {
      title: rightPage.title,
      subtitle: rightPage.subtitle,
      body: rightPage.body,
      fileId: rightPage.fileId,
    });
    upsertProps(next, 'finance-card', {
      kicker: financePage.subtitle || 'Finance Agent',
      title: financePage.title || 'A data driven perspective',
      fileId: financePage.fileId,
    });
  }

  const calendarRecords = sources.calendarDb?.records ?? [];
  const calendarFieldMap = fieldMapByName(sources.calendarDb);
  if (calendarRecords.length > 0) {
    const firstThree = calendarRecords.slice(0, 3);
    const items = firstThree.map((record) => {
      const name = getField(record, calendarFieldMap['Name']) || 'Task';
      const assignee = getField(record, calendarFieldMap['Assignee']) || 'Team';
      return `${name} — ${assignee}`;
    });
    const first = firstThree[0];
    const title = getField(first, calendarFieldMap['Name']) || 'Calendar Conflict';
    const who = getField(first, calendarFieldMap['Assignee']) || 'your teammate';
    const due = getField(first, calendarFieldMap['Due date']) || 'today';
    const description = `${title} is scheduled with ${who} and due on ${due}.`;
    upsertProps(next, 'left-calendar', { description, items });
    upsertProps(next, 'right-calendar', { description, items });
  }

  const mediaRecord = sources.mediaDb?.records?.[0];
  if (mediaRecord) {
    const mediaFieldMap = fieldMapByName(sources.mediaDb);
    upsertProps(next, 'video-card', {
      title: getField(mediaRecord, mediaFieldMap['Title']) || 'A space for showing video content',
      subtitle: getField(mediaRecord, mediaFieldMap['Subtitle']) || 'Subtitle',
      embedUrl: getField(mediaRecord, mediaFieldMap['Embed URL']),
    });
  }

  return next;
}
