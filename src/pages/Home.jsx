import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchItems, updateStatus } from '../api.js';
import ContextMenu from '../components/ContextMenu.jsx';
import TopBar from '../components/TopBar.jsx';
import FeedTable from '../components/FeedTable.jsx';
import LLMBox from '../components/LLMBox.jsx';
import './Home.css';

const DEFAULT_STATUS_FILTER = ['Unread', 'Read', 'Starred'];

export default function Home() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sort state
  const [sortCol, setSortCol] = useState('capturedAt');
  const [sortDir, setSortDir] = useState('desc');

  // Filter state
  const [statusFilter, setStatusFilter] = useState(DEFAULT_STATUS_FILTER);
  const [sourceNameFilter, setSourceNameFilter] = useState('');
  const [tagsFilter, setTagsFilter] = useState([]);

  // Visible optional columns (beyond the always-visible set)
  const [extraCols, setExtraCols] = useState([]);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, item }
  const longPressTimer = useRef(null);

  function loadItems() {
    setLoading(true);
    fetchItems()
      .then(setItems)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadItems(); }, []);

  // Derived: unique source names and tags for filter dropdowns
  const sourceNames = [...new Set(items.map(i => i.sourceName).filter(Boolean))].sort();
  const allTags = [...new Set(items.flatMap(i => i.tags))].sort();

  // Apply filters
  const filtered = items.filter(item => {
    if (statusFilter.length && !statusFilter.includes(item.status)) return false;
    if (sourceNameFilter && item.sourceName !== sourceNameFilter) return false;
    if (tagsFilter.length && !tagsFilter.every(t => item.tags.includes(t))) return false;
    return true;
  });

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortCol] ?? '';
    let bv = b[sortCol] ?? '';
    if (sortCol === 'capturedAt' || sortCol === 'publishedAt') {
      av = av ? new Date(av).getTime() : 0;
      bv = bv ? new Date(bv).getTime() : 0;
    } else if (Array.isArray(av)) {
      av = av.join(',');
      bv = bv.join(',');
    } else {
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  async function handleRowClick(item) {
    closeCtxMenu();
    if (item.status === 'Unread') {
      // Optimistic update
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'Read' } : i));
      try {
        await updateStatus(item.id, 'Read');
      } catch {
        // Revert on failure
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'Unread' } : i));
      }
    }
    navigate(`/page/${item.id}`);
  }

  function handleContextMenu(e, item) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, item });
  }

  function handleTouchStart(e, item) {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setCtxMenu({ x: touch.clientX, y: touch.clientY, item });
    }, 500);
  }

  function handleTouchEnd() {
    clearTimeout(longPressTimer.current);
  }

  function closeCtxMenu() {
    setCtxMenu(null);
  }

  const handleCtxAction = useCallback(async (action, item) => {
    closeCtxMenu();
    if (action === 'openUrl') {
      if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener');
      return;
    }
    const statusMap = { markRead: 'Read', star: 'Starred', archive: 'Archived' };
    const newStatus = statusMap[action];
    if (!newStatus) return;

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
    try {
      await updateStatus(item.id, newStatus);
    } catch {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: item.status } : i));
    }
  }, []);

  return (
    <div className="home">
      <div className="home-demo-banner">
        <div>
          <strong>Runtime demo</strong>
          <span> Open a hard-coded page that shows layouts, bindings, state transitions, assessments, glossary memory, and agent blocks.</span>
        </div>
        <Link to="/demo/runtime" className="home-demo-banner__link">Open demo</Link>
      </div>

      <TopBar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sourceNames={sourceNames}
        sourceNameFilter={sourceNameFilter}
        setSourceNameFilter={setSourceNameFilter}
        allTags={allTags}
        tagsFilter={tagsFilter}
        setTagsFilter={setTagsFilter}
        extraCols={extraCols}
        setExtraCols={setExtraCols}
      />

      {loading && <div className="state-msg">Loading…</div>}
      {error && <div className="state-msg state-msg--error">Error: {error}</div>}

      {!loading && !error && (
        <FeedTable
          items={sorted}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={handleRowClick}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          extraCols={extraCols}
        />
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          item={ctxMenu.item}
          onAction={handleCtxAction}
          onClose={closeCtxMenu}
        />
      )}

      <LLMBox onRefresh={loadItems} />
    </div>
  );
}
