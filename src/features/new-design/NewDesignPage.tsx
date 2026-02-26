import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './new-design.css';
import { Icon } from '../../shared/components/Icon';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { nanoid } from '../../shared/utils/nanoid';
import { useFileStore, getDatabase, getFileById, getPage, updateDatabase, updatePage, updatePageDocument } from '../../shared/store/fileStore';
import { useAuthStore } from '../../shared/store/authStore';
import type { Block, PageCitation } from '../../shared/types';
import { BlockEditor } from '../editor/BlockEditor';
import { PageChatBar } from './PageChatBar';
import type { PageAgentContext, PageAgentEdit } from './pageChatbot';
import { fetchUserDashboardKeys } from '../widget-dashboard/supabaseComponents';
import { labelFromDashboardKey, navItemsFromDashboardKeys, pathForTopNavLabel } from '../widget-dashboard/viewRoutes';
import { isWidgetPageFileId, WIDGET_PAGES_DB_ID } from '../../shared/constants/widgetContent';

function getCitationHostname(rawUrl?: string): string {
  const value = (rawUrl ?? '').trim();
  if (!value) return '';
  try {
    return new URL(value).hostname;
  } catch {
    try {
      return new URL(`https://${value}`).hostname;
    } catch {
      return '';
    }
  }
}

function getCitationLogoUrl(url?: string): string {
  const host = getCitationHostname(url);
  if (!host) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

function getNumberedListNumber(blocks: Block[], index: number): number {
  if (blocks[index]?.type !== 'numbered') return index + 1;
  let number = 1;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (blocks[i].type !== 'numbered') break;
    number += 1;
  }
  return number;
}

function resolveCitationReference(marker: string, citations: PageCitation[]): PageCitation | null {
  const needle = marker.trim().toLowerCase();
  if (!needle) return null;

  const byId = citations.find((citation) => citation.id.trim().toLowerCase() === needle);
  if (byId) return byId;

  const numMatch = needle.match(/^cite-(\d+)$/) ?? needle.match(/^(\d+)$/);
  if (numMatch) {
    const idx = Number(numMatch[1]) - 1;
    if (idx >= 0 && idx < citations.length) return citations[idx];
  }
  return null;
}

function citationNumber(citation: PageCitation, citations: PageCitation[]): number {
  const idx = citations.findIndex((item) => item.id === citation.id);
  return idx >= 0 ? idx + 1 : 0;
}

function extractCitationsFromText(text: string, citations: PageCitation[]): PageCitation[] {
  const pattern = /\[\^([^\]]+)\]/g;
  const found: PageCitation[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const marker = match[1] ?? '';
    const citation = resolveCitationReference(marker, citations);
    if (!citation || seen.has(citation.id)) continue;
    seen.add(citation.id);
    found.push(citation);
  }
  return found;
}

