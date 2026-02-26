import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFileStore, getPage, updatePage, getSpreadsheet, updateSpreadsheet, getDatabase, updateDatabase } from '../../shared/store/fileStore';
import type { PageDocument, SpreadsheetDocument, DatabaseDocument, Block } from '../../shared/types';
import { BlockEditor } from './BlockEditor';
import { SpreadsheetView } from '../spreadsheet/SpreadsheetView';
import { DatabaseView } from '../databases/DatabaseView';
import { Icon } from '../../shared/components/Icon';

export function FilePage() {
  const { fileId } = useParams<{ fileId: string }>();
  const { files, updateFile, deleteFile } = useFileStore();
  const navigate = useNavigate();

  const file = files.find(f => f.id === fileId);
  const [page, setPage] = useState<PageDocument | null>(null);
  const [sheet, setSheet] = useState<SpreadsheetDocument | null>(null);
  const [dbDoc, setDbDoc] = useState<DatabaseDocument | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');

  useEffect(() => {
    if (!fileId) return;
    async function load() {
      const f = useFileStore.getState().files.find(x => x.id === fileId);
      if (!f) return;
      if (f.kind === 'page') {
        const p = await getPage(fileId!);
        setPage(p ?? { id: fileId!, blocks: [] });
      } else if (f.kind === 'spreadsheet') {
        const s = await getSpreadsheet(fileId!);
        setSheet(s ?? { id: fileId!, columns: [], rows: [] });
      } else if (f.kind === 'database') {
        const d = await getDatabase(fileId!);
        setDbDoc(d ?? { id: fileId!, viewKind: 'table', schema: [], records: [] });
      }
    }
    load();
  }, [fileId]);

  useEffect(() => {
    if (file) setTitleVal(file.title);
  }, [file?.title]);

  const handleBlocksChange = useCallback(async (blocks: Block[]) => {
    if (!fileId) return;
    setPage(p => p ? { ...p, blocks } : p);
    await updatePage(fileId, blocks);
  }, [fileId]);

  const handleSheetChange = useCallback(async (data: Partial<SpreadsheetDocument>) => {
    if (!fileId || !sheet) return;
    const next = { ...sheet, ...data };
    setSheet(next);
    await updateSpreadsheet(fileId, data);
  }, [fileId, sheet]);

  const handleDbChange = useCallback(async (data: Partial<DatabaseDocument>) => {
    if (!fileId || !dbDoc) return;
    const next = { ...dbDoc, ...data };
    setDbDoc(next);
    await updateDatabase(fileId, data);
  }, [fileId, dbDoc]);

  async function handleTitleSave() {
    if (!fileId) return;
    await updateFile(fileId, { title: titleVal });
    setEditingTitle(false);
  }

  async function handleDelete() {
    if (!fileId || !window.confirm('Delete this file?')) return;
    await deleteFile(fileId);
    navigate('/');
  }

  if (!file) {
    return <div style={{ padding: 48, color: '#888' }}>File not found.</div>;
  }

  return (
    <div style={{ maxWidth: file.kind === 'database' ? '100%' : 860, margin: '0 auto', padding: file.kind === 'database' ? '32px 0 0' : '48px 48px 80px' }}>
      {/* Cover image */}
      {file.coverImageUrl && (
        <div style={{ width: '100%', height: 200, marginBottom: 32, borderRadius: 8, overflow: 'hidden', marginTop: file.kind !== 'database' ? -48 : 0 }}>
          <img src={file.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24, padding: file.kind === 'database' ? '0 32px' : 0 }}>
        <div style={{ flex: 1 }}>
          {editingTitle ? (
            <input
              value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
              autoFocus
              style={{
                fontSize: 32, fontWeight: 700, border: 'none', outline: 'none',
                background: 'transparent', width: '100%', color: '#1a1a1a',
              }}
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              style={{ fontSize: 32, fontWeight: 700, margin: 0, cursor: 'text', color: '#1a1a1a', lineHeight: 1.2 }}
            >
              {file.title || 'Untitled'}
            </h1>
          )}
          <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>
            {file.author} · {new Date(file.updatedAt).toLocaleDateString()}
            {file.tags?.length ? ' · ' + file.tags.map(t => `#${t}`).join(' ') : ''}
          </div>
        </div>
        <button onClick={handleDelete} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 6 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f66')}
          onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
        >
          <Icon name="trash" size={16} />
        </button>
      </div>

      {/* Content */}
      {file.kind === 'page' && page && (
        <BlockEditor blocks={page.blocks} onChange={handleBlocksChange} />
      )}
      {file.kind === 'spreadsheet' && sheet && (
        <SpreadsheetView doc={sheet} onChange={handleSheetChange} />
      )}
      {file.kind === 'database' && dbDoc && (
        <DatabaseView doc={dbDoc} onChange={handleDbChange} />
      )}
    </div>
  );
}
