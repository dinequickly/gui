import React, { useState } from 'react';
import type { DatabaseDocument, DatabaseViewKind } from '../../shared/types';
import { Icon } from '../../shared/components/Icon';
import { TableView } from './TableView';
import { BoardView } from './BoardView';
import { CalendarView } from './CalendarView';
import { GalleryView } from './GalleryView';
import { ListView } from './ListView';

const VIEW_TABS: { kind: DatabaseViewKind; label: string; icon: React.ComponentProps<typeof Icon>['name'] }[] = [
  { kind: 'table', label: 'Table', icon: 'table' },
  { kind: 'board', label: 'Board', icon: 'board' },
  { kind: 'calendar', label: 'Calendar', icon: 'calendar' },
  { kind: 'gallery', label: 'Gallery', icon: 'gallery' },
  { kind: 'list', label: 'List', icon: 'list' },
];

interface Props {
  doc: DatabaseDocument;
  onChange: (patch: Partial<DatabaseDocument>) => void;
  embedded?: boolean;
}

export function DatabaseView({ doc, onChange, embedded = false }: Props) {
  const [view, setView] = useState<DatabaseViewKind>(doc.viewKind);

  const padding = embedded ? '0' : '0 32px 48px';

  return (
    <div style={{ padding }}>
      {/* View switcher tabs */}
      <div style={{
        display: 'flex', gap: 2, borderBottom: '1px solid #e2e2e0',
        marginBottom: 16, paddingBottom: 0,
      }}>
        {VIEW_TABS.map(tab => (
          <button
            key={tab.kind}
            onClick={() => setView(tab.kind)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 13, color: view === tab.kind ? '#333' : '#888',
              borderBottom: view === tab.kind ? '2px solid #333' : '2px solid transparent',
              marginBottom: -1, fontWeight: view === tab.kind ? 600 : 400,
              transition: 'color 0.1s',
            }}
          >
            <Icon name={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* View content */}
      {view === 'table' && <TableView doc={doc} onChange={onChange} />}
      {view === 'board' && <BoardView doc={doc} onChange={onChange} />}
      {view === 'calendar' && <CalendarView doc={doc} />}
      {view === 'gallery' && <GalleryView doc={doc} onChange={onChange} />}
      {view === 'list' && <ListView doc={doc} onChange={onChange} />}
    </div>
  );
}
