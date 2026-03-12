import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BlockChat from './BlockChat.jsx';
import './Block.css';
import { isKnownBlockType, validateBlock } from '../lib/blockSchema.js';
import { segmentTextWithMemory } from '../lib/textMemory.js';
import { runAgentBlock } from '../api.js';
import { usePageRuntime } from '../runtime/PageRuntime.jsx';

export default function Block({ block, onDelete, dragHandleProps, isDragging, parentContext, pageMeta }) {
  const navigate = useNavigate();
  const {
    resolveBindingsForBlock,
    addToMemory,
    memoryEntries,
    setBlockOutput,
  } = usePageRuntime();

  const { block: resolvedBlock, bindingErrors } = resolveBindingsForBlock(block);
  const validationErrors = validateBlock(resolvedBlock);
  const knownType = isKnownBlockType(resolvedBlock.type);

  function handleSubpageClick() {
    navigate(`/subpage/${resolvedBlock.id}`, {
      state: {
        title: resolvedBlock.title,
        description: resolvedBlock.description,
        parentContext,
        memoryScope: pageMeta?.memoryScope,
      },
    });
  }

  return (
    <BlockErrorBoundary block={resolvedBlock}>
      <BlockMemorySync block={resolvedBlock} addToMemory={addToMemory} />
      <BlockOutputSync block={resolvedBlock} setBlockOutput={setBlockOutput} />

      <div className={`block block--${resolvedBlock.type}${isDragging ? ' block--dragging' : ''}`}>
        <div className="block__handle" title="Drag to reorder" {...dragHandleProps}>
          <DragIcon />
        </div>

        <div className="block__content">
          {(bindingErrors.length > 0 || validationErrors.length > 0) && (
            <BlockIssueBanner
              title="Block validation"
              issues={[...bindingErrors, ...validationErrors]}
            />
          )}

          {!knownType ? (
            <UnknownBlockPlaceholder block={resolvedBlock} />
          ) : validationErrors.length > 0 ? null : (
            <BlockRenderer
              block={resolvedBlock}
              onSubpageClick={handleSubpageClick}
              memoryEntries={memoryEntries}
            />
          )}
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
    </BlockErrorBoundary>
  );
}

function BlockRenderer({ block, onSubpageClick, memoryEntries }) {
  switch (block.type) {
    case 'citation':
      return <CitationBlock block={block} />;
    case 'iframe':
      return <IframeBlock block={block} />;
    case 'subpage':
      return <SubpageBlock block={block} onClick={onSubpageClick} />;
    case 'text':
      return <TextBlock block={block} memoryEntries={memoryEntries} />;
    case 'quiz':
    case 'assessment':
      return <AssessmentBlock block={block} />;
    case 'desmos':
      return <DesmosBlock block={block} />;
    case 'chatbot':
      return <BlockChat block={block} />;
    case 'heading_1':
      return <h1 className="h1-block">{block.text}</h1>;
    case 'heading_2':
      return <h2 className="h2-block">{block.text}</h2>;
    case 'heading_3':
      return <h3 className="h3-block">{block.text}</h3>;
    case 'bulleted_list':
      return <ListBlock block={block} bulleted />;
    case 'numbered_list':
      return <ListBlock block={block} />;
    case 'todo_list':
      return <TodoListBlock block={block} />;
    case 'toggle_list':
      return <ToggleBlock block={block} memoryEntries={memoryEntries} />;
    case 'callout':
      return <CalloutBlock block={block} memoryEntries={memoryEntries} />;
    case 'code':
      return <CodeBlock block={block} />;
    case 'glossary':
      return <GlossaryBlock block={block} />;
    case 'agent':
      return <AgentBlock block={block} />;
    case 'button':
      return <ActionButtonBlock block={block} />;
    case 'progress':
      return <ProgressBlock block={block} />;
    default:
      return <UnknownBlockPlaceholder block={block} />;
  }
}

class BlockErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.block.id !== this.props.block.id && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="block block--error">
          <div className="block__content">
            <BlockIssueBanner
              title="Block crashed"
              issues={[this.state.error.message || 'Unexpected render error']}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function BlockMemorySync({ block, addToMemory }) {
  useEffect(() => {
    const entries = normalizeMemoryEntries(block.addToMemory);
    entries.forEach(entry => {
      addToMemory({
        ...entry,
        sourceBlockId: block.id,
        metadata: {
          blockType: block.type,
          ...(entry.metadata || {}),
        },
      });
    });
  }, [addToMemory, block.addToMemory, block.id, block.type]);

  return null;
}

