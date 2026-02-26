import { useState } from 'react';
import type { DatabaseDocument, DatabaseRecord } from '../../shared/types';
import { nanoid } from '../../shared/utils/nanoid';
import { FieldBadge } from './FieldBadge';
import { Icon } from '../../shared/components/Icon';

interface Props {
  doc: DatabaseDocument;
  onChange: (patch: Partial<DatabaseDocument>) => void;
}

export function ListView({ doc, onChange }: Props) {
  const [filter, setFilter] = useState<'all' | 'done' | 'todo'>('all');
  const nameField = doc.schema[0];
  const doneField = doc.schema.find(f => f.type === 'checkbox');
  const priorityField = doc.schema.find(f => f.type === 'select');
  const dateField = doc.schema.find(f => f.type === 'date');

  const filtered = doc.records.filter(r => {
    if (filter === 'done') return doneField && r.fields[doneField.id] === true;
    if (filter === 'todo') return !doneField || !r.fields[doneField.id];
    return true;
  });

  function toggleDone(rec: DatabaseRecord) {
    if (!doneField) return;
    const cur = Boolean(rec.fields[doneField.id]);
    onChange({
      records: doc.records.map(r =>
        r.id === rec.id ? { ...r, fields: { ...r.fields, [doneField.id]: !cur } } : r
      ),
    });
  }

  function addRecord() {
    const rec: DatabaseRecord = { id: nanoid(), fields: {} };
    onChange({ records: [...doc.records, rec] });
  }

  function deleteRecord(id: string) {
    onChange({ records: doc.records.filter(r => r.id !== id) });
  }

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['all', 'todo', 'done'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 12px', borderRadius: 20, border: '1px solid',
            borderColor: filter === f ? '#333' : '#e2e2e0',
            background: filter === f ? '#333' : 'transparent',
            color: filter === f ? '#fff' : '#666',
            cursor: 'pointer', fontSize: 12, fontWeight: 500,
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#aaa', alignSelf: 'center' }}>
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Records */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {filtered.map(rec => {
          const name = nameField ? String(rec.fields[nameField.id] ?? 'Untitled') : 'Untitled';
          const done = doneField ? Boolean(rec.fields[doneField.id]) : false;
          const priority = priorityField ? String(rec.fields[priorityField.id] ?? '') : '';
          const date = dateField ? String(rec.fields[dateField.id] ?? '') : '';
          const priorityColor = priorityField?.options?.find(o => o.label === priority)?.color;

          return (
            <div key={rec.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 6, background: '#fff',
              border: '1px solid #f0f0ef',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9f9f8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggleDone(rec)}
                style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{
                flex: 1, fontSize: 14, color: done ? '#aaa' : '#333',
                textDecoration: done ? 'line-through' : 'none',
              }}>{name}</span>
              {priority && <FieldBadge label={priority} color={priorityColor} />}
              {date && <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{date}</span>}
              <button onClick={() => deleteRecord(rec.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 16, padding: 0, flexShrink: 0,
              }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f66')}
                onMouseLeave={e => (e.currentTarget.style.color = '#ddd')}
              >×</button>
            </div>
          );
        })}
      </div>

      <button onClick={addRecord} style={{
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', background: 'none', border: '1px dashed #ddd',
        borderRadius: 6, cursor: 'pointer', color: '#aaa', fontSize: 13,
      }}>
        <Icon name="plus" size={13} /> New item
      </button>
    </div>
  );
}
