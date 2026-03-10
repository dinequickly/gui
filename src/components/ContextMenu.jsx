import { useEffect, useRef } from 'react';
import './ContextMenu.css';

export default function ContextMenu({ x, y, item, onAction, onClose }) {
  const menuRef = useRef(null);

  // Adjust position so it doesn't go off-screen
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) el.style.left = `${vw - rect.width - 8}px`;
    if (rect.bottom > vh) el.style.top = `${vh - rect.height - 8}px`;
  }, [x, y]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      <div className="ctx-overlay" onClick={onClose} />
      <div
        ref={menuRef}
        className="ctx-menu"
        style={{ top: y, left: x }}
        role="menu"
      >
        <button
          className="ctx-item"
          onClick={() => onAction('markRead', item)}
          disabled={item.status === 'Read'}
        >
          Mark as Read
        </button>
        <button
          className="ctx-item"
          onClick={() => onAction('star', item)}
          disabled={item.status === 'Starred'}
        >
          Star
        </button>
        <button
          className="ctx-item"
          onClick={() => onAction('archive', item)}
          disabled={item.status === 'Archived'}
        >
          Archive
        </button>
        {item.sourceUrl && (
          <>
            <div className="ctx-divider" />
            <button
              className="ctx-item"
              onClick={() => onAction('openUrl', item)}
            >
              Open Source URL ↗
            </button>
          </>
        )}
      </div>
    </>
  );
}
