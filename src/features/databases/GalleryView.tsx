import type { DatabaseDocument, DatabaseRecord } from '../../shared/types';
import { nanoid } from '../../shared/utils/nanoid';
import { FieldBadge } from './FieldBadge';
import { Icon } from '../../shared/components/Icon';

interface Props {
  doc: DatabaseDocument;
  onChange: (patch: Partial<DatabaseDocument>) => void;
}

export function GalleryView({ doc, onChange }: Props) {
  const nameField = doc.schema[0];
  const imageField = doc.schema.find(f => f.type === 'url');
  const categoryField = doc.schema.find(f => f.type === 'select');
  const featuredField = doc.schema.find(f => f.type === 'checkbox');

  function addRecord() {
    const rec: DatabaseRecord = { id: nanoid(), fields: {} };
    onChange({ records: [...doc.records, rec] });
  }

  function deleteRecord(id: string) {
    onChange({ records: doc.records.filter(r => r.id !== id) });
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 16,
      }}>
        {doc.records.map(rec => {
          const imageUrl = imageField ? String(rec.fields[imageField.id] ?? '') : '';
          const title = nameField ? String(rec.fields[nameField.id] ?? 'Untitled') : 'Untitled';
          const category = categoryField ? String(rec.fields[categoryField.id] ?? '') : '';
          const featured = featuredField ? Boolean(rec.fields[featuredField.id]) : false;
          const catColor = categoryField?.options?.find(o => o.label === category)?.color;

          return (
            <div key={rec.id} style={{
              border: '1px solid #e2e2e0', borderRadius: 8, overflow: 'hidden',
              background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              position: 'relative',
            }}>
              {featured && (
                <div style={{ position: 'absolute', top: 8, right: 8, background: '#facc15', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, zIndex: 1 }}>★</div>
              )}
              {imageUrl ? (
                <img src={imageUrl} alt={title} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: 140, background: '#f0f0ef', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
                  <Icon name="image" size={28} />
                </div>
              )}
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: '#1a1a1a', marginBottom: 4 }}>{title}</div>
                {category && <FieldBadge label={category} color={catColor} />}
              </div>
              <button onClick={() => deleteRecord(rec.id)} style={{
                position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.4)',
                border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer',
                color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity 0.1s', padding: 0,
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
              >×</button>
            </div>
          );
        })}

        {/* Add card */}
        <div onClick={addRecord} style={{
          border: '1px dashed #ddd', borderRadius: 8, height: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#bbb', flexDirection: 'column', gap: 6,
        }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#aaa')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#ddd')}
        >
          <Icon name="plus" size={20} />
          <span style={{ fontSize: 13 }}>Add item</span>
        </div>
      </div>
    </div>
  );
}