function BlockOutputSync({ block, setBlockOutput }) {
  useEffect(() => {
    const outputs = block.outputs && typeof block.outputs === 'object' ? block.outputs : {};
    Object.entries(outputs).forEach(([outputName, value]) => {
      setBlockOutput(block.id, outputName, value);
    });

    const exposed = block.expose && typeof block.expose === 'object' ? block.expose : {};
    Object.entries(exposed).forEach(([outputName, source]) => {
      if (typeof source === 'string') {
        setBlockOutput(block.id, outputName, block[source]);
      } else if (source && typeof source === 'object' && source.value !== undefined) {
        setBlockOutput(block.id, outputName, source.value);
      }
    });
  }, [block, setBlockOutput]);

  return null;
}

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

function TextBlock({ block, memoryEntries }) {
  return (
    <div className="text-block">
      {block.heading && <h3 className="text-block__heading">{block.heading}</h3>}
      {block.body && (
        <div className="text-block__body">
          <MemoryAwareText text={block.body} memoryEntries={memoryEntries} />
        </div>
      )}
    </div>
  );
}

function AssessmentBlock({ block }) {
  const mode = block.mode || (block.type === 'quiz' ? 'multiple_choice' : 'multiple_choice');
  switch (mode) {
    case 'free_response':
      return <FreeResponseAssessment block={block} />;
    case 'interactive_slider':
      return <InteractiveSliderAssessment block={block} />;
    case 'drag_sort':
      return <DragSortAssessment block={block} />;
    case 'multiple_choice':
    default:
      return <MultipleChoiceAssessment block={block} />;
  }
}

function MultipleChoiceAssessment({ block }) {
  const questions = normalizeMultipleChoiceQuestions(block);
  const [answers, setAnswers] = useState({});
  const emittedRef = useRef(false);
  const { emit, setBlockOutput } = usePageRuntime();

  const completed = questions.length > 0 && Object.keys(answers).length === questions.length;
  const score = questions.reduce((total, question, index) => (
    total + (answers[index] === question.answer ? 1 : 0)
  ), 0);
  const result = {
    blockId: block.id,
    mode: 'multiple_choice',
    total: questions.length,
    score,
    passed: questions.length > 0 ? score === questions.length : false,
    answers,
  };

  useEffect(() => {
    if (!completed || emittedRef.current) return;
    emittedRef.current = true;
    setBlockOutput(block.id, 'result', result);
    setBlockOutput(block.id, 'score', score);
    setBlockOutput(block.id, 'passed', result.passed);
    emit('assessment:completed', result);
  }, [block.id, completed, emit, result, score, setBlockOutput]);

  return (
    <div className="quiz-block">
      {block.heading && <h3 className="quiz-block__heading">{block.heading}</h3>}
      {questions.map((question, questionIndex) => {
        const selected = answers[questionIndex];
        const revealed = selected !== undefined;
        return (
          <div key={questionIndex} className="quiz-question">
            <p className="quiz-question__q">{question.q}</p>
            <div className="quiz-question__options">
              {(question.options ?? []).map((option, optionIndex) => {
                const isSelected = selected === optionIndex;
                const isCorrect = optionIndex === question.answer;
                let cls = 'quiz-option';
                if (revealed && isCorrect) cls += ' quiz-option--correct';
                if (revealed && isSelected && !isCorrect) cls += ' quiz-option--wrong';
                if (!revealed && isSelected) cls += ' quiz-option--selected';

                return (
                  <button
                    key={optionIndex}
                    className={cls}
                    onClick={() => !revealed && setAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }))}
                    disabled={revealed}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {revealed && question.explanation && (
              <p className="quiz-question__explanation">{question.explanation}</p>
            )}
          </div>
        );
      })}
      {completed && (
        <div className="assessment-summary">
          Score: {score}/{questions.length}
        </div>
      )}
    </div>
  );
}

function FreeResponseAssessment({ block }) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState(null);
  const { emit, setBlockOutput } = usePageRuntime();

  function handleSubmit(event) {
    event.preventDefault();
    const pattern = block.validationRegex || block.answerRegex;
    const isCorrect = pattern
      ? new RegExp(pattern, block.validationFlags || 'i').test(value.trim())
      : block.answer
        ? value.trim().toLowerCase() === String(block.answer).trim().toLowerCase()
        : value.trim().length > 0;

    const nextResult = {
      blockId: block.id,
      mode: 'free_response',
      response: value,
      passed: Boolean(isCorrect),
    };

    setResult(nextResult);
    setBlockOutput(block.id, 'result', nextResult);
    setBlockOutput(block.id, 'passed', nextResult.passed);
    setBlockOutput(block.id, 'response', value);
    emit('assessment:completed', nextResult);
  }

  return (
    <form className="assessment assessment--free" onSubmit={handleSubmit}>
      {block.heading && <h3 className="quiz-block__heading">{block.heading}</h3>}
      {block.prompt && <p className="quiz-question__q">{block.prompt}</p>}
      <textarea
        className="assessment__textarea"
        value={value}
        onChange={event => setValue(event.target.value)}
        placeholder={block.placeholder || 'Write your answer here'}
      />
      <div className="assessment__actions">
        <button className="assessment__submit" type="submit">Submit</button>
      </div>
      {result && (
        <div className={`assessment-feedback ${result.passed ? 'assessment-feedback--correct' : 'assessment-feedback--wrong'}`}>
          <strong>{result.passed ? 'Correct.' : 'Not quite.'}</strong>
          {block.explanation && <span> {block.explanation}</span>}
        </div>
      )}
    </form>
  );
}

