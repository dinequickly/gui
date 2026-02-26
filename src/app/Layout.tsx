import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '../shared/components/Icon';
import { useFileStore } from '../shared/store/fileStore';
import type { WorkspaceFile } from '../shared/types';

const KIND_ICON: Record<string, React.ComponentProps<typeof Icon>['name']> = {
  page: 'file',
  spreadsheet: 'sheet',
  database: 'database',
};

const VIEW_ICON: Record<string, React.ComponentProps<typeof Icon>['name']> = {
  table: 'table',
  board: 'board',
  calendar: 'calendar',
  gallery: 'gallery',
  list: 'list',
};

function fileIcon(f: WorkspaceFile) {
  if (f.kind === 'database' && f.viewKind) return VIEW_ICON[f.viewKind] ?? 'database';
  return KIND_ICON[f.kind] ?? 'file';
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { files } = useFileStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  async function handleNew(kind: 'page' | 'spreadsheet') {
    const store = useFileStore.getState();
    let id: string;
    if (kind === 'page') id = await store.createPage();
    else id = await store.createSpreadsheet();
    navigate(`/file/${id}`);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 52 : 240,
        minWidth: collapsed ? 52 : 240,
        overflow: 'hidden',
        transition: 'width 0.2s, min-width 0.2s',
        background: '#f7f7f5',
        borderRight: '1px solid #e9e9e7',
        display: 'flex',
        flexDirection: 'column',
        fontSize: 14,
      }}>
        {/* Workspace header */}
        <div style={{ padding: '12px 12px 8px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e9e9e7' }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>N</div>
          {!collapsed && <span style={{ fontWeight: 600, color: '#1a1a1a', flex: 1 }}>My Workspace</span>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0', display: collapsed ? 'none' : 'block' }}>
          <NavItem to="/widgets" icon="gallery" label="Widgets" active={location.pathname === '/widgets'} />

          <div style={{ padding: '12px 12px 4px 16px', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pages
          </div>
          {files.filter(f => f.kind === 'page').map(f => (
            <NavItem key={f.id} to={`/file/${f.id}`} icon={fileIcon(f)} label={f.title || 'Untitled'}
              active={location.pathname === `/file/${f.id}`} />
          ))}
          <button onClick={() => handleNew('page')} style={addBtnStyle}>
            <Icon name="plus" size={13} /> New page
          </button>

          <div style={{ padding: '12px 12px 4px 16px', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Spreadsheets
          </div>
          {files.filter(f => f.kind === 'spreadsheet').map(f => (
            <NavItem key={f.id} to={`/file/${f.id}`} icon={fileIcon(f)} label={f.title || 'Untitled'}
              active={location.pathname === `/file/${f.id}`} />
          ))}
          <button onClick={() => handleNew('spreadsheet')} style={addBtnStyle}>
            <Icon name="plus" size={13} /> New spreadsheet
          </button>

          <div style={{ padding: '12px 12px 4px 16px', fontSize: 11, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Databases
          </div>
          {files.filter(f => f.kind === 'database').map(f => (
            <NavItem key={f.id} to={`/file/${f.id}`} icon={fileIcon(f)} label={f.title || 'Untitled'}
              active={location.pathname === `/file/${f.id}`} />
          ))}
          <DatabaseNewMenu navigate={navigate} />
        </nav>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <header style={{
          height: 44,
          borderBottom: '1px solid #e9e9e7',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 8,
          background: '#fff',
          flexShrink: 0,
        }}>
          <button onClick={() => setCollapsed(c => !c)} style={iconBtnStyle} title="Toggle sidebar">
            <Icon name="list" size={16} />
          </button>
          <Link to="/widgets" style={{ textDecoration: 'none', color: '#555', fontWeight: 500, fontSize: 14 }}>
            Notion App
          </Link>
        </header>

        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, icon, label, active }: { to: string; icon: React.ComponentProps<typeof Icon>['name']; label: string; active: boolean }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 12px 5px 16px',
      color: active ? '#1a1a1a' : '#666',
      background: active ? '#e9e9e7' : 'transparent',
      borderRadius: 4,
      margin: '0 4px',
      textDecoration: 'none',
      fontSize: 14,
      fontWeight: active ? 500 : 400,
      transition: 'background 0.1s',
    }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = '#efefed'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
    >
      <Icon name={icon} size={15} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
    </Link>
  );
}

function DatabaseNewMenu({ navigate }: { navigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const kinds = ['table', 'board', 'calendar', 'gallery', 'list'] as const;
  const icons: Record<string, React.ComponentProps<typeof Icon>['name']> = {
    table: 'table', board: 'board', calendar: 'calendar', gallery: 'gallery', list: 'list',
  };

  async function create(kind: typeof kinds[number]) {
    const id = await useFileStore.getState().createDatabase(kind);
    navigate(`/file/${id}`);
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={addBtnStyle}>
        <Icon name="plus" size={13} /> New database
      </button>
      {open && (
        <div style={{
          position: 'absolute', left: 16, top: '100%', zIndex: 100,
          background: '#fff', border: '1px solid #e2e2e0', borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: 4, minWidth: 160,
        }}>
          {kinds.map(k => (
            <button key={k} onClick={() => create(k)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '6px 10px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 13, color: '#333', borderRadius: 4, textAlign: 'left',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f3')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <Icon name={icons[k]} size={14} />
              {k.charAt(0).toUpperCase() + k.slice(1)} view
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const addBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  width: 'calc(100% - 24px)', margin: '2px 12px',
  padding: '4px 8px', background: 'none', border: 'none',
  cursor: 'pointer', fontSize: 13, color: '#999', borderRadius: 4,
  textAlign: 'left',
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: 4, borderRadius: 4, color: '#555', display: 'flex', alignItems: 'center',
};
