import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { fetchSubpageBlocks, saveSubpageBlocks, enrichContent, fetchSubpageStatus } from '../api.js';
import BlockCanvas from '../components/BlockCanvas.jsx';
import PageChat from '../components/PageChat.jsx';
import './SubPage.css';

export default function SubPage() {
  const { blockId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const title = state?.title ?? 'Sub-page';
  const description = state?.description ?? '';
  const parentContext = state?.parentContext ?? '';

  const [blocks, setBlocks] = useState(null);
  const [autoStatus, setAutoStatus] = useState(null); // 'pending' | 'done' | 'error' | 'idle'
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState(null);
  const pollRef = useRef(null);

  // Load persisted blocks
  useEffect(() => {
    fetchSubpageBlocks(blockId)
      .then(setBlocks)
      .catch(() => setBlocks([]));
  }, [blockId]);

  // Poll status when blocks are empty (background enrichment may be running)
  useEffect(() => {
    if (blocks === null || blocks.length > 0) {
      clearTimeout(pollRef.current);
      return;
    }

    async function check() {
      const { status } = await fetchSubpageStatus(blockId).catch(() => ({ status: 'idle' }));
      setAutoStatus(status);

      if (status === 'done') {
        // Blocks were written — reload them
        const fresh = await fetchSubpageBlocks(blockId).catch(() => []);
        if (fresh.length > 0) { setBlocks(fresh); return; }
      }

      if (status === 'pending') {
        pollRef.current = setTimeout(check, 2000);
      }
    }

    check();
    return () => clearTimeout(pollRef.current);
  }, [blockId, blocks]);

  async function handleBlocksChange(newBlocks) {
    setBlocks(newBlocks);
    await saveSubpageBlocks(blockId, newBlocks).catch(console.error);
  }

  return (
    <div className="sp">
      <div className="sp-nav">
        <button className="sp-back" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="sp-badge">Deep Dive</div>

      <header className="sp-header">
        <h1 className="sp-title">{title}</h1>
        {description && <p className="sp-description">{description}</p>}
        {parentContext && (
          <div className="sp-context">From: {parentContext}</div>
        )}
      </header>

      <div className="sp-divider" />

      <section className="sp-canvas-section">
        {blocks !== null && blocks.length === 0 && (
          <div className="sp-empty">
            {autoStatus === 'pending' && (
              <div className="sp-generating">
                <span className="sp-spinner" />
                Generating content… this may take 15–30 seconds
              </div>
            )}
            {autoStatus === 'error' && (
              <div className="sp-gen-error">
                Auto-generation failed. Use the chat below to enrich this page.
              </div>
            )}
            {(autoStatus === 'idle' || autoStatus === null) && (
              <div className="sp-hint">No content yet — ask the chat to enrich this page.</div>
            )}
          </div>
        )}

        {enriching && (
          <div className="sp-enriching">
            <span className="sp-spinner" />
            Enriching…
          </div>
        )}

        {blocks !== null && blocks.length > 0 && (
          <BlockCanvas
            blocks={blocks}
            onBlocksChange={handleBlocksChange}
            parentContext={`${title} — ${parentContext}`}
          />
        )}

        {enrichError && (
          <div className="sp-enrich-error">Enrichment failed: {enrichError}</div>
        )}
      </section>

      <div style={{ height: 48 }} />

      <PageChat
        blocks={blocks ?? []}
        onBlocksChange={setBlocks}
        saveBlocks={newBlocks => saveSubpageBlocks(blockId, newBlocks).catch(console.error)}
        pageContext={{
          title,
          snippet:    description,
          tags:       [],
          sourceName: parentContext,
        }}
      />
    </div>
  );
}
