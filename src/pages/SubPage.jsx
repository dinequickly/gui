import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { fetchSubpageDocument, saveSubpageDocument, fetchSubpageStatus } from '../api.js';
import BlockCanvas from '../components/BlockCanvas.jsx';
import PageChat from '../components/PageChat.jsx';
import { normalizePageDocument, serializePageDocument } from '../lib/pageDocument.js';
import { PageRuntimeProvider } from '../runtime/PageRuntime.jsx';
import './SubPage.css';

export default function SubPage() {
  const { blockId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const title = state?.title ?? 'Sub-page';
  const description = state?.description ?? '';
  const parentContext = state?.parentContext ?? '';
  const inheritedMemoryScope = state?.memoryScope ?? `page:${blockId}`;

  const [pageDocument, setPageDocument] = useState(null);
  const [autoStatus, setAutoStatus] = useState(null); // 'pending' | 'done' | 'error' | 'idle'
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState(null);
  const pollRef = useRef(null);

  // Load persisted blocks
  useEffect(() => {
    fetchSubpageDocument(blockId)
      .then(data => setPageDocument(normalizePageDocument({
        ...data,
        title,
        memory: resolveMemoryScope(data?.memory, inheritedMemoryScope, blockId),
      }, { pageId: blockId, pageType: 'subpage' })))
      .catch(() => setPageDocument(normalizePageDocument({
        title,
        memory: { scope: inheritedMemoryScope },
        blocks: [],
      }, { pageId: blockId, pageType: 'subpage' })));
  }, [blockId, inheritedMemoryScope, title]);

  // Poll status when blocks are empty (background enrichment may be running)
  useEffect(() => {
    if (pageDocument === null || pageDocument.blocks.length > 0) {
      clearTimeout(pollRef.current);
      return;
    }

    async function check() {
      const { status } = await fetchSubpageStatus(blockId).catch(() => ({ status: 'idle' }));
      setAutoStatus(status);

      if (status === 'done') {
        // Blocks were written — reload them
        const fresh = await fetchSubpageDocument(blockId).catch(() => ({ blocks: [] }));
        if ((fresh.blocks || []).length > 0) {
          setPageDocument(normalizePageDocument({
            ...fresh,
            title,
            memory: resolveMemoryScope(fresh?.memory, inheritedMemoryScope, blockId),
          }, { pageId: blockId, pageType: 'subpage' }));
          return;
        }
      }

      if (status === 'pending') {
        pollRef.current = setTimeout(check, 2000);
      }
    }

    check();
    return () => clearTimeout(pollRef.current);
  }, [blockId, inheritedMemoryScope, pageDocument, title]);

  async function handleBlocksChange(newBlocks) {
    const nextDocument = serializePageDocument({
      ...(pageDocument || normalizePageDocument([], { pageId: blockId, pageType: 'subpage' })),
      title,
      memory: pageDocument?.memory || { scope: inheritedMemoryScope },
      blocks: newBlocks,
    });
    setPageDocument(nextDocument);
    await saveSubpageDocument(blockId, nextDocument).catch(console.error);
  }

  async function handleStatePersist(nextState) {
    const nextDocument = serializePageDocument({
      ...pageDocument,
      title,
      memory: pageDocument?.memory || { scope: inheritedMemoryScope },
      stateMachine: {
        ...pageDocument.stateMachine,
        current: nextState,
      },
    });
    setPageDocument(nextDocument);
    await saveSubpageDocument(blockId, nextDocument).catch(console.error);
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
        {pageDocument !== null && pageDocument.blocks.length === 0 && (
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

        {pageDocument && (
          <PageRuntimeProvider
            document={pageDocument}
            pageId={blockId}
            onPersistState={handleStatePersist}
          >
            <BlockCanvas
              blocks={pageDocument.blocks}
              layout={pageDocument.layout}
              onBlocksChange={handleBlocksChange}
              parentContext={`${title} — ${parentContext}`}
              pageMeta={{ memoryScope: pageDocument.memory.scope }}
            />
          </PageRuntimeProvider>
        )}

        {enrichError && (
          <div className="sp-enrich-error">Enrichment failed: {enrichError}</div>
        )}
      </section>

      <div style={{ height: 48 }} />

      <PageChat
        blocks={pageDocument?.blocks ?? []}
        onBlocksChange={newBlocks => {
          setPageDocument(prev => serializePageDocument({
            ...(prev || normalizePageDocument([], { pageId: blockId, pageType: 'subpage' })),
            title,
            memory: prev?.memory || { scope: inheritedMemoryScope },
            blocks: newBlocks,
          }));
        }}
        saveBlocks={newBlocks => handleBlocksChange(newBlocks).catch(console.error)}
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

function resolveMemoryScope(memory, inheritedMemoryScope, blockId) {
  const defaultScope = `page:${blockId}`;
  if (!memory?.scope) {
    return { scope: inheritedMemoryScope };
  }
  if (memory.scope === defaultScope && inheritedMemoryScope !== defaultScope) {
    return { scope: inheritedMemoryScope };
  }
  return memory;
}
