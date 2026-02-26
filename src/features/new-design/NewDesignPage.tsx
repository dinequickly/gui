import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './new-design.css';
import { Icon } from '../../shared/components/Icon';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPage, updatePage } from '../../shared/store/fileStore';
import { db } from '../../shared/store/db';
import type { Block, WorkspaceFile } from '../../shared/types';
import { BlockEditor } from '../editor/BlockEditor';

export function NewDesignPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get('fileId');
  const [file, setFile] = useState<WorkspaceFile | null>(null);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const chartData = [20, 35, 25, 45, 60, 40, 55, 30, 45, 50, 40, 55, 45, 65, 50, 60];
  const maxValue = Math.max(...chartData);
  const chartWidth = 900;
  const chartHeight = 200;

  useEffect(() => {
    let cancelled = false;
    async function loadArticle() {
      if (!fileId) {
        setFile(null);
        setBlocks(null);
        return;
      }
      const [fileRec, pageDoc] = await Promise.all([
        db.files.get(fileId),
        getPage(fileId),
      ]);
      if (cancelled) return;
      setFile(fileRec ?? null);
      setBlocks(pageDoc?.blocks ?? []);
    }
    void loadArticle();
    return () => { cancelled = true; };
  }, [fileId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleBlocksChange = useCallback((nextBlocks: Block[]) => {
    if (!fileId) return;
    setBlocks(nextBlocks);
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void updatePage(fileId, nextBlocks);
    }, 150);
  }, [fileId]);

  useEffect(() => {
    if (isEditMode) return;
    if (!fileId || !blocks) return;
    void updatePage(fileId, blocks);
  }, [isEditMode, fileId, blocks]);

  const showBtcChart = useMemo(() => {
    return (blocks ?? []).some((block) => ('text' in block) && /(?:\bbtc\b|\bbitcoin\b)/i.test(block.text));
  }, [blocks]);

  const points = chartData.map((val, i) => {
    const x = (i * chartWidth) / (chartData.length - 1);
    const y = chartHeight - (val / maxValue) * (chartHeight - 40) - 20;
    return `${x},${y}`;
  }).join(' ');
  
  const areaPoints = `0,${chartHeight} ${points} ${chartWidth},${chartHeight}`;

  return (
    <div className="new-design-root">
      <div className="new-design-nav-container">
        <nav className="new-design-nav">
          <button className="active" onClick={() => navigate('/widgets')}>Overview</button>
          <button>Data Focus</button>
          <button>TLDR</button>
          <button>Deep Dive</button>
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
            onClick={() => setIsEditMode((prev) => !prev)}
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
        <h1>{file?.title || 'Untitled article'}</h1>
        <div className="author">By {file?.author || 'Unknown author'}</div>
        <BlockEditor blocks={blocks ?? []} onChange={handleBlocksChange} readOnly={!isEditMode} />

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
          <div className="glass-card">
            <div className="glass-card-info">
              <div className="subtitle">Subtitle</div>
              <div className="title">Title</div>
              <a href="#" className="glass-cta">
                <Icon name="plus" size={14} /> Call to action
              </a>
            </div>
            <div className="glass-card-img"></div>
          </div>

          <div className="glass-card">
            <div className="glass-card-info">
              <div className="subtitle">Subtitle</div>
              <div className="title">Title</div>
              <a href="#" className="glass-cta">
                <Icon name="plus" size={14} /> Call to action
              </a>
            </div>
            <div className="glass-card-img"></div>
          </div>

          <div className="wide-glass-pill"></div>
        </div>
      </section>
    </div>
  );
}
