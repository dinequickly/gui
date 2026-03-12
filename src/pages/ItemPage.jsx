import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchItem, updateStatus, fetchPageDocument, savePageDocument, enrichContent } from '../api.js';
import BlockCanvas from '../components/BlockCanvas.jsx';
import PageChat from '../components/PageChat.jsx';
import { normalizePageDocument, serializePageDocument } from '../lib/pageDocument.js';
import { PageRuntimeProvider } from '../runtime/PageRuntime.jsx';
import './ItemPage.css';

const STATUSES = ['Unread', 'Read', 'Starred', 'Archived'];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ItemPage() {
  const { id } = useParams();

  const [item, setItem] = useState(null);
  const [itemLoading, setItemLoading] = useState(true);
  const [itemError, setItemError] = useState(null);

  const [pageDocument, setPageDocument] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState(null);

  // Load item from Notion
  useEffect(() => {
    setItemLoading(true);
    fetchItem(id)
      .then(setItem)
      .catch(err => setItemError(err.message))
      .finally(() => setItemLoading(false));
  }, [id]);

  // Load persisted blocks
  useEffect(() => {
    fetchPageDocument(id)
      .then(data => setPageDocument(normalizePageDocument(data, { pageId: id, pageType: 'item' })))
      .catch(() => setPageDocument(normalizePageDocument([], { pageId: id, pageType: 'item' })));
  }, [id]);


  async function runEnrich(mode) {
    if (!item || enriching || !pageDocument) return;
    setEnriching(true);
    setEnrichError(null);
    try {
      const data = await enrichContent({
        mode,
        title: item.title,
        snippet: item.snippet,
        tags: item.tags,
        sourceName: item.sourceName,
        existingBlocks: pageDocument.blocks ?? [],
      });
      const newBlocks = mode === 'initial'
        ? data.blocks
        : [...(pageDocument.blocks ?? []), ...data.blocks];
      const nextDocument = serializePageDocument({
        ...pageDocument,
        title: item.title,
        blocks: newBlocks,
      });
      setPageDocument(nextDocument);
      await savePageDocument(id, nextDocument);
    } catch (err) {
      setEnrichError(err.message);
    } finally {
      setEnriching(false);
    }
  }

  async function handleBlocksChange(newBlocks) {
    const nextDocument = serializePageDocument({
      ...(pageDocument || normalizePageDocument([], { pageId: id, pageType: 'item' })),
      title: item?.title || '',
      blocks: newBlocks,
    });
    setPageDocument(nextDocument);
    await savePageDocument(id, nextDocument).catch(console.error);
  }

  async function handleStatePersist(nextState) {
    const nextDocument = serializePageDocument({
      ...pageDocument,
      title: item?.title || '',
      stateMachine: {
        ...pageDocument.stateMachine,
        current: nextState,
      },
    });
    setPageDocument(nextDocument);
    await savePageDocument(id, nextDocument).catch(console.error);
  }

  async function handleStatusChange(e) {
    const newStatus = e.target.value;
    setItem(prev => ({ ...prev, status: newStatus }));
    await updateStatus(id, newStatus).catch(err => {
      setItem(prev => ({ ...prev, status: prev.status }));
      console.error('Status update failed:', err);
    });
  }

  if (itemLoading) return <div className="ip-loading">Loading…</div>;
  if (itemError)   return <div className="ip-error">Error: {itemError}</div>;
  if (!item)       return null;

  return (
    <div className="ip">
      {/* Back nav */}
      <div className="ip-nav">
        <Link to="/" className="ip-back">← Feed</Link>
      </div>

      {/* Header */}
      <header className="ip-header">
        <h1 className="ip-title">{item.title || 'Untitled'}</h1>

        <div className="ip-meta-row">
          {item.sourceName && <span className="ip-meta-item">{item.sourceName}</span>}
          {item.sourceName && (item.publishedAt || item.capturedAt) && (
            <span className="ip-meta-sep">·</span>
          )}
          {item.publishedAt && (
            <span className="ip-meta-item">Published {fmtDate(item.publishedAt)}</span>
          )}
          {item.publishedAt && item.capturedAt && (
            <span className="ip-meta-sep">·</span>
          )}
          {item.capturedAt && (
            <span className="ip-meta-item">Captured {fmtDate(item.capturedAt)}</span>
          )}
          {item.sourceType && (
            <span className="ip-source-type-badge">{item.sourceType}</span>
          )}
        </div>

        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ip-source-url"
          >
            {item.sourceUrl}
          </a>
        )}

        <div className="ip-tags-status-row">
          <div className="ip-tags">
            {item.tags.map(tag => (
              <span key={tag} className="ip-tag">{tag}</span>
            ))}
          </div>
          <select
            className="ip-status-select"
            value={item.status}
            onChange={handleStatusChange}
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {item.snippet && (
          <p className="ip-snippet">{item.snippet}</p>
        )}
      </header>

      {/* Divider */}
      <div className="ip-divider" />

      {/* Block canvas */}
      <section className="ip-canvas-section">
        {enriching && pageDocument?.blocks?.length === 0 && (
          <div className="ip-enriching">
            <span className="ip-spinner" />
            Enriching…
          </div>
        )}

        {pageDocument && (
          <PageRuntimeProvider
            document={pageDocument}
            pageId={id}
            onPersistState={handleStatePersist}
          >
            <BlockCanvas
              blocks={pageDocument.blocks}
              layout={pageDocument.layout}
              onBlocksChange={handleBlocksChange}
              parentContext={item.title}
              pageMeta={{ memoryScope: pageDocument.memory.scope }}
            />
          </PageRuntimeProvider>
        )}

        {enrichError && (
          <div className="ip-enrich-error">Enrichment failed: {enrichError}</div>
        )}
      </section>

      {/* Page-level bottom padding so content clears the fixed chat bar */}
      <div style={{ height: 48 }} />

      <PageChat
        blocks={pageDocument?.blocks ?? []}
        onBlocksChange={newBlocks => {
          setPageDocument(prev => serializePageDocument({
            ...(prev || normalizePageDocument([], { pageId: id, pageType: 'item' })),
            title: item?.title || '',
            blocks: newBlocks,
          }));
        }}
        saveBlocks={newBlocks => handleBlocksChange(newBlocks).catch(console.error)}
        pageContext={{
          title:      item.title,
          snippet:    item.snippet,
          tags:       item.tags,
          sourceName: item.sourceName,
        }}
      />
    </div>
  );
}
