import React, { useState } from 'react';
import type { DatabaseDocument, DatabaseField, DatabaseRecord } from '../../shared/types';
import { nanoid } from '../../shared/utils/nanoid';
import { FieldBadge } from './FieldBadge';
import { Icon } from '../../shared/components/Icon';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';

interface Props {
  doc: DatabaseDocument;
  onChange: (patch: Partial<DatabaseDocument>) => void;
}

export function BoardView({ doc, onChange }: Props) {
  const groupField = doc.schema.find(f => f.id === doc.groupByField) ?? doc.schema.find(f => f.type === 'select');
  const titleField = getTitleField(doc.schema, groupField?.id);
  const cardFields = doc.schema.filter(f => f.id !== groupField?.id && f.id !== titleField?.id);
  const [dragging, setDragging] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (!groupField || groupField.type !== 'select') {
    return <div style={{ color: '#888', padding: 16 }}>No select field to group by.</div>;
  }

  const columns = groupField.options ?? [];

  function getColRecords(colLabel: string) {
    return doc.records.filter(r => r.fields[groupField!.id] === colLabel);
  }

  function handleDragStart(e: DragStartEvent) {
    setDragging(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;
    const recordId = active.id as string;
    const newColLabel = over.id as string;
    onChange({
      records: doc.records.map(r =>
        r.id === recordId ? { ...r, fields: { ...r.fields, [groupField!.id]: newColLabel } } : r
      ),
    });
  }

  function addRecord(colLabel: string) {
    const rec: DatabaseRecord = { id: nanoid(), fields: { [groupField!.id]: colLabel } };
    onChange({ records: [...doc.records, rec] });
  }

  const draggingRecord = doc.records.find(r => r.id === dragging);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 16, alignItems: 'stretch' }}>
        {columns.map(col => (
          <BoardColumn
            key={col.id}
            label={col.label}
            color={col.color}
            records={getColRecords(col.label)}
            titleField={titleField}
            fields={cardFields}
            columnCount={columns.length}
            onAdd={() => addRecord(col.label)}
            onDelete={(id) => onChange({ records: doc.records.filter(r => r.id !== id) })}
          />
        ))}
      </div>
      <DragOverlay>
        {draggingRecord && (
          <div style={{ ...cardStyle, transform: 'rotate(2deg)', opacity: 0.9, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {getTitleValue(draggingRecord, titleField)}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({ label, color, records, titleField, fields, columnCount, onAdd, onDelete }: {
  label: string; color: string;
  records: DatabaseRecord[];
  titleField?: DatabaseField;
  fields: DatabaseField[];
  columnCount: number;
  onAdd: () => void; onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: label });

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        maxWidth: columnCount > 3 ? 340 : undefined,
        background: isOver ? '#eef2ff' : '#f7f7f5',
        borderRadius: 8, padding: '10px', transition: 'background 0.15s',
        border: isOver ? '2px dashed #6366f1' : '2px solid transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <FieldBadge label={label} color={color} />
        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>{records.length}</span>
      </div>
      {records.map(rec => (
        <DraggableCard key={rec.id} rec={rec} titleField={titleField} fields={fields} onDelete={onDelete} />
      ))}
      <button onClick={onAdd} style={{
        width: '100%', marginTop: 8, padding: '6px 0',
        background: 'none', border: '1px dashed #ddd', borderRadius: 6,
        cursor: 'pointer', color: '#aaa', fontSize: 12, display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <Icon name="plus" size={12} /> Add
      </button>
    </div>
  );
}

function DraggableCard({ rec, titleField, fields, onDelete: _onDelete }: {
  rec: DatabaseRecord;
  titleField?: DatabaseField;
  fields: DatabaseField[];
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: rec.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        ...cardStyle,
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 4 }}>
        {getTitleValue(rec, titleField)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {fields.map(field => {
          const value = renderFieldValue(field, rec.fields[field.id]);
          if (!value) return null;
          return (
            <div key={field.id} style={{ fontSize: 11, color: '#777', minWidth: 0 }}>
              <div style={{ color: '#9a9a99', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {field.name}
              </div>
              <div style={{ minWidth: 0 }}>{value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 6,
  padding: '9px 10px',
  marginBottom: 8,
  width: '100%',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #eee',
  userSelect: 'none',
};

function getTitleField(schema: DatabaseField[], groupFieldId?: string) {
  const candidates = schema.filter(f => f.id !== groupFieldId);
  return candidates.find(f => f.type === 'text') ?? candidates[0];
}

function getTitleValue(rec: DatabaseRecord, titleField?: DatabaseField) {
  if (!titleField) return 'Untitled';
  const val = rec.fields[titleField.id];
  if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) return 'Untitled';
  return Array.isArray(val) ? val.join(', ') : String(val);
}

function renderFieldValue(field: DatabaseField, raw: DatabaseRecord['fields'][string]) {
  if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) return null;

  if (field.type === 'select') {
    const label = String(raw);
    const color = field.options?.find(o => o.label === label)?.color;
    return <FieldBadge label={label} color={color} />;
  }

  if (field.type === 'multiselect') {
    const values = Array.isArray(raw) ? raw : [String(raw)];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {values.map(v => {
          const color = field.options?.find(o => o.label === v)?.color;
          return <FieldBadge key={v} label={v} color={color} />;
        })}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return <span style={{ fontSize: 12, color: '#666' }}>{raw ? '☑ Checked' : '☐ Unchecked'}</span>;
  }

  if (field.type === 'date') {
    return <span style={{ fontSize: 12, color: '#666' }}>{String(raw)}</span>;
  }

  if (field.type === 'url') {
    return (
      <span style={{
        fontSize: 12, color: '#3b82f6',
        display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {String(raw)}
      </span>
    );
  }

  return (
    <span style={{
      fontSize: 12, color: '#444',
      display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {Array.isArray(raw) ? raw.join(', ') : String(raw)}
    </span>
  );
}
