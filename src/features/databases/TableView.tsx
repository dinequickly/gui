import React, { useState } from 'react';
import type { DatabaseDocument, DatabaseRecord, DatabaseField } from '../../shared/types';
import { nanoid } from '../../shared/utils/nanoid';
import { Icon } from '../../shared/components/Icon';
import { FieldBadge } from './FieldBadge';

interface Props {
  doc: DatabaseDocument;
  onChange: (patch: Partial<DatabaseDocument>) => void;
}

export function TableView({ doc, onChange }: Props) {
  const [editing, setEditing] = useState<{ recordId: string; fieldId: string } | null>(null);
  const [editVal, setEditVal] = useState('');

  function addRecord() {
    const rec: DatabaseRecord = { id: nanoid(), fields: {} };
    onChange({ records: [...doc.records, rec] });
  }

  function startEdit(recordId: string, fieldId: string) {
    const rec = doc.records.find(r => r.id === recordId);
    const val = rec?.fields[fieldId];
    setEditVal(val != null ? String(val) : '');
    setEditing({ recordId, fieldId });
  }

  function commitEdit() {
    if (!editing) return;
    const { recordId, fieldId } = editing;
    const field = doc.schema.find(f => f.id === fieldId);
    let val: unknown = editVal;
    if (field?.type === 'checkbox') val = editVal === 'true';
    if (field?.type === 'number') val = editVal === '' ? null : parseFloat(editVal);
    onChange({
      records: doc.records.map(r =>
        r.id === recordId ? { ...r, fields: { ...r.fields, [fieldId]: val as string } } : r
      ),
    });
    setEditing(null);
  }

  function deleteRecord(id: string) {
    onChange({ records: doc.records.filter(r => r.id !== id) });
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#f7f7f5', borderBottom: '1px solid #e2e2e0',
    borderRight: '1px solid #e2e2e0', fontSize: 12, fontWeight: 600,
    color: '#666', textAlign: 'left', whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '6px 12px', borderBottom: '1px solid #f0f0ef',
    borderRight: '1px solid #f0f0ef', fontSize: 13, color: '#333',
    minWidth: 120, maxWidth: 240,
  };

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {doc.schema.map(f => (
              <th key={f.id} style={thStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FieldTypeIcon type={f.type} />
                  {f.name}
                </div>
              </th>
            ))}
            <th style={{ ...thStyle, width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {doc.records.map((rec, ri) => (
            <tr key={rec.id}
              style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f3')}
              onMouseLeave={e => (e.currentTarget.style.background = ri % 2 === 0 ? '#fff' : '#fafafa')}
            >
              {doc.schema.map(field => (
                <td key={field.id} style={tdStyle} onClick={() => startEdit(rec.id, field.id)}>
                  {editing?.recordId === rec.id && editing?.fieldId === field.id ? (
                    <input
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); }}
                      autoFocus
                      style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%' }}
                    />
                  ) : (
                    <CellDisplay record={rec} field={field} />
                  )}
                </td>
              ))}
              <td style={{ ...tdStyle, textAlign: 'center', width: 40 }}>
                <button onClick={() => deleteRecord(rec.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 16, padding: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f66')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#ddd')}
                >×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={addRecord} style={{
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', background: 'none', border: '1px dashed #ddd',
        borderRadius: 6, cursor: 'pointer', color: '#aaa', fontSize: 13,
      }}>
        <Icon name="plus" size={13} /> New record
      </button>
    </div>
  );
}

function CellDisplay({ record, field }: { record: DatabaseRecord; field: DatabaseField }) {
  const val = record.fields[field.id];
  if (val == null || val === '') return <span style={{ color: '#ccc' }}>—</span>;

  if (field.type === 'checkbox') {
    return <span style={{ fontSize: 15 }}>{val ? '☑' : '☐'}</span>;
  }
  if (field.type === 'select') {
    const opt = field.options?.find(o => o.label === val);
    return <FieldBadge label={String(val)} color={opt?.color} />;
  }
  if (field.type === 'date') {
    return <span style={{ color: '#888', fontSize: 12 }}>{String(val)}</span>;
  }
  return <span>{String(val)}</span>;
}

function FieldTypeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    text: 'T', number: '#', date: '📅', select: '◉', multiselect: '⊕',
    checkbox: '☑', person: '👤', url: '🔗',
  };
  return <span style={{ fontSize: 10, color: '#aaa' }}>{icons[type] ?? 'T'}</span>;
}
