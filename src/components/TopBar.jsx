import { useState, useRef, useEffect } from 'react';
import './TopBar.css';

const ALL_STATUSES = ['Unread', 'Read', 'Starred', 'Archived'];

const OPTIONAL_COLS = [
  { key: 'snippet',     label: 'Snippet' },
  { key: 'sourceUrl',   label: 'Source URL' },
  { key: 'publishedAt', label: 'Published At' },
  { key: 'sourceType',  label: 'Source Type' },
  { key: 'feedId',      label: 'Feed ID' },
  { key: 'contentHash', label: 'Content Hash' },
  { key: 'llmSummary',  label: 'LLM Summary' },
];

export default function TopBar({
  statusFilter, setStatusFilter,
  sourceNames, sourceNameFilter, setSourceNameFilter,
  allTags, tagsFilter, setTagsFilter,
  extraCols, setExtraCols,
}) {
  const [colsOpen, setColsOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const colsRef = useRef(null);
  const tagsRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e) {
      if (colsRef.current && !colsRef.current.contains(e.target)) setColsOpen(false);
      if (tagsRef.current && !tagsRef.current.contains(e.target)) setTagsOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function toggleStatus(s) {
    setStatusFilter(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  function toggleTag(tag) {
    setTagsFilter(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  function toggleCol(key) {
    setExtraCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  return (
    <header className="topbar">
      <span className="topbar__brand">Grabbit</span>

      <div className="topbar__controls">
        {/* Status chips */}
        <div className="topbar__group">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              className={`chip${statusFilter.includes(s) ? ' chip--active' : ''}`}
              onClick={() => toggleStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Source Name dropdown */}
        <select
          className="topbar__select"
          value={sourceNameFilter}
          onChange={e => setSourceNameFilter(e.target.value)}
        >
          <option value="">All sources</option>
          {sourceNames.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {/* Tags multi-select */}
        {allTags.length > 0 && (
          <div className="topbar__dropdown" ref={tagsRef}>
            <button
              className={`topbar__dropdown-btn${tagsFilter.length ? ' topbar__dropdown-btn--active' : ''}`}
              onClick={() => setTagsOpen(o => !o)}
            >
              Tags{tagsFilter.length ? ` (${tagsFilter.length})` : ''}
            </button>
            {tagsOpen && (
              <div className="topbar__dropdown-menu">
                {allTags.map(tag => (
                  <label key={tag} className="topbar__dropdown-item">
                    <input
                      type="checkbox"
                      checked={tagsFilter.includes(tag)}
                      onChange={() => toggleTag(tag)}
                    />
                    {tag}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Columns toggle */}
        <div className="topbar__dropdown" ref={colsRef}>
          <button
            className="topbar__dropdown-btn"
            onClick={() => setColsOpen(o => !o)}
          >
            Columns
          </button>
          {colsOpen && (
            <div className="topbar__dropdown-menu">
              {OPTIONAL_COLS.map(col => (
                <label key={col.key} className="topbar__dropdown-item">
                  <input
                    type="checkbox"
                    checked={extraCols.includes(col.key)}
                    onChange={() => toggleCol(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