function InteractiveSliderAssessment({ block }) {
  const [value, setValue] = useState(block.min ?? 0);
  const [result, setResult] = useState(null);
  const { emit, setBlockOutput } = usePageRuntime();

  function handleSubmit(event) {
    event.preventDefault();
    const answer = Number(block.answer);
    const tolerance = Number(block.tolerance ?? 0);
    const passed = Math.abs(Number(value) - answer) <= tolerance;
    const nextResult = {
      blockId: block.id,
      mode: 'interactive_slider',
      value: Number(value),
      answer,
      tolerance,
      passed,
    };
    setResult(nextResult);
    setBlockOutput(block.id, 'result', nextResult);
    setBlockOutput(block.id, 'value', Number(value));
    setBlockOutput(block.id, 'passed', passed);
    emit('assessment:completed', nextResult);
  }

  return (
    <form className="assessment assessment--slider" onSubmit={handleSubmit}>
      {block.heading && <h3 className="quiz-block__heading">{block.heading}</h3>}
      {block.prompt && <p className="quiz-question__q">{block.prompt}</p>}
      <input
        type="range"
        min={block.min ?? 0}
        max={block.max ?? 100}
        step={block.step ?? 1}
        value={value}
        onChange={event => setValue(event.target.value)}
        className="assessment__range"
      />
      <div className="assessment__range-value">
        {value}{block.unit ? ` ${block.unit}` : ''}
      </div>
      <div className="assessment__actions">
        <button className="assessment__submit" type="submit">Check answer</button>
      </div>
      {result && (
        <div className={`assessment-feedback ${result.passed ? 'assessment-feedback--correct' : 'assessment-feedback--wrong'}`}>
          <strong>{result.passed ? 'Correct.' : 'Try again.'}</strong>
          {block.explanation && <span> {block.explanation}</span>}
        </div>
      )}
    </form>
  );
}

