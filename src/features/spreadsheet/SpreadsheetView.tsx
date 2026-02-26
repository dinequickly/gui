import React, { useState } from 'react';
import type { SpreadsheetDocument, SpreadsheetColumn, SpreadsheetRow, CellValue, ColumnType } from '../../shared/types';
import { nanoid } from '../../shared/utils/nanoid';
import { Icon } from '../../shared/components/Icon';

interface Props {
  doc: SpreadsheetDocument;
  onChange: (patch: Partial<SpreadsheetDocument>) => void;
  readOnly?: boolean;
  maxRows?: number;
}

export function SpreadsheetView({ doc, onChange, readOnly = false, maxRows }: Props) {
  const [editing, setEditing] = useState<{ rowId: string; colId: string } | null>(null);
  const [editVal, setEditVal] = useState<string>('');

  const rows = maxRows ? doc.rows.slice(0, maxRows) : doc.rows;

  function addColumn() {
    const col: SpreadsheetColumn = { id: nanoid(), name: 'Column', type: 'text' };
    onChange({ columns: [...doc.columns, col] });
  }

  function addRow() {
    const row: SpreadsheetRow = { id: nanoid(), cells: {} };
    onChange({ rows: [...doc.rows, row] });
  }

  function startEdit(rowId: string, colId: string) {
    if (readOnly) return;
    const row = doc.rows.find(r => r.id === rowId);
    const val = row?.cells[colId];
    setEditVal(val != null ? String(val) : '');
    setEditing({ rowId, colId });
  }

  function commitEdit() {
    if (!editing) return;
    const { rowId, colId } = editing;
    const col = doc.columns.find(c => c.id === colId);
    let parsed: CellValue = editVal;
    if (col?.type === 'number') parsed = editVal === '' ? null : parseFloat(editVal);
    if (col?.type === 'checkbox') parsed = editVal === 'true' || editVal === '1';
    const nextRows = doc.rows.map(r =>
      r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: parsed } } : r
    );
    onChange({ rows: nextRows });
    setEditing(null);
  }

  function updateColName(colId: string, name: string) {
    onChange({ columns: doc.columns.map(c => c.id === colId ? { ...c, name } : c) });
  }

  function deleteRow(rowId: string) {
    onChange({ rows: doc.rows.filter(r => r.id !== rowId) });
  }

  function deleteCol(colId: string) {
    onChange({
      columns: doc.columns.filter(c => c.id !== colId),
      rows: doc.rows.map(r => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    });
  }

  const cellStyle: React.CSSProperties = {
    padding: '6px 10px', border: '1px solid #e2e2e0', fontSize: 13,
    minWidth: 100, maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden',
    textOverflow: 'ellipsis', cursor: readOnly ? 'default' : 'text',
  };

  const headerStyle: React.CSSProperties = {
    ...cellStyle, background: '#f7f7f5', fontWeight: 600, color: '#555',
    cursor: 'default', position: 'relative',
  };

  function renderCell(row: SpreadsheetRow, col: SpreadsheetColumn) {
    const val = row.cells[col.id];
    const isEditing = editing?.rowId === row.id && editing?.colId === col.id;

    if (isEditing) {
      if (col.type === 'checkbox') {
        return (
          <input type="checkbox" checked={!!editVal} onChange={e => setEditVal(e.target.checked ? 'true' : 'false')}
            onBlur={commitEdit} autoFocus style={{ cursor: 'pointer' }} />
        );
      }
      return (
        <input
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); }}
          autoFocus
          type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%', minWidth: 80 }}
        />
      );
    }

    if (col.type === 'checkbox') {
      return <span style={{ fontSize: 14 }}>{val ? '☑' : '☐'}</span>;
    }
    if (col.type === 'number' && val != null) {
      return <span style={{ color: typeof val === 'number' && val < 0 ? '#ef4444' : '#333' }}>{val.toString()}</span>;
    }
    return <span style={{ color: val ? '#333' : '#bbb' }}>{val != null ? String(val) : '—'}</span>;
  }

  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {!readOnly && <th style={{ ...headerStyle, width: 28, textAlign: 'center' }}>#</th>}
            {doc.columns.map(col => (
              <th key={col.id} style={headerStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ColTypeIcon type={col.type} />
                  {readOnly ? (
                    <span>{col.name}</span>
                  ) : (
                    <input
                      value={col.name}
                      onChange={e => updateColName(col.id, e.target.value)}
                      style={{ border: 'none', outline: 'none', background: 'transparent', fontWeight: 600, fontSize: 13, color: '#555', width: '80%' }}
                    />
                  )}
                  {!readOnly && (
                    <button onClick={() => deleteCol(col.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 2, opacity: 0 }}
                      className="del-col" title="Delete column">×</button>
                  )}
                </div>
              </th>
            ))}
            {!readOnly && (
              <th style={{ ...headerStyle, cursor: 'pointer', color: '#aaa' }} onClick={addColumn}>
                + Col
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.id} style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f0ef')}
              onMouseLeave={e => (e.currentTarget.style.background = ri % 2 === 0 ? '#fff' : '#fafafa')}
            >
              {!readOnly && (
                <td style={{ ...cellStyle, textAlign: 'center', color: '#bbb', width: 28 }}>
                  <span style={{ fontSize: 11 }}>{ri + 1}</span>
                  <button onClick={() => deleteRow(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', padding: '0 2px', fontSize: 12 }}
                    title="Delete row">×</button>
                </td>
              )}
              {doc.columns.map(col => (
                <td
                  key={col.id}
                  style={cellStyle}
                  onClick={() => startEdit(row.id, col.id)}
                >
                  {renderCell(row, col)}
                </td>
              ))}
              {!readOnly && <td style={{ ...cellStyle, background: 'transparent' }} />}
            </tr>
          ))}
        </tbody>
      </table>

      {!readOnly && (
        <button
          onClick={addRow}
          style={{
            marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', background: 'none', border: '1px dashed #ddd',
            borderRadius: 6, cursor: 'pointer', color: '#aaa', fontSize: 13,
          }}
        >
          <Icon name="plus" size={13} /> Add row
        </button>
      )}
    </div>
  );
}

function ColTypeIcon({ type }: { type: ColumnType }) {
  const icons: Record<ColumnType, string> = {
    text: 'T', number: '#', date: '📅', checkbox: '☑', select: '◉',
  };
  return <span style={{ fontSize: 10, color: '#aaa', marginRight: 2 }}>{icons[type]}</span>;
}
