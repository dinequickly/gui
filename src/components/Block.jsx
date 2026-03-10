import { useNavigate } from 'react-router-dom';
import './Block.css';

export default function Block({ block, onDelete, dragHandleProps, isDragging, parentContext }) {
  const navigate = useNavigate();

  function handleSubpageClick() {
    navigate(`/subpage/${block.id}`, {
      state: {
        title: block.title,
        description: block.description,
        parentContext,
      },
    });
  }

  return (
    <div className={`block block--${block.type}${isDragging ? ' block--dragging' : ''}`}>
      {/* Drag handle */}
      <div className="block__handle" title="Drag to reorder" {...dragHandleProps}>
        <DragIcon />
      </div>

      {/* Block content */}
      <div className="block__content">
        {block.type === 'citation' && <CitationBlock block={block} />}
        {block.type === 'iframe'   && <IframeBlock block={block} />}
        {block.type === 'subpage'  && <SubpageBlock block={block} onClick={handleSubpageClick} />}
        {block.type === 'text'     && <TextBlock block={block} />}
      </div>

      {/* Delete button */}
      <button
        className="block__delete"
        onClick={onDelete}
        title="Remove block"
        aria-label="Remove block"
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block type renderers
// ---------------------------------------------------------------------------

function CitationBlock({ block }) {
  return (
    <div className="citation">
      <div className="citation__icon">↗</div>
      <div className="citation__body">
        <a
          className="citation__title"
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {block.title}
        </a>
        {block.url && (
          <div className="citation__url">{safeHost(block.url)}</div>
        )}
        {block.relevance && (
          <p className="citation__relevance">{block.relevance}</p>
        )}
      </div>
    </div>
  );
}

function IframeBlock({ block }) {
  return (
    <div className="iframe-block">
      {block.title && <div className="iframe-block__title">{block.title}</div>}
      <div className="iframe-block__container">
        <iframe
          src={block.url}
          title={block.title || 'Embedded content'}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          loading="lazy"
        />
      </div>
      {block.caption && (
        <p className="iframe-block__caption">{block.caption}</p>
      )}
    </div>
  );
}

function SubpageBlock({ block, onClick }) {
  return (
    <button className="subpage-block" onClick={onClick}>
      <div className="subpage-block__body">
        <div className="subpage-block__title">{block.title}</div>
        {block.description && (
          <p className="subpage-block__description">{block.description}</p>
        )}
      </div>
      <div className="subpage-block__arrow">→</div>
    </button>
  );
}

function TextBlock({ block }) {
  return (
    <div className="text-block">
      {block.heading && <h3 className="text-block__heading">{block.heading}</h3>}
      {block.body    && <p  className="text-block__body">{block.body}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeHost(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function DragIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="2"  r="1.5" />
      <circle cx="8" cy="2"  r="1.5" />
      <circle cx="2" cy="8"  r="1.5" />
      <circle cx="8" cy="8"  r="1.5" />
      <circle cx="2" cy="14" r="1.5" />
      <circle cx="8" cy="14" r="1.5" />
    </svg>
  );
}
