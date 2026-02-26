import type { SpreadsheetPreview } from '../../shared/types';
import { Icon } from '../../shared/components/Icon';

interface Props {
  preview: SpreadsheetPreview;
}

export function SpreadsheetPreviewCard({ preview }: Props) {
  const { file, columns, rows } = preview;
  const visibleCols = columns.slice(0, 4);

  return (
    <div>
      <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="sheet" size={13} style={{ color: '#059669' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{file.title || 'Untitled'}</span>
      </div>

      {columns.length > 0 ? (
        <div style={{ overflow: 'hidden', borderTop: '1px solid #e2e2e0', maxHeight: 160 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f7f7f5' }}>
                {visibleCols.map(c => (
                  <th key={c.id} style={{
                    padding: '4px 8px', textAlign: 'left', fontWeight: 600, color: '#888',
                    borderBottom: '1px solid #e2e2e0', borderRight: '1px solid #e9e9e7',
                    whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 80, textOverflow: 'ellipsis',
                  }}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={row.id} style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                  {visibleCols.map(c => {
                    const val = row.cells[c.id];
                    return (
                      <td key={c.id} style={{
                        padding: '3px 8px',
                        borderBottom: ri === rows.length - 1 ? 'none' : '1px solid #f0f0ef',
                        borderRight: '1px solid #f0f0ef', color: '#555',
                        maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {c.type === 'checkbox'
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
      ) : (
        <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>Empty spreadsheet</div>
      )}
    </div>
  );
}
