import { useEffect, useMemo, useState } from 'react';
import layoutData from './dashboard.layout.json';
import { getDatabase } from '../../shared/store/fileStore';
import { useFileStore } from '../../shared/store/fileStore';
import { useAuthStore } from '../../shared/store/authStore';
import {
  CALENDAR_DB_ID,
  WIDGET_MEDIA_DB_ID,
  WIDGET_PAGES_DB_ID,
  WIDGET_REMINDERS_DB_ID,
  WIDGET_TODOS_DB_ID,
} from '../../shared/constants/widgetContent';
import type { DatabaseDocument } from '../../shared/types';
import type { DashboardLayout } from './types';
import { buildHydratedLayout } from './WidgetDashboard';
import { syncLayoutToSupabase } from './supabaseComponents';

type DashboardSources = {
  pagesDb?: DatabaseDocument;
  remindersDb?: DatabaseDocument;
  todosDb?: DatabaseDocument;
  calendarDb?: DatabaseDocument;
  mediaDb?: DatabaseDocument;
};

const CANDIDATE_KEYS = ['title', 'subtitle', 'kicker', 'description', 'body', 'label', 'cta'];

export function SimpleWidgetsPage() {
  const { loaded } = useFileStore();
  const { user } = useAuthStore();
  const [layout, setLayout] = useState<DashboardLayout>(layoutData as DashboardLayout);
  const [uuidByLocalWidgetId, setUuidByLocalWidgetId] = useState<Record<string, string>>({});

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
      const sources: DashboardSources = { pagesDb, remindersDb, todosDb, calendarDb, mediaDb };
      const hydrated = buildHydratedLayout(layoutData as DashboardLayout, sources);
      setLayout(hydrated);
      if (user?.id) {
        try {
          const synced = await syncLayoutToSupabase(user.id, hydrated);
          if (!cancelled) setUuidByLocalWidgetId(synced.uuidByLocalWidgetId);
        } catch (error) {
          console.error('[SimpleWidgetsPage] Failed to sync components to Supabase:', error);
        }
      }
    }

    void hydrateFromWorkspace();
    return () => {
      cancelled = true;
    };
  }, [loaded, user?.id]);

  const rows = useMemo(() => {
    return layout.widgets
      .slice()
      .sort((a, b) => (a.column - b.column) || (a.order - b.order))
      .map((widget) => {
        const props = widget.props ?? {};
        const summary = CANDIDATE_KEYS
          .filter((key) => typeof props[key] === 'string' && String(props[key]).trim().length > 0)
          .map((key) => `${key}: ${String(props[key])}`)
          .join(' | ');

        return {
          localId: widget.id,
          supabaseId: uuidByLocalWidgetId[widget.id] ?? '',
          type: widget.type,
          column: widget.column,
          order: widget.order,
          title: typeof props.title === 'string' ? props.title : '',
          subtitle: typeof props.subtitle === 'string' ? props.subtitle : '',
          summary,
          rawProps: JSON.stringify(props),
        };
      });
  }, [layout, uuidByLocalWidgetId]);

  return (
    <main style={{ padding: 24, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
      <h1 style={{ marginTop: 0 }}>Widgets Simple Debug View</h1>
      <p style={{ marginTop: 0, color: '#444' }}>
        Route: <code>/widgets/simple</code>
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['supabase_component_id', 'local_widget_id', 'component_type', 'column', 'order', 'title', 'subtitle', 'summary', 'raw props'].map((label) => (
                <th
                  key={label}
                  style={{
                    textAlign: 'left',
                    borderBottom: '1px solid #ddd',
                    padding: '8px 10px',
                    whiteSpace: 'nowrap',
                    position: 'sticky',
                    top: 0,
                    background: '#fff',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.localId}>
                <td style={{ borderBottom: '1px solid #eee', padding: '8px 10px', whiteSpace: 'nowrap' }}>{row.supabaseId || '-'}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '8px 10px', whiteSpace: 'nowrap' }}>{row.localId}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '8px 10px', whiteSpace: 'nowrap' }}>{row.type}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '8px 10px' }}>{row.column}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '8px 10px' }}>{row.order}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '8px 10px' }}>{row.title || '-'}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '8px 10px' }}>{row.subtitle || '-'}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '8px 10px', minWidth: 260 }}>{row.summary || '-'}</td>
                <td
                  style={{
                    borderBottom: '1px solid #eee',
                    padding: '8px 10px',
                    minWidth: 360,
                    maxWidth: 580,
                    wordBreak: 'break-word',
                  }}
                >
                  {row.rawProps}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
