import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BlockChat from './BlockChat.jsx';
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
      <div className="block__handle" title="Drag to reorder" {...dragHandleProps}>
        <DragIcon />
      </div>

      <div className="block__content">
        {block.type === 'citation' && <CitationBlock block={block} />}
        {block.type === 'iframe'   && <IframeBlock block={block} />}
        {block.type === 'subpage'  && <SubpageBlock block={block} onClick={handleSubpageClick} />}
        {block.type === 'text'     && <TextBlock block={block} />}
        {block.type === 'quiz'     && <QuizBlock block={block} />}
        {block.type === 'desmos'   && <DesmosBlock block={block} />}
        {block.type === 'chatbot'  && <BlockChat block={block} />}
        
        {block.type === 'heading_1' && <h1 className="h1-block">{block.text}</h1>}
        {block.type === 'heading_2' && <h2 className="h2-block">{block.text}</h2>}
        {block.type === 'heading_3' && <h3 className="h3-block">{block.text}</h3>}
        {block.type === 'bulleted_list' && <ListBlock block={block} bulleted />}
        {block.type === 'numbered_list' && <ListBlock block={block} />}
        {block.type === 'todo_list'     && <TodoListBlock block={block} />}
        {block.type === 'toggle_list'   && <ToggleBlock block={block} />}
        {block.type === 'callout'       && <CalloutBlock block={block} />}
        {block.type === 'code'          && <CodeBlock block={block} />}
      </div>

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
        {block.auto_prompt && (
          <div className="subpage-block__pending">Content generating in background…</div>
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

function QuizBlock({ block }) {
  const [answers, setAnswers] = useState({});

  return (
    <div className="quiz-block">
      {block.heading && <h3 className="quiz-block__heading">{block.heading}</h3>}
      {(block.questions ?? []).map((q, qi) => {
        const selected = answers[qi];
        const revealed = selected !== undefined;
        return (
          <div key={qi} className="quiz-question">
            <p className="quiz-question__q">{q.q}</p>
            <div className="quiz-question__options">
              {(q.options ?? []).map((opt, oi) => {
                const isSelected = selected === oi;
                const isCorrect  = oi === q.answer;
                let cls = 'quiz-option';
                if (revealed && isCorrect)             cls += ' quiz-option--correct';
                if (revealed && isSelected && !isCorrect) cls += ' quiz-option--wrong';
                if (!revealed && isSelected)           cls += ' quiz-option--selected';
                return (
                  <button
                    key={oi}
                    className={cls}
                    onClick={() => !revealed && setAnswers(a => ({ ...a, [qi]: oi }))}
                    disabled={revealed}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {revealed && q.explanation && (
              <p className="quiz-question__explanation">{q.explanation}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DesmosBlock({ block }) {
  const src = block.graphUrl || 'https://www.desmos.com/calculator';
  return (
    <div className="desmos-block">
      {block.title && <div className="desmos-block__title">{block.title}</div>}
      <div className="desmos-block__container">
        <iframe
          src={src}
          title={block.title || 'Desmos Calculator'}
          allowFullScreen
          loading="lazy"
        />
      </div>
      {block.caption && (
        <p className="desmos-block__caption">{block.caption}</p>
      )}
    </div>
  );
}

function ListBlock({ block, bulleted }) {
  const Tag = bulleted ? 'ul' : 'ol';
  return (
    <Tag className="list-block">
      {(block.items ?? []).map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  );
}

function TodoListBlock({ block }) {
  return (
    <div className="todo-list">
      {(block.items ?? []).map((item, i) => (
        <div key={i} className="todo-item">
          <input type="checkbox" checked={item.checked} readOnly />
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}

function ToggleBlock({ block }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="toggle-block">
      <button className="toggle-block__header" onClick={() => setIsOpen(!isOpen)}>
        <span className={`toggle-block__arrow ${isOpen ? 'open' : ''}`}>▶</span>
        <span className="toggle-block__title">{block.title}</span>
      </button>
      {isOpen && (
        <div className="toggle-block__content">
          {block.body}
        </div>
      )}
    </div>
  );
}

function CalloutBlock({ block }) {
  return (
    <div className="callout-block">
      <span className="callout-block__icon">{block.icon || '💡'}</span>
      <div className="callout-block__text">{block.text}</div>
    </div>
  );
}

function CodeBlock({ block }) {
  return (
    <div className="code-block">
      <div className="code-block__header">
        <span>{block.language || 'code'}</span>
      </div>
      <pre>
        <code>{block.code}</code>
      </pre>
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
