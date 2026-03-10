import { useState, useEffect } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { fetchSubpageBlocks, saveSubpageBlocks, enrichContent } from '../api.js';
import BlockCanvas from '../components/BlockCanvas.jsx';
import PageChat from '../components/PageChat.jsx';
import './SubPage.css';

export default function SubPage() {
  const { blockId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  // Context is passed via navigation state
  const title = state?.title ?? 'Sub-page';
  const description = state?.description ?? '';
  const parentContext = state?.parentContext ?? '';

  const [blocks, setBlocks] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState(null);

  // Load persisted blocks for this subpage
  useEffect(() => {
    fetchSubpageBlocks(blockId)
      .then(setBlocks)
      .catch(() => setBlocks([]));
  }, [blockId]);


  async function runEnrich() {
    setEnriching(true);
    setEnrichError(null);
    try {
      const data = await enrichContent({
        mode: 'subpage',
        subpageTitle: title,
        subpageDescription: description,
        parentContext,
        existingBlocks: blocks ?? [],
      });
      const newBlocks = [...(blocks ?? []), ...data.blocks];
      setBlocks(newBlocks);
      await saveSubpageBlocks(blockId, newBlocks);
    } catch (err) {
      setEnrichError(err.message);
    } finally {
      setEnriching(false);
    }
  }

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
        {enriching && blocks?.length === 0 && (
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
          title:      title,
          snippet:    description,
          tags:       [],
          sourceName: parentContext,
        }}
      />
    </div>
  );
}