function DragSortAssessment({ block }) {
  const [items, setItems] = useState(block.items || []);
  const [dragId, setDragId] = useState(null);
  const [result, setResult] = useState(null);
  const { emit, setBlockOutput } = usePageRuntime();

  function moveItem(targetId) {
    if (!dragId || dragId === targetId) return;
    const next = [...items];
    const sourceIndex = next.findIndex(item => item.id === dragId);
    const targetIndex = next.findIndex(item => item.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
  }

  function handleSubmit() {
    const order = items.map(item => item.id || item.text);
    const expected = (block.correctOrder || []).map(item => (
      typeof item === 'string' ? item : item.id || item.text
    ));
    const passed = expected.length > 0 && expected.every((entry, index) => entry === order[index]);
    const nextResult = {
      blockId: block.id,
      mode: 'drag_sort',
      order,
      expected,
      passed,
    };
    setResult(nextResult);
    setBlockOutput(block.id, 'result', nextResult);
    setBlockOutput(block.id, 'passed', passed);
    emit('assessment:completed', nextResult);
  }

  return (
    <div className="assessment assessment--drag-sort">
      {block.heading && <h3 className="quiz-block__heading">{block.heading}</h3>}
      {block.prompt && <p className="quiz-question__q">{block.prompt}</p>}
      <div className="drag-sort-list">
        {items.map(item => {
          const itemKey = item.id || item.text;
          const expected = (block.correctOrder || []).map(entry => (
            typeof entry === 'string' ? entry : entry.id || entry.text
          ));
          const expectedIndex = expected.indexOf(itemKey);
          const currentIndex = items.findIndex(entry => (entry.id || entry.text) === itemKey);
          const correct = result ? expectedIndex === currentIndex : null;
          return (
            <div
              key={itemKey}
              className={`drag-sort-item${correct === true ? ' drag-sort-item--correct' : ''}${correct === false ? ' drag-sort-item--wrong' : ''}`}
              draggable
              onDragStart={() => setDragId(itemKey)}
              onDragOver={event => event.preventDefault()}
              onDrop={() => {
                moveItem(itemKey);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
            >
              <span className="drag-sort-item__handle">⋮⋮</span>
              <span>{item.text || item.label || itemKey}</span>
            </div>
          );
        })}
      </div>
      <div className="assessment__actions">
        <button className="assessment__submit" type="button" onClick={handleSubmit}>Submit order</button>
      </div>
      {result && block.explanation && (
        <div className={`assessment-feedback ${result.passed ? 'assessment-feedback--correct' : 'assessment-feedback--wrong'}`}>
          {block.explanation}
        </div>
      )}
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
      {(block.items ?? []).map((item, index) => (
        <li key={index}>{typeof item === 'string' ? item : item?.text}</li>
      ))}
    </Tag>
  );
}

function TodoListBlock({ block }) {
  return (
    <div className="todo-list">
      {(block.items ?? []).map((item, index) => (
        <div key={index} className="todo-item">
          <input type="checkbox" checked={Boolean(item.checked)} readOnly />
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}

function ToggleBlock({ block, memoryEntries }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="toggle-block">
      <button className="toggle-block__header" onClick={() => setIsOpen(!isOpen)}>
        <span className={`toggle-block__arrow ${isOpen ? 'open' : ''}`}>▶</span>
        <span className="toggle-block__title">{block.title}</span>
      </button>
      {isOpen && (
        <div className="toggle-block__content">
          <MemoryAwareText text={block.body} memoryEntries={memoryEntries} />
        </div>
      )}
    </div>
  );
}

function CalloutBlock({ block, memoryEntries }) {
  return (
    <div className="callout-block">
      <span className="callout-block__icon">{block.icon || '💡'}</span>
      <div className="callout-block__text">
        <MemoryAwareText text={block.text} memoryEntries={memoryEntries} />
      </div>
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

function GlossaryBlock({ block }) {
  const { memoryEntries, memoryStatus, memoryError } = usePageRuntime();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return memoryEntries;
    return memoryEntries.filter(entry => (
      entry.term.toLowerCase().includes(needle) ||
      entry.definition.toLowerCase().includes(needle)
    ));
  }, [memoryEntries, query]);

  return (
    <div className="glossary-block">
      <div className="glossary-block__header">
        <h3>{block.heading || 'Glossary'}</h3>
        <input
          className="glossary-block__search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search terms"
        />
      </div>
      {memoryStatus === 'loading' && <div className="glossary-block__empty">Loading terms…</div>}
      {memoryStatus === 'error' && <div className="glossary-block__empty">Memory error: {memoryError}</div>}
      {memoryStatus !== 'loading' && filtered.length === 0 && (
        <div className="glossary-block__empty">No glossary terms yet.</div>
      )}
      <div className="glossary-block__list">
        {filtered.map(entry => (
          <div key={`${entry.scope}-${entry.term}`} className="glossary-block__entry">
            <strong>{entry.term}</strong>
            <p>{entry.definition}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentBlock({ block }) {
  const [status, setStatus] = useState('idle');
  const [response, setResponse] = useState(block.initialContent || '');
  const [error, setError] = useState(null);
  const autoRunRef = useRef(false);
  const { subscribe, emit, setBlockOutput } = usePageRuntime();

  async function execute(trigger = { event: 'manual' }) {
    setStatus('loading');
    setError(null);
    try {
      const data = await runAgentBlock({
        blockId: block.id,
        prompt: block.prompt,
        systemPrompt: block.systemPrompt,
        context: block.context,
        trigger,
      });
      setResponse(data.content);
      setStatus('ready');
      setBlockOutput(block.id, 'response', data.content);
      emit('agent:completed', { blockId: block.id, content: data.content });
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  useEffect(() => {
    if (!block.runOn?.event) return undefined;
    return subscribe(block.runOn.event, ({ payload }) => {
      if (autoRunRef.current && block.runOn.once !== false) return;
      if (!matchesRunConditions(block.runOn.conditions, payload)) return;
      autoRunRef.current = true;
      execute({ event: block.runOn.event, payload });
    });
  }, [block.runOn, subscribe]);

  return (
    <div className="agent-block">
      {block.title && <div className="agent-block__title">{block.title}</div>}
      {block.description && <p className="agent-block__description">{block.description}</p>}
      {status === 'loading' && <div className="agent-block__loading">Running agent…</div>}
      {status === 'error' && (
        <div className="agent-block__error">
          <div>{error}</div>
          <button className="agent-block__retry" onClick={() => execute({ event: 'retry' })}>Retry</button>
        </div>
      )}
      {response && (
        <div className="agent-block__response">
          <FormattedContent text={response} />
        </div>
      )}
      {block.allowManualTrigger !== false && status !== 'loading' && (
        <button className="agent-block__button" onClick={() => execute({ event: 'button:click' })}>
          {block.buttonLabel || 'Run agent'}
        </button>
      )}
    </div>
  );
}

function ActionButtonBlock({ block }) {
  const { emit, transitionTo } = usePageRuntime();

  return (
    <div className="button-block">
      {block.heading && <div className="button-block__heading">{block.heading}</div>}
      <button
        className="button-block__button"
        onClick={() => {
          emit(block.eventName || 'button:clicked', {
            blockId: block.id,
            label: block.label,
            ...(block.payload || {}),
          });
          if (block.targetState) {
            transitionTo(block.targetState, { via: 'button', blockId: block.id });
          }
        }}
      >
        {block.label}
      </button>
    </div>
  );
}

function ProgressBlock({ block }) {
  const { subscribe, setBlockOutput } = usePageRuntime();
  const [completedIds, setCompletedIds] = useState(() => new Set());

  useEffect(() => {
    return subscribe('assessment:completed', ({ payload }) => {
      if (block.passedOnly && !payload.passed) return;
      setCompletedIds(prev => {
        const next = new Set(prev);
        next.add(payload.blockId);
        return next;
      });
    });
  }, [block.passedOnly, subscribe]);

  const current = completedIds.size;
  const total = Number(block.total || 1);
  const percentage = Math.max(0, Math.min(100, Math.round((current / total) * 100)));

  useEffect(() => {
    setBlockOutput(block.id, 'value', percentage);
    setBlockOutput(block.id, 'completed', current);
  }, [block.id, current, percentage, setBlockOutput]);

  return (
    <div className="progress-block">
      <div className="progress-block__label">
        <span>{block.label || 'Progress'}</span>
        <span>{current}/{total}</span>
      </div>
      <div className="progress-block__track">
        <div className="progress-block__fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function MemoryAwareText({ text, memoryEntries }) {
  const segments = useMemo(() => segmentTextWithMemory(text, memoryEntries || []), [memoryEntries, text]);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'term') {
          return (
            <span
              key={`${segment.entry.term}-${index}`}
              className="memory-term"
              title={segment.entry.definition}
            >
              {segment.value}
            </span>
          );
        }
        return <React.Fragment key={index}>{segment.value}</React.Fragment>;
      })}
    </>
  );
}

function BlockIssueBanner({ title, issues }) {
  return (
    <div className="block-issue">
      <div className="block-issue__title">{title}</div>
      <ul className="block-issue__list">
        {issues.map((issue, index) => (
          <li key={index}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

function UnknownBlockPlaceholder({ block }) {
  return (
    <div className="unknown-block">
      <strong>Unknown block type:</strong> {block.type}
    </div>
  );
}

function FormattedContent({ text }) {
  const lines = text.split('\n').filter(Boolean);
  const listLines = lines.filter(line => /^[-*]\s+/.test(line));

  if (listLines.length === lines.length && lines.length > 0) {
    return (
      <ul className="agent-block__list">
        {lines.map((line, index) => (
          <li key={index}>{line.replace(/^[-*]\s+/, '')}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="agent-block__formatted">
      {lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  );
}

function normalizeMemoryEntries(value) {
  if (!value) return [];
  const entries = Array.isArray(value) ? value : [value];
  return entries.filter(entry => entry?.term && entry?.definition);
}

function normalizeMultipleChoiceQuestions(block) {
  if (Array.isArray(block.questions) && block.questions.length > 0) {
    return block.questions;
  }
  if (block.question) {
    return [{
      q: block.question,
      options: block.options || [],
      answer: block.answer ?? 0,
      explanation: block.explanation,
    }];
  }
  return [];
}

function matchesRunConditions(conditions, payload) {
  if (!conditions) return true;
  return Object.entries(conditions).every(([key, expected]) => payload?.[key] === expected);
}

function safeHost(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function DragIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="2" r="1.5" />
      <circle cx="8" cy="2" r="1.5" />
      <circle cx="2" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="2" cy="14" r="1.5" />
      <circle cx="8" cy="14" r="1.5" />
    </svg>
  );
}
