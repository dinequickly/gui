import { useState, useEffect } from 'react';
import { defineRegistry } from '@json-render/react';
import { useNavigate } from 'react-router-dom';
import { widgetCatalog } from './catalog';
import { getDatabase } from '../../shared/store/fileStore';
import type { DatabaseRecord } from '../../shared/types';
import notifImg1 from '../../assets/notif-1.png';
import notifImg2 from '../../assets/notif-2.png';
import notifImg3 from '../../assets/notif-3.png';
import cardAbstract from '../../assets/card-abstract.png';
import {
  WIDGET_PAGES_DB_ID,
  WIDGET_REMINDERS_DB_ID,
  WIDGET_TODOS_DB_ID,
  widgetPageFileId,
} from '../../shared/constants/widgetContent';

// Well-known database IDs (seeded)
const NOTIF_ICONS = [notifImg1, notifImg2, notifImg3];

// ─── Field helpers ───────────────────────────────────────────────────────

function fieldVal(rec: DatabaseRecord, fieldId: string): string {
  const v = rec.fields[fieldId];
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function formatShortDate(raw: string) {
  if (!raw) return '';
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return raw;
  return new Date(parsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface PageData {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  author: string;
  link: string;
  size: 'small' | 'large';
}
interface NotifData {
  id: string;
  title: string;
  description: string;
  time: string;
}
interface ReminderData {
  id: string;
  label: string;
  icon: 'block' | 'timer' | 'gif' | 'note';
}

// ─── Hooks for loading each database ─────────────────────────────────────

function usePages() {
  const [pages, setPages] = useState<PageData[]>([]);
  useEffect(() => {
    let cancelled = false;
    getDatabase(WIDGET_PAGES_DB_ID).then(db => {
      if (cancelled || !db) return;
      const m = Object.fromEntries(db.schema.map(f => [f.name, f.id]));
      setPages(
        db.records.map(r => ({
          id: r.id,
          title: fieldVal(r, m['Title'] ?? ''),
          subtitle: fieldVal(r, m['Subtitle'] ?? ''),
          body: fieldVal(r, m['Body'] ?? ''),
          author: fieldVal(r, m['Author'] ?? ''),
          link: fieldVal(r, m['Link'] ?? ''),
          size: (fieldVal(r, m['Size'] ?? '') === 'large' ? 'large' : 'small') as 'small' | 'large',
        })),
      );
    });
    return () => { cancelled = true; };
  }, []);
  return pages;
}

function useNotifs() {
  const [notifs, setNotifs] = useState<NotifData[]>([]);
  useEffect(() => {
    let cancelled = false;
    getDatabase(WIDGET_TODOS_DB_ID).then(db => {
      if (cancelled || !db) return;
      const m = Object.fromEntries(db.schema.map(f => [f.name, f.id]));
      const sorted = [...db.records].sort((a, b) =>
        fieldVal(a, m['Date'] ?? '').localeCompare(fieldVal(b, m['Date'] ?? ''))
      );
      setNotifs(
        sorted.map(r => ({
          id: r.id,
          title: fieldVal(r, m['Title'] ?? '') || 'Untitled',
          description: fieldVal(r, m['Assignee'] ?? ''),
          time: formatShortDate(fieldVal(r, m['Date'] ?? '')),
        })),
      );
    });
    return () => { cancelled = true; };
  }, []);
  return notifs;
}

function useReminders() {
  const [reminders, setReminders] = useState<ReminderData[]>([]);
  useEffect(() => {
    let cancelled = false;
    getDatabase(WIDGET_REMINDERS_DB_ID).then(db => {
      if (cancelled || !db) return;
      const m = Object.fromEntries(db.schema.map(f => [f.name, f.id]));
      setReminders(
        db.records.map(r => ({
          id: r.id,
          label: fieldVal(r, m['Label'] ?? ''),
          icon: (fieldVal(r, m['Icon'] ?? '') || 'note') as ReminderData['icon'],
        })),
      );
    });
    return () => { cancelled = true; };
  }, []);
  return reminders;
}

// ─── SVG Icons ───────────────────────────────────────────────────────────

function ReadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  );
}

function ShortcutIcon({ type }: { type: string }) {
  const paths: Record<string, string> = {
    block: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    timer: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    gif: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
    note: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[type] ?? paths.note} />
    </svg>
  );
}

function GlassLinkButton({ label, href, onClick, style }: { label: string; href?: string; onClick?: () => void; style?: React.CSSProperties }) {
  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (href) window.open(href, '_blank', 'noopener');
  };
  return (
    <button className="glass-link-btn" onClick={handleClick} style={style}>
      {label === 'Read' && <ReadIcon />}
      {label === 'Visit Link' && <LinkIcon />}
      {label}
    </button>
  );
}

