import './FeedTable.css';

const OPTIONAL_COL_DEFS = {
  snippet:     { label: 'Snippet',      render: item => item.snippet || '—' },
  sourceUrl:   { label: 'Source URL',   render: item => item.sourceUrl
    ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{item.sourceUrl}</a>
    : '—' },
  publishedAt: { label: 'Published At', render: item => fmtDate(item.publishedAt) },
  sourceType:  { label: 'Source Type',  render: item => item.sourceType || '—' },
  feedId:      { label: 'Feed ID',      render: item => item.feedId || '—' },
  contentHash: { label: 'Content Hash', render: item => item.contentHash ? <code>{item.contentHash.slice(0, 12)}…</code> : '—' },
  llmSummary:  { label: 'Summary',      render: item => item.llmSummary
    ? <span className="ft-truncate">{item.llmSummary}</span>
    : '—' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const day = 86400000;
  if (diff < day) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 7 * day) {
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusDot({ status }) {
  const cls = {
    Unread: 'dot dot--unread',
    Read: 'dot dot--read',
    Starred: 'dot dot--starred',
    Archived: 'dot dot--archived',
  }[status] || 'dot';
  return <span className={cls} title={status} />;
}

function SortIndicator({ col, sortCol, sortDir }) {
  if (col !== sortCol) return <span className="sort-indicator sort-indicator--idle">⇅</span>;
  return <span className="sort-indicator">{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

export default function FeedTable({
  items, sortCol, sortDir, onSort,
  onRowClick, onContextMenu, onTouchStart, onTouchEnd,
  extraCols,
}) {
  const extraDefs = extraCols.map(k => ({ key: k, ...OPTIONAL_COL_DEFS[k] })).filter(Boolean);

  function rowClass(item) {
    const classes = ['ft-row'];
    if (item.status === 'Archived') classes.push('ft-row--archived');
    return classes.join(' ');
  }

  return (
    <div className="ft-wrapper">
      <table className="ft">
        <thead>
          <tr>
            <th className="ft-th ft-th--status" onClick={() => onSort('status')}>
              <span>Status</span>
              <SortIndicator col="status" sortCol={sortCol} sortDir={sortDir} />
            </th>
            <th className="ft-th ft-th--title" onClick={() => onSort('title')}>
              <span>Title</span>
              <SortIndicator col="title" sortCol={sortCol} sortDir={sortDir} />
            </th>
            <th className="ft-th ft-th--source" onClick={() => onSort('sourceName')}>
              <span>Source</span>
              <SortIndicator col="sourceName" sortCol={sortCol} sortDir={sortDir} />
            </th>
            <th className="ft-th ft-th--tags">
              <span>Tags</span>
            </th>
            <th className="ft-th ft-th--date" onClick={() => onSort('capturedAt')}>
              <span>Captured</span>
              <SortIndicator col="capturedAt" sortCol={sortCol} sortDir={sortDir} />
            </th>
            {extraDefs.map(def => (
              <th key={def.key} className="ft-th ft-th--extra" onClick={() => onSort(def.key)}>
                <span>{def.label}</span>
                <SortIndicator col={def.key} sortCol={sortCol} sortDir={sortDir} />
              </th>
            ))}
            <th className="ft-th ft-th--chevron" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={6 + extraDefs.length} className="ft-empty">No items match the current filters.</td>
            </tr>
          )}
          {items.map(item => (
            <tr
              key={item.id}
              className={rowClass(item)}
              onClick={() => onRowClick(item)}
              onContextMenu={e => onContextMenu(e, item)}
              onTouchStart={e => onTouchStart(e, item)}
              onTouchEnd={onTouchEnd}
              onTouchMove={onTouchEnd}
            >
              <td className="ft-td ft-td--status">
                <StatusDot status={item.status} />
                {item.status === 'Starred' && <span className="star-icon" aria-label="Starred">★</span>}
              </td>
              <td className="ft-td ft-td--title">
                <span className={item.status === 'Unread' ? 'ft-title ft-title--unread' : 'ft-title'}>
                  {item.title || '(no title)'}
                </span>
              </td>
              <td className="ft-td ft-td--source">{item.sourceName || '—'}</td>
              <td className="ft-td ft-td--tags">
                {item.tags.map(tag => (
                  <span key={tag} className="tag-pill">{tag}</span>
                ))}
              </td>
              <td className="ft-td ft-td--date">{fmtDate(item.capturedAt)}</td>
              {extraDefs.map(def => (
                <td key={def.key} className="ft-td ft-td--extra">{def.render(item)}</td>
              ))}
              <td className="ft-td ft-td--chevron" aria-hidden="true">›</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
