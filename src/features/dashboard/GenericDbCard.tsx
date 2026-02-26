import type React from 'react';
import type { GenericDbPreview, DatabaseField, DatabaseRecord } from '../../shared/types';
import { Icon } from '../../shared/components/Icon';

interface Props {
  preview: GenericDbPreview;
}

export function GenericDbCard({ preview }: Props) {
  const { file, viewKind, recordCount, records, schema, groupByField } = preview;

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (viewKind === 'list' && records && schema) {
    const nameField = schema[0];
    const doneField = schema.find(f => f.type === 'checkbox');
    const priorityField = schema.find(f => f.type === 'select');
    const top5 = records.slice(0, 5);

    return (
      <div>
        <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="list" size={13} style={{ color: '#16a34a' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{file.title || 'Untitled'}</span>
        </div>
        {top5.map(rec => {
          const title = nameField ? String(rec.fields[nameField.id] ?? 'Untitled') : 'Untitled';
          const done = doneField ? Boolean(rec.fields[doneField.id]) : false;
          const priority = priorityField ? String(rec.fields[priorityField.id] ?? '') : '';
          const priorityColor = priorityField?.options?.find(o => o.label === priority)?.color;
          return (
            <div key={rec.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 14px', borderTop: '1px solid #f0f0ef',
            }}>
              <span style={{ fontSize: 11, color: done ? '#ccc' : '#555', marginTop: 1 }}>
                {done ? '☑' : '○'}
              </span>
              <span style={{
                fontSize: 12, color: done ? '#aaa' : '#222',
                textDecoration: done ? 'line-through' : 'none',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {title}
              </span>
              {priority && (
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 8, flexShrink: 0,
                  background: priorityColor ? `${priorityColor}22` : '#f0f0ef',
                  color: priorityColor ?? '#888',
                }}>
                  {priority}
                </span>
              )}
            </div>
          );
        })}
        {recordCount > 5 && (
          <div style={{ padding: '4px 14px 10px', fontSize: 11, color: '#bbb' }}>
            +{recordCount - 5} more
          </div>
        )}
      </div>
    );
  }

  // ── GALLERY VIEW ───────────────────────────────────────────────────────────
  if (viewKind === 'gallery' && records && schema) {
    const imageField = schema.find(f => f.type === 'url');
    const nameField = schema[0];
    const withImage = imageField
      ? records.filter(r => r.fields[imageField.id])
      : [];
    // Pick up to 4 random images
    const picked = [...withImage].sort(() => Math.random() - 0.5).slice(0, 4);

    return (
      <div>
        {picked.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: picked.length === 1 ? '1fr' : '1fr 1fr',
            gridTemplateRows: picked.length > 2 ? '80px 80px' : '140px',
            gap: 2,
          }}>
            {picked.map((rec, i) => (
              <img
                key={rec.id}
                src={String(rec.fields[imageField!.id])}
                alt={nameField ? String(rec.fields[nameField.id] ?? '') : ''}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                  ...(i === 0 && picked.length === 3 ? { gridRow: 'span 2' } : {}),
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{
            height: 120, background: 'linear-gradient(135deg, #fdf4ff, #f5d0fe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="gallery" size={28} style={{ color: '#a21caf' }} />
          </div>
        )}
        <div style={{ padding: '8px 14px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{file.title || 'Untitled'}</div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{recordCount} items</div>
        </div>
      </div>
    );
  }

  // ── TABLE VIEW ─────────────────────────────────────────────────────────────
  if (viewKind === 'table' && records && schema) {
    const visibleCols = schema.slice(0, 4);
    const visibleRows = records.slice(0, 5);

    return (
      <div>
        <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="table" size={13} style={{ color: '#7c3aed' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{file.title || 'Untitled'}</span>
        </div>
        <div style={{ overflow: 'hidden', borderTop: '1px solid #e2e2e0', maxHeight: 160 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f7f7f5' }}>
                {visibleCols.map(col => (
                  <th key={col.id} style={{
                    padding: '4px 8px', textAlign: 'left', fontWeight: 600, color: '#888',
                    borderBottom: '1px solid #e2e2e0', borderRight: '1px solid #e9e9e7',
                    whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 80, textOverflow: 'ellipsis',
                  }}>
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, ri) => (
                <tr key={row.id} style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                  {visibleCols.map(col => {
                    const val = row.fields[col.id];
                    return (
                      <td key={col.id} style={{
                        padding: '3px 8px',
                        borderBottom: ri === visibleRows.length - 1 ? 'none' : '1px solid #f0f0ef',
                        borderRight: '1px solid #f0f0ef', color: '#555',
                        maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {col.type === 'checkbox'
                          ? <span>{val ? '☑' : '☐'}</span>
                          : val != null ? String(val) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── BOARD VIEW ─────────────────────────────────────────────────────────────
  if (viewKind === 'board' && records && schema) {
    const groupField = schema.find(f => f.id === groupByField) ?? schema.find(f => f.type === 'select');
    const titleField = getBoardTitleField(schema, groupField?.id);
    const cardFields = schema.filter(f => f.id !== groupField?.id && f.id !== titleField?.id);
    const columns = (groupField?.options ?? []).slice(0, 3);

    return (
      <div>
        <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="board" size={13} style={{ color: '#ea580c' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{file.title || 'Untitled'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '6px 10px 12px', overflow: 'hidden', alignItems: 'stretch' }}>
          {columns.length > 0 ? columns.map(col => {
            const allColRecords = groupField
              ? records.filter(r => r.fields[groupField.id] === col.label)
              : [];
            const colRecords = allColRecords.slice(0, 3);
            return (
              <div key={col.id} style={{ flex: '1 1 0', minWidth: 0, maxWidth: `${100 / columns.length}%` }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, marginBottom: 6, padding: '2px 6px', borderRadius: 4,
                  background: col.color ? `${col.color}22` : '#f0f0ef',
                  color: col.color ?? '#888',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {col.label} <span style={{ fontWeight: 400, opacity: 0.7 }}>
                    {allColRecords.length}
                  </span>
                </div>
                {colRecords.map(rec => (
                  <div key={rec.id} style={{
                    fontSize: 11, padding: '5px 7px', marginBottom: 6, borderRadius: 5,
                    background: '#fff', border: '1px solid #ebebea',
                    color: '#333', width: '100%',
                  }}>
                    <div style={{
                      fontWeight: 600, marginBottom: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {getBoardTitle(rec, titleField)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {cardFields.map(field => {
                        const value = renderPreviewField(field, rec.fields[field.id]);
                        if (!value) return null;
                        return (
                          <div key={field.id} style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: 10, color: '#9a9a99', marginBottom: 1,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {field.name}
                            </div>
                            <div style={{ minWidth: 0 }}>{value}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          }) : (
            <div style={{ fontSize: 11, color: '#bbb', padding: '4px 0' }}>No columns defined</div>
          )}
        </div>
      </div>
    );
  }

  // ── FALLBACK ───────────────────────────────────────────────────────────────
  const CONFIGS: Record<string, { gradient: string; iconColor: string; label: string; icon: React.ComponentProps<typeof Icon>['name'] }> = {
    table: { gradient: 'linear-gradient(135deg, #faf5ff, #ede9fe)', iconColor: '#7c3aed', label: 'Table', icon: 'table' },
    board: { gradient: 'linear-gradient(135deg, #fff7ed, #fed7aa)', iconColor: '#ea580c', label: 'Board', icon: 'board' },
    gallery: { gradient: 'linear-gradient(135deg, #fdf4ff, #f5d0fe)', iconColor: '#a21caf', label: 'Gallery', icon: 'gallery' },
    list: { gradient: 'linear-gradient(135deg, #f0fdf4, #bbf7d0)', iconColor: '#16a34a', label: 'List', icon: 'list' },
  };
  const config = CONFIGS[viewKind] ?? CONFIGS.table;

  return (
    <div>
      <div style={{
        height: 72, background: config.gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4,
      }}>
        <Icon name={config.icon} size={28} style={{ color: config.iconColor }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: config.iconColor }}>{config.label} view</span>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: '#1a1a1a' }}>
          {file.title || 'Untitled'}
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#aaa' }}>by {file.author}</span>
          <span style={{ fontSize: 11, color: '#ccc' }}>·</span>
          <span style={{ fontSize: 11, color: '#aaa' }}>{recordCount} records</span>
        </div>
        {file.tags?.length ? (
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            {file.tags.map(t => (
              <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#f0f0ef', color: '#777' }}>#{t}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getBoardTitleField(schema: DatabaseField[], groupFieldId?: string) {
  const candidates = schema.filter(f => f.id !== groupFieldId);
  return candidates.find(f => f.type === 'text') ?? candidates[0];
}

function getBoardTitle(rec: DatabaseRecord, titleField?: DatabaseField) {
  if (!titleField) return 'Untitled';
  const raw = rec.fields[titleField.id];
  if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) return 'Untitled';
  return Array.isArray(raw) ? raw.join(', ') : String(raw);
}

function renderPreviewField(field: DatabaseField, raw: DatabaseRecord['fields'][string]) {
  if (raw == null || raw === '' || (Array.isArray(raw) && raw.length === 0)) return null;

  if (field.type === 'select') {
    const label = String(raw);
    const color = field.options?.find(o => o.label === label)?.color;
    return (
      <span style={{
        display: 'inline-block',
        fontSize: 10,
        padding: '1px 6px',
        borderRadius: 8,
        background: color ? `${color}22` : '#f0f0ef',
        color: color ?? '#777',
      }}>
        {label}
      </span>
    );
  }

  if (field.type === 'multiselect') {
    const values = Array.isArray(raw) ? raw : [String(raw)];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {values.map(v => {
          const color = field.options?.find(o => o.label === v)?.color;
          return (
            <span key={v} style={{
              display: 'inline-block',
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 8,
              background: color ? `${color}22` : '#f0f0ef',
              color: color ?? '#777',
            }}>
              {v}
            </span>
          );
        })}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return <span style={{ fontSize: 10, color: '#666' }}>{raw ? '☑ Checked' : '☐ Unchecked'}</span>;
  }

  return (
    <span style={{
      display: 'block',
      fontSize: 10.5,
      color: '#666',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      {Array.isArray(raw) ? raw.join(', ') : String(raw)}
    </span>
  );
}