// ─── Registry ────────────────────────────────────────────────────────────

export const { registry: widgetRegistry } = defineRegistry(widgetCatalog, {
  actions: {},
  components: {
    GlassGrid: ({ props, children }) => {
      const style: React.CSSProperties = {};
      if (props.columns) style.gridTemplateColumns = props.columns;
      if (props.areas) {
        style.gridTemplateAreas = props.areas
          .split('/')
          .map(row => `"${row.trim()}"`)
          .join(' ');
      }
      if (props.gap != null) style.gap = props.gap;
      return (
        <div className="wd-grid" style={style}>
          {children}
        </div>
      );
    },

    GlassCard: ({ props, children }) => (
      <div className="glass-card" style={props.padding ? { padding: props.padding } : undefined}>
        {children}
      </div>
    ),

    NotificationStack: (() => {
      function Impl() {
        const notifs = useNotifs();
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifs.map((n, i) => (
              <div className="glass-notif" key={n.id}>
                <img src={NOTIF_ICONS[i % NOTIF_ICONS.length]} alt="" className="notif-icon" style={{ objectFit: 'cover' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(30,30,30,0.85)', lineHeight: 1.2 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(60,60,60,0.55)', marginTop: 1 }}>{n.description}</div>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(60,60,60,0.45)', fontWeight: 400, whiteSpace: 'nowrap', flexShrink: 0 }}>{n.time}</div>
              </div>
            ))}
          </div>
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Impl as any;
    })(),

    ReminderBlock: (() => {
      function Impl() {
        const reminders = useReminders();
        return (
          <div className="glass-card" style={{ padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {reminders.map(r => (
                <div className="glass-btn-inner" key={r.id}>
                  <div className="reminder-icon"><ShortcutIcon type={r.icon} /></div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(40,40,40,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Impl as any;
    })(),

    PageCard: (() => {
      function Impl({ props }: { props: { recordId: string; variant: 'small' | 'large' | 'large-image' } }) {
        const navigate = useNavigate();
        const pages = usePages();
        const page = pages.find(p => p.id === props.recordId);
        if (!page) return null;
        const openPage = () => navigate(`/file/${widgetPageFileId(page.id)}`);

        if (props.variant === 'small') {
          return (
            <div className="glass-card" style={{ padding: '32px 28px 28px' }}>
              <h2 style={{ fontSize: 28, fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: '0 0 6px', lineHeight: 1.2, textAlign: 'center' }}>{page.title}</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 20px', textAlign: 'center', fontWeight: 400 }}>By {page.author}</p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: '0 0 24px', textAlign: 'center' }}>{page.body}</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                <GlassLinkButton label="Read" onClick={openPage} />
                <GlassLinkButton label="Visit Link" href={page.link} />
              </div>
            </div>
          );
        }

        if (props.variant === 'large-image') {
          return (
            <div className="glass-card" style={{ padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {page.subtitle && <p className="wd-subtitle" style={{ marginBottom: 4 }}>{page.subtitle}</p>}
                  <h3 className="wd-title" style={{ fontSize: 32 }}>{page.title}</h3>
                </div>
                <div style={{ width: '45%', flexShrink: 0 }}>
                  <img src={cardAbstract} alt="" style={{ width: '100%', height: '100%', minHeight: 160, objectFit: 'cover', borderRadius: 16 }} />
                </div>
              </div>
              <GlassLinkButton label="Start" onClick={openPage} style={{ width: '100%' }} />
            </div>
          );
        }

        // variant === 'large'
        return (
          <div className="glass-card" style={{ padding: '28px 26px', display: 'flex', flexDirection: 'column' }}>
            {page.subtitle && <p className="wd-subtitle" style={{ marginBottom: 4, textAlign: 'center' }}>{page.subtitle}</p>}
            <h3 className="wd-title" style={{ marginBottom: 18, textAlign: 'center' }}>{page.title}</h3>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, margin: '0 0 24px', textAlign: 'center', flex: 1 }}>{page.body}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              <GlassLinkButton label="Read" onClick={openPage} />
              <GlassLinkButton label="Visit Link" href={page.link} />
            </div>
          </div>
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Impl as any;
    })(),

    GlassHeading: ({ props }) => {
      const level = props.level ?? 'h2';
      if (level === 'h1') return <h1 className="wd-title">{props.text}</h1>;
      if (level === 'h3') return <h3 className="wd-subtitle">{props.text}</h3>;
      return <h2 className="wd-title" style={{ fontSize: 28 }}>{props.text}</h2>;
    },

    GlassText: ({ props }) => (
      <p className="wd-body">{props.content}</p>
    ),
  },
});