function renderInlineRichText(text: string, citations: PageCitation[]) {
  const lineParts = text.split('\n');
  const tokenPattern = /(\[\^[^\]]+\]|\*\*[^*]+\*\*|`[^`]+`|_[^_]+_|\*[^*]+\*)/g;
  const nodes: React.ReactNode[] = [];

  lineParts.forEach((line, lineIndex) => {
    if (lineIndex > 0) nodes.push(<br key={`br-${lineIndex}`} />);

    let cursor = 0;
    let tokenIndex = 0;
    for (const match of line.matchAll(tokenPattern)) {
      const start = match.index ?? 0;
      const full = match[0] ?? '';
      if (start > cursor) {
        nodes.push(<Fragment key={`txt-${lineIndex}-${tokenIndex}-plain`}>{line.slice(cursor, start)}</Fragment>);
      }

      if (full.startsWith('[^') && full.endsWith(']')) {
        const marker = full.slice(2, -1).trim();
        const citation = resolveCitationReference(marker, citations);
        if (citation) {
          nodes.push(
            <sup key={`txt-${lineIndex}-${tokenIndex}-cite`} className="inline-citation-chip">
              [{citationNumber(citation, citations)}]
            </sup>,
          );
        } else {
          nodes.push(<Fragment key={`txt-${lineIndex}-${tokenIndex}-missing`}>{full}</Fragment>);
        }
      } else if (full.startsWith('**') && full.endsWith('**')) {
        nodes.push(<strong key={`txt-${lineIndex}-${tokenIndex}-b`}>{full.slice(2, -2)}</strong>);
      } else if ((full.startsWith('_') && full.endsWith('_')) || (full.startsWith('*') && full.endsWith('*'))) {
        nodes.push(<em key={`txt-${lineIndex}-${tokenIndex}-i`}>{full.slice(1, -1)}</em>);
      } else if (full.startsWith('`') && full.endsWith('`')) {
        nodes.push(<code key={`txt-${lineIndex}-${tokenIndex}-c`}>{full.slice(1, -1)}</code>);
      } else {
        nodes.push(<Fragment key={`txt-${lineIndex}-${tokenIndex}-raw`}>{full}</Fragment>);
      }

      cursor = start + full.length;
      tokenIndex += 1;
    }

    if (cursor < line.length) {
      nodes.push(<Fragment key={`txt-${lineIndex}-tail`}>{line.slice(cursor)}</Fragment>);
    }
  });

  return nodes;
}

function textFromBlock(block: Block): string {
  switch (block.type) {
    case 'title':
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'paragraph':
    case 'bullet':
    case 'numbered':
    case 'quote':
    case 'todo':
    case 'callout':
      return block.text.trim();
    case 'toggle': {
      const childText = block.children.map(textFromBlock).filter(Boolean).join('\n');
      return [block.text.trim(), childText].filter(Boolean).join('\n');
    }
    case 'image':
      return block.caption?.trim() ?? '';
    case 'divider':
    case 'database_embed':
      return '';
    default:
      return '';
  }
}

function CitationSideNotes({
  citations,
  allCitations,
}: {
  citations: PageCitation[];
  allCitations: PageCitation[];
}) {
  if (citations.length === 0) return null;
  return (
    <div className="doc-citation-stack">
      {citations.map((citation) => (
        <a
          key={citation.id}
          className="doc-citation-note"
          href={citation.url || undefined}
          target={citation.url ? '_blank' : undefined}
          rel={citation.url ? 'noreferrer' : undefined}
        >
          <span className="doc-citation-num">[{citationNumber(citation, allCitations)}]</span>
          <span className="doc-citation-title">{citation.title || 'Citation'}</span>
        </a>
      ))}
    </div>
  );
}

function PageReadDocument({ blocks, citations }: { blocks: Block[]; citations: PageCitation[] }) {
  return (
    <div className="doc-layout">
      {blocks.map((block, index) => {
        const blockText = 'text' in block ? block.text : '';
        const refs = blockText ? extractCitationsFromText(blockText, citations) : [];
        const notes = <CitationSideNotes citations={refs} allCitations={citations} />;
        const showLeft = refs.length > 0 && index % 2 === 0;
        const showRight = refs.length > 0 && !showLeft;
        const numbered = getNumberedListNumber(blocks, index);

        return (
          <div key={block.id} className="doc-row">
            <aside className="doc-side doc-side-left">{showLeft ? notes : null}</aside>
            <div className="doc-main">
              {block.type === 'divider' ? (
                <hr style={{ border: 'none', borderTop: '1px solid #e2e2e0', margin: '12px 0' }} />
              ) : block.type === 'image' ? (
                <div style={{ margin: '12px 0' }}>
                  {block.url ? (
                    <img src={block.url} alt={block.caption ?? ''} style={{ maxWidth: '100%', borderRadius: 6, display: 'block' }} />
                  ) : null}
                  {block.caption ? <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{block.caption}</p> : null}
                </div>
              ) : block.type === 'todo' ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '2px 0', fontSize: 15 }}>
                  <span style={{ marginTop: 2 }}>{block.checked ? '☑' : '☐'}</span>
                  <span style={{ textDecoration: block.checked ? 'line-through' : 'none', color: block.checked ? '#aaa' : '#333', whiteSpace: 'pre-wrap' }}>
                    {renderInlineRichText(block.text, citations)}
                  </span>
                </div>
              ) : block.type === 'toggle' ? (
                <div style={{ fontSize: 15, margin: '2px 0' }}>
                  <span style={{ fontWeight: 500 }}>▶ {renderInlineRichText(block.text, citations)}</span>
                </div>
              ) : block.type === 'callout' ? (
                <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderRadius: 6, background: block.color ?? '#f5f5f5', margin: '4px 0', fontSize: 14 }}>
                  <span>{block.icon}</span><span style={{ whiteSpace: 'pre-wrap' }}>{renderInlineRichText(block.text, citations)}</span>
                </div>
              ) : block.type === 'bullet' ? (
                <div style={{ fontSize: 15, margin: '1px 0', paddingLeft: 16, whiteSpace: 'pre-wrap' }}>• {renderInlineRichText(block.text, citations)}</div>
              ) : block.type === 'numbered' ? (
                <div style={{ fontSize: 15, margin: '1px 0', paddingLeft: 8, whiteSpace: 'pre-wrap' }}>{numbered}. {renderInlineRichText(block.text, citations)}</div>
              ) : block.type === 'quote' ? (
                <div style={{ fontSize: 15, fontStyle: 'italic', color: '#555', borderLeft: '3px solid #ccc', paddingLeft: 12, margin: '6px 0', whiteSpace: 'pre-wrap' }}>
                  {renderInlineRichText(block.text, citations)}
                </div>
              ) : block.type === 'heading1' ? (
                <h1 style={{ fontSize: 28, fontWeight: 700, margin: '20px 0 4px', color: '#1a1a1a', whiteSpace: 'pre-wrap' }}>{renderInlineRichText(block.text, citations)}</h1>
              ) : block.type === 'heading2' ? (
                <h2 style={{ fontSize: 20, fontWeight: 600, margin: '16px 0 4px', color: '#1a1a1a', whiteSpace: 'pre-wrap' }}>{renderInlineRichText(block.text, citations)}</h2>
              ) : block.type === 'heading3' ? (
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: '12px 0 2px', color: '#333', whiteSpace: 'pre-wrap' }}>{renderInlineRichText(block.text, citations)}</h3>
              ) : 'text' in block ? (
                <p style={{ fontSize: 15, margin: '2px 0', color: '#333', whiteSpace: 'pre-wrap' }}>{renderInlineRichText(block.text, citations)}</p>
              ) : block.type === 'database_embed' ? (
                <div style={{ padding: 8, background: '#f5f5f3', borderRadius: 6, fontSize: 13, color: '#666', margin: '4px 0' }}>
                  Embedded database ({block.databaseFileId || 'no file linked'})
                </div>
              ) : null}
            </div>
            <aside className="doc-side doc-side-right">{showRight ? notes : null}</aside>
          </div>
        );
      })}
    </div>
  );
}

export function NewDesignPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const fileId = searchParams.get('fileId');
  const dashboardKey = searchParams.get('dashboardKey') ?? 'dashboard-2';
  const activeTopNavLabel = labelFromDashboardKey(dashboardKey);
  const [topNavItems, setTopNavItems] = useState<string[]>(['Overview']);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [citations, setCitations] = useState<PageCitation[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [authorValue, setAuthorValue] = useState('');
  const blockSaveTimerRef = useRef<number | null>(null);
  const citationSaveTimerRef = useRef<number | null>(null);
  const fileMetaSaveTimerRef = useRef<number | null>(null);
  const updateFileMeta = useFileStore((state) => state.updateFile);
  const chartData = [20, 35, 25, 45, 60, 40, 55, 30, 45, 50, 40, 55, 45, 65, 50, 60];
  const maxValue = Math.max(...chartData);
  const chartWidth = 900;
  const chartHeight = 200;

  const syncWidgetPageRecord = useCallback(async (nextTitle: string, nextAuthor: string, nextBlocks: Block[]) => {
    if (!fileId || !isWidgetPageFileId(fileId)) return;
    const recordId = fileId.replace('widget-page-', '');
    if (!recordId) return;

    const dbDoc = await getDatabase(WIDGET_PAGES_DB_ID);
    if (!dbDoc) return;
    const titleField = dbDoc.schema.find((field) => field.name === 'Title')?.id;
    const subtitleField = dbDoc.schema.find((field) => field.name === 'Subtitle')?.id;
    const bodyField = dbDoc.schema.find((field) => field.name === 'Body')?.id;
    const authorField = dbDoc.schema.find((field) => field.name === 'Author')?.id;
    if (!titleField || !bodyField || !authorField) return;

    const recordIndex = dbDoc.records.findIndex((record) => record.id === recordId);
    if (recordIndex < 0) return;
    const existing = dbDoc.records[recordIndex];

    const textLines = nextBlocks
      .map(textFromBlock)
      .map((text) => text.trim())
      .filter(Boolean);
    const subtitleCandidate = textLines[1] ?? '';
    const body = textLines.join('\n\n').trim();

    const nextRecord = {
      ...existing,
      fields: {
        ...existing.fields,
        [titleField]: nextTitle.trim() || 'Untitled article',
        [bodyField]: body,
        [authorField]: nextAuthor.trim() || 'Unknown author',
        ...(subtitleField ? { [subtitleField]: subtitleCandidate } : {}),
      },
    };
    const nextRecords = [...dbDoc.records];
    nextRecords[recordIndex] = nextRecord;
    await updateDatabase(WIDGET_PAGES_DB_ID, { records: nextRecords });
  }, [fileId]);

  useEffect(() => {
    let cancelled = false;
    async function loadArticle() {
      if (!fileId) {
        setBlocks(null);
        return;
      }
      const [fileRec, pageDoc] = await Promise.all([
        getFileById(fileId),
        getPage(fileId),
      ]);
      if (cancelled) return;
      setTitleValue(fileRec?.title ?? '');
      setAuthorValue(fileRec?.author ?? '');
      setBlocks(pageDoc?.blocks ?? []);
      setCitations(pageDoc?.citations ?? []);
    }
    void loadArticle();
    return () => { cancelled = true; };
  }, [fileId]);

  useEffect(() => {
    return () => {
      if (blockSaveTimerRef.current !== null) {
        window.clearTimeout(blockSaveTimerRef.current);
      }
      if (citationSaveTimerRef.current !== null) {
        window.clearTimeout(citationSaveTimerRef.current);
      }
      if (fileMetaSaveTimerRef.current !== null) {
        window.clearTimeout(fileMetaSaveTimerRef.current);
      }
    };
  }, []);

  const scheduleFileMetaSave = useCallback((nextTitle: string, nextAuthor: string) => {
    if (!fileId) return;
    const normalizedTitle = nextTitle.trim() || 'Untitled article';
    const normalizedAuthor = nextAuthor.trim() || 'Unknown author';

    if (fileMetaSaveTimerRef.current !== null) {
      window.clearTimeout(fileMetaSaveTimerRef.current);
    }
    fileMetaSaveTimerRef.current = window.setTimeout(() => {
      fileMetaSaveTimerRef.current = null;
      void Promise.all([
        updateFileMeta(fileId, { title: normalizedTitle, author: normalizedAuthor }),
        syncWidgetPageRecord(normalizedTitle, normalizedAuthor, blocks ?? []),
      ]);
    }, 150);
  }, [blocks, fileId, syncWidgetPageRecord, updateFileMeta]);

  const handleBlocksChange = useCallback((nextBlocks: Block[]) => {
    if (!fileId) return;
    setBlocks(nextBlocks);
    if (blockSaveTimerRef.current !== null) {
      window.clearTimeout(blockSaveTimerRef.current);
    }
    blockSaveTimerRef.current = window.setTimeout(() => {
      blockSaveTimerRef.current = null;
      void Promise.all([
        updatePage(fileId, nextBlocks),
        syncWidgetPageRecord(titleValue, authorValue, nextBlocks),
      ]);
    }, 150);
  }, [authorValue, fileId, syncWidgetPageRecord, titleValue]);

  const handleCitationsChange = useCallback((nextCitations: PageCitation[]) => {
    if (!fileId) return;
    setCitations(nextCitations);
    if (citationSaveTimerRef.current !== null) {
      window.clearTimeout(citationSaveTimerRef.current);
    }
    citationSaveTimerRef.current = window.setTimeout(() => {
      citationSaveTimerRef.current = null;
      void updatePageDocument(fileId, { citations: nextCitations });
    }, 150);
  }, [fileId]);

  const flushPendingSaves = useCallback(() => {
    if (!fileId) return;
    if (blockSaveTimerRef.current !== null) {
      window.clearTimeout(blockSaveTimerRef.current);
      blockSaveTimerRef.current = null;
    }
    if (citationSaveTimerRef.current !== null) {
      window.clearTimeout(citationSaveTimerRef.current);
      citationSaveTimerRef.current = null;
    }
    if (fileMetaSaveTimerRef.current !== null) {
      window.clearTimeout(fileMetaSaveTimerRef.current);
      fileMetaSaveTimerRef.current = null;
    }
    void updatePageDocument(fileId, { blocks: blocks ?? [], citations });
    void updateFileMeta(fileId, {
      title: titleValue.trim() || 'Untitled article',
      author: authorValue.trim() || 'Unknown author',
    });
    void syncWidgetPageRecord(
      titleValue.trim() || 'Untitled article',
      authorValue.trim() || 'Unknown author',
      blocks ?? [],
    );
  }, [fileId, blocks, citations, titleValue, authorValue, updateFileMeta, syncWidgetPageRecord]);

  const showBtcChart = useMemo(() => {
    return (blocks ?? []).some((block) => ('text' in block) && /(?:\bbtc\b|\bbitcoin\b)/i.test(block.text));
  }, [blocks]);

  const visibleCitations = useMemo(() => {
    return citations.filter((citation) =>
      citation.title.trim() || citation.source.trim() || (citation.url ?? '').trim(),
    );
  }, [citations]);

  const pageAgentContext = useMemo<PageAgentContext>(() => ({
    fileId: fileId ?? '',
    title: titleValue.trim() || 'Untitled article',
    author: authorValue.trim() || 'Unknown author',
    blocks: blocks ?? [],
    citations,
  }), [fileId, titleValue, authorValue, blocks, citations]);

  const applyAgentEdit = useCallback(async (edit: PageAgentEdit) => {
    if (!fileId) return;

    if (blockSaveTimerRef.current !== null) {
      window.clearTimeout(blockSaveTimerRef.current);
      blockSaveTimerRef.current = null;
    }
    if (citationSaveTimerRef.current !== null) {
      window.clearTimeout(citationSaveTimerRef.current);
      citationSaveTimerRef.current = null;
    }
    if (fileMetaSaveTimerRef.current !== null) {
      window.clearTimeout(fileMetaSaveTimerRef.current);
      fileMetaSaveTimerRef.current = null;
    }

    const nextTitle = (edit.title ?? titleValue).trim() || 'Untitled article';
    const nextAuthor = (edit.author ?? authorValue).trim() || 'Unknown author';
    const nextBlocks = edit.blocks ?? blocks ?? [{ id: `fallback-${Date.now()}`, type: 'paragraph', text: '' }];
    const nextCitations = edit.citations ?? citations;

    setTitleValue(nextTitle);
    setAuthorValue(nextAuthor);
    setBlocks(nextBlocks);
    setCitations(nextCitations);

    await Promise.all([
      updateFileMeta(fileId, { title: nextTitle, author: nextAuthor }),
      updatePageDocument(fileId, { blocks: nextBlocks, citations: nextCitations }),
      syncWidgetPageRecord(nextTitle, nextAuthor, nextBlocks),
    ]);
  }, [fileId, titleValue, authorValue, blocks, citations, updateFileMeta, syncWidgetPageRecord]);

  const addCitation = useCallback(() => {
    handleCitationsChange([
      ...citations,
      {
        id: nanoid(),
        source: 'Source',
        title: 'Title',
        url: '',
      },
    ]);
  }, [citations, handleCitationsChange]);

  const updateCitation = useCallback((id: string, patch: Partial<PageCitation>) => {
    handleCitationsChange(
      citations.map((citation) => (citation.id === id ? { ...citation, ...patch } : citation)),
    );
  }, [citations, handleCitationsChange]);

  const removeCitation = useCallback((id: string) => {
    handleCitationsChange(citations.filter((citation) => citation.id !== id));
  }, [citations, handleCitationsChange]);

  const points = chartData.map((val, i) => {
    const x = (i * chartWidth) / (chartData.length - 1);
    const y = chartHeight - (val / maxValue) * (chartHeight - 40) - 20;
    return `${x},${y}`;
  }).join(' ');
  
  const areaPoints = `0,${chartHeight} ${points} ${chartWidth},${chartHeight}`;

  useEffect(() => {
    let cancelled = false;
    async function loadTopNavItems() {
      if (!user?.id) {
        setTopNavItems(['Overview']);
        return;
      }
      try {
        const keys = await fetchUserDashboardKeys(user.id);
        if (cancelled) return;
        const withActive = keys.includes(dashboardKey) ? keys : [...keys, dashboardKey];
        setTopNavItems(navItemsFromDashboardKeys(withActive));
      } catch {
        if (!cancelled) setTopNavItems(['Overview']);
      }
    }
    void loadTopNavItems();
    return () => { cancelled = true; };
  }, [dashboardKey, user?.id]);

  return (
    <div className="new-design-root">
      <div className="new-design-nav-container">
        <nav className="new-design-nav">
          {topNavItems.map((label) => (
            <button
              key={label}
              className={label === activeTopNavLabel ? 'active' : ''}
              onClick={() => navigate(pathForTopNavLabel(label))}
            >
              {label}
            </button>
          ))}
          <button className="search-btn"><Icon name="search" size={18} /></button>
        </nav>
      </div>

      <div className="new-design-side-btns">
        <div className="side-btn-group">
          <div className="side-btn">
            <Icon name="board" size={20} />
          </div>
        </div>
        <div className="side-btn-group">
          <button
            type="button"
            className={`side-btn ${isEditMode ? 'active' : ''}`}
            onClick={() => {
              setIsEditMode((prev) => {
                if (prev) flushPendingSaves();
                return !prev;
              });
            }}
            title={isEditMode ? 'Switch to view mode' : 'Switch to edit mode'}
            aria-label={isEditMode ? 'Switch to view mode' : 'Switch to edit mode'}
          >
            <Icon name="file" size={20} />
          </button>
          <div className="side-btn">
            <Icon name="plus" size={20} />
          </div>
        </div>
      </div>

      <main className="new-design-content-surface">
        {isEditMode ? (
          <input
            type="text"
            value={titleValue}
            onChange={(event) => {
              const next = event.target.value;
              setTitleValue(next);
              scheduleFileMetaSave(next, authorValue);
            }}
            placeholder="Untitled article"
            style={{
              fontSize: 80,
              fontWeight: 800,
              margin: '0 0 40px 0',
              letterSpacing: '-2px',
              color: '#1a1a1a',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              width: '100%',
              lineHeight: 1.05,
            }}
          />
        ) : (
          <h1>{titleValue || 'Untitled article'}</h1>
        )}

        <div className="author">
          By{' '}
          {isEditMode ? (
            <input
              type="text"
              value={authorValue}
              onChange={(event) => {
                const next = event.target.value;
                setAuthorValue(next);
                scheduleFileMetaSave(titleValue, next);
              }}
              placeholder="Unknown author"
              style={{
                fontSize: 'inherit',
                fontWeight: 'inherit',
                color: 'inherit',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                borderBottom: '1px dashed rgba(0, 0, 0, 0.2)',
                minWidth: 180,
              }}
            />
          ) : (
            authorValue || 'Unknown author'
          )}
        </div>
        {isEditMode ? (
          <BlockEditor blocks={blocks ?? []} onChange={handleBlocksChange} readOnly={false} />
        ) : (
          <PageReadDocument blocks={blocks ?? []} citations={citations} />
        )}

        {showBtcChart ? (
          <div className="chart-glass-card">
            <div className="chart-header">
              <h3>BTC</h3>
              <div className="chart-value">
                54,532 <span>4%</span>
              </div>
            </div>
            <div className="chart-svg-container">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(76, 175, 80, 0.4)" />
                    <stop offset="100%" stopColor="rgba(76, 175, 80, 0)" />
                  </linearGradient>
                </defs>
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                  <line
                    key={i}
                    x1="0" y1={p * chartHeight}
                    x2={chartWidth} y2={p * chartHeight}
                    className="chart-grid-line"
                  />
                ))}
                <polygon points={areaPoints} fill="url(#chart-fill)" />
                <polyline
                  points={points}
                  fill="none"
                  stroke="#4caf50"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray="0"
                />
              </svg>
            </div>
          </div>
        ) : null}
      </main>

      <section className="new-design-glass-section">
        <div className="glass-grid-detached">
          {(isEditMode ? citations : visibleCitations).map((citation) => (
            <div key={citation.id} className="glass-card citation-card">
              <div className="glass-card-info">
                {isEditMode ? (
                  <>
                    <input
                      type="text"
                      value={citation.source}
                      onChange={(event) => updateCitation(citation.id, { source: event.target.value })}
                      placeholder="Source"
                      style={{
                        fontSize: 20,
                        color: 'rgba(0, 0, 0, 0.45)',
                        marginBottom: 4,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        width: '100%',
                      }}
                    />
                    <input
                      type="text"
                      value={citation.title}
                      onChange={(event) => updateCitation(citation.id, { title: event.target.value })}
                      placeholder="Citation title"
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: 10,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        width: '100%',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <input
                      type="text"
                      value={citation.url ?? ''}
                      onChange={(event) => updateCitation(citation.id, { url: event.target.value })}
                      placeholder="https://source-url.com"
                      style={{
                        fontSize: 12,
                        color: 'rgba(255, 255, 255, 0.92)',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        width: '100%',
                        marginBottom: 10,
                      }}
                    />
                    <button
                      type="button"
                      className="glass-cta"
                      onClick={() => removeCitation(citation.id)}
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      <Icon name="trash" size={14} /> Remove citation
                    </button>
                  </>
                ) : (
                  <>
                    <div className="subtitle">{citation.source || 'Source'}</div>
                    <div className="title">{citation.title || 'Citation'}</div>
                    {citation.url ? (
                      <a href={citation.url} target="_blank" rel="noreferrer" className="glass-cta">
                        <Icon name="plus" size={14} /> Open Link
                      </a>
                    ) : (
                      <div className="glass-cta" style={{ opacity: 0.72 }}>
                        <Icon name="plus" size={14} /> Open Link
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="glass-card-img citation-logo-wrap">
                {getCitationLogoUrl(citation.url) ? (
                  <img
                    src={getCitationLogoUrl(citation.url)}
                    alt={citation.source || citation.title || 'Citation source logo'}
                    className="citation-logo-image"
                  />
                ) : (
                  <span style={{ fontSize: 24, color: 'rgba(0,0,0,0.5)', fontWeight: 700 }}>•</span>
                )}
              </div>
            </div>
          ))}

          {isEditMode ? (
            <button
              type="button"
              className="wide-glass-pill"
              onClick={addCitation}
              style={{ cursor: 'pointer', border: '1px dashed rgba(255, 255, 255, 0.7)', color: '#fff', fontWeight: 600 }}
            >
              + Add citation
            </button>
          ) : null}
        </div>
      </section>

      <PageChatBar pageContext={pageAgentContext} onApplyEdit={applyAgentEdit} />
    </div>
  );
}
