import React, { useState, useCallback } from 'react';
import type { Block, TextBlock, TodoBlock, ToggleBlock, CalloutBlock, ImageBlock } from '../../shared/types';
import { Icon } from '../../shared/components/Icon';
import { nanoid } from '../../shared/utils/nanoid';

// ─── Block renderers ────────────────────────────────────────────────────────────

function TextBlockView({ block, onChange, onKeyDown, onFocus }: {
  block: TextBlock;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
}) {
  const styles: Record<string, React.CSSProperties> = {
    heading1: { fontSize: 30, fontWeight: 700, margin: '24px 0 4px', color: '#1a1a1a' },
    heading2: { fontSize: 22, fontWeight: 600, margin: '20px 0 4px', color: '#1a1a1a' },
    heading3: { fontSize: 17, fontWeight: 600, margin: '16px 0 2px', color: '#333' },
    paragraph: { fontSize: 15, color: '#333', margin: '2px 0' },
    bullet: { fontSize: 15, color: '#333', margin: '2px 0' },
    numbered: { fontSize: 15, color: '#333', margin: '2px 0' },
    quote: { fontSize: 15, color: '#555', fontStyle: 'italic', margin: '8px 0', paddingLeft: 14, borderLeft: '3px solid #ccc' },
    title: { fontSize: 36, fontWeight: 700, margin: '0 0 8px', color: '#1a1a1a' },
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {block.type === 'bullet' && <span style={{ marginTop: 4, color: '#555', userSelect: 'none' }}>•</span>}
      <div
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange(e.currentTarget.textContent ?? '')}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        style={{ ...styles[block.type] ?? styles.paragraph, flex: 1, outline: 'none', minHeight: 24, wordBreak: 'break-word' }}
        dangerouslySetInnerHTML={{ __html: block.text }}
      />
    </div>
  );
}

function TodoBlockView({ block, onChange, onToggle, onKeyDown, onFocus }: {
  block: TodoBlock;
  onChange: (text: string) => void;
  onToggle: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '2px 0' }}>
      <input
        type="checkbox"
        checked={block.checked}
        onChange={onToggle}
        style={{ marginTop: 3, cursor: 'pointer', width: 15, height: 15, flexShrink: 0 }}
      />
      <div
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange(e.currentTarget.textContent ?? '')}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        style={{
          flex: 1, outline: 'none', fontSize: 15, color: block.checked ? '#aaa' : '#333',
          textDecoration: block.checked ? 'line-through' : 'none', minHeight: 22, wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={{ __html: block.text }}
      />
    </div>
  );
}

function ToggleBlockView({ block, onChange, onToggleOpen, onKeyDown, onFocus }: {
  block: ToggleBlock;
  onChange: (text: string) => void;
  onToggleOpen: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
}) {
  return (
    <div style={{ margin: '2px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <button onClick={onToggleOpen} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 0', color: '#555', flexShrink: 0 }}>
          <Icon name={block.open ? 'chevron-down' : 'chevron-right'} size={14} />
        </button>
        <div
          contentEditable
          suppressContentEditableWarning
          onInput={e => onChange(e.currentTarget.textContent ?? '')}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          style={{ flex: 1, outline: 'none', fontSize: 15, color: '#333', fontWeight: 500, minHeight: 22, wordBreak: 'break-word' }}
          dangerouslySetInnerHTML={{ __html: block.text }}
        />
      </div>
      {block.open && (
        <div style={{ marginLeft: 28, borderLeft: '2px solid #eee', paddingLeft: 12 }}>
          {block.children.map(child => (
            <div key={child.id} style={{ fontSize: 14, color: '#555', padding: '2px 0' }}>
              {'text' in child ? (child as TextBlock).text : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalloutBlockView({ block, onChange, onKeyDown, onFocus }: {
  block: CalloutBlock;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
}) {
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 6,
      background: block.color ?? '#f5f5f5', margin: '6px 0',
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{block.icon}</span>
      <div
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange(e.currentTarget.textContent ?? '')}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        style={{ flex: 1, outline: 'none', fontSize: 15, color: '#333', minHeight: 22, wordBreak: 'break-word' }}
        dangerouslySetInnerHTML={{ __html: block.text }}
      />
    </div>
  );
}

function ImageBlockView({ block }: { block: ImageBlock }) {
  return (
    <div style={{ margin: '12px 0' }}>
      <img src={block.url} alt={block.caption ?? ''} style={{ maxWidth: '100%', borderRadius: 6, display: 'block' }} />
      {block.caption && <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{block.caption}</p>}
    </div>
  );
}

// ─── Block type menu ────────────────────────────────────────────────────────────
const BLOCK_TYPES = [
  { type: 'heading1', label: 'Heading 1', icon: 'H1' },
  { type: 'heading2', label: 'Heading 2', icon: 'H2' },
  { type: 'heading3', label: 'Heading 3', icon: 'H3' },
  { type: 'paragraph', label: 'Text', icon: 'T' },
  { type: 'bullet', label: 'Bullet list', icon: '•' },
  { type: 'numbered', label: 'Numbered list', icon: '1.' },
  { type: 'todo', label: 'To-do', icon: '☐' },
  { type: 'toggle', label: 'Toggle', icon: '▶' },
  { type: 'quote', label: 'Quote', icon: '"' },
  { type: 'callout', label: 'Callout', icon: '💡' },
  { type: 'divider', label: 'Divider', icon: '—' },
  { type: 'image', label: 'Image', icon: '🖼' },
] as const;

// ─── Main editor ───────────────────────────────────────────────────────────────
interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  readOnly?: boolean;
}

export function BlockEditor({ blocks, onChange, readOnly = false }: BlockEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    onChange(blocks.map(b => b.id === id ? { ...b, ...patch } as Block : b));
  }, [blocks, onChange]);

  const addBlock = useCallback((afterId: string | null, type: Block['type'] = 'paragraph') => {
    const idx = afterId ? blocks.findIndex(b => b.id === afterId) : blocks.length - 1;
    const newBlock = makeBlock(type);
    const next = [...blocks];
    next.splice(idx + 1, 0, newBlock);
    onChange(next);
    return newBlock.id;
  }, [blocks, onChange]);

  const deleteBlock = useCallback((id: string) => {
    if (blocks.length <= 1) return;
    onChange(blocks.filter(b => b.id !== id));
  }, [blocks, onChange]);

  const moveBlock = useCallback((id: string, dir: 'up' | 'down') => {
    const idx = blocks.findIndex(b => b.id === id);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === blocks.length - 1) return;
    const next = [...blocks];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  }, [blocks, onChange]);

  function handleKeyDown(e: React.KeyboardEvent, blockId: string) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addBlock(blockId);
    }
    if (e.key === 'Backspace') {
      const block = blocks.find(b => b.id === blockId);
      const text = block && 'text' in block ? (block as TextBlock).text : '';
      if (!text) {
        e.preventDefault();
        deleteBlock(blockId);
      }
    }
  }

  if (readOnly) {
    return (
      <div>
        {blocks.map((block, idx) => (
          <BlockView key={block.id} block={block} numbered={idx + 1} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {blocks.map((block, idx) => (
        <div
          key={block.id}
          style={{ display: 'flex', gap: 4, alignItems: 'flex-start', padding: '1px 0' }}
          onMouseEnter={() => setActiveId(block.id)}
          onMouseLeave={() => setActiveId(null)}
        >
          {/* Block controls */}
          <div style={{
            display: 'flex', gap: 2, opacity: activeId === block.id ? 1 : 0,
            transition: 'opacity 0.1s', marginTop: 3, flexShrink: 0, width: 48,
          }}>
            <ControlBtn title="Move up" onClick={() => moveBlock(block.id, 'up')}>↑</ControlBtn>
            <ControlBtn title="Move down" onClick={() => moveBlock(block.id, 'down')}>↓</ControlBtn>
            <ControlBtn title="Delete" onClick={() => deleteBlock(block.id)}>×</ControlBtn>
          </div>

          {/* Block content */}
          <div style={{ flex: 1 }}>
            <BlockEditView
              block={block}
              numbered={idx + 1}
              onChange={(patch) => updateBlock(block.id, patch)}
              onKeyDown={(e) => handleKeyDown(e, block.id)}
              onFocus={() => setActiveId(block.id)}
            />
          </div>
        </div>
      ))}

      {/* Add block button */}
      <div style={{ position: 'relative', marginTop: 8 }}>
        <button
          onClick={() => setShowMenu(m => !m)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', background: 'none', border: '1px dashed #ddd',
            borderRadius: 6, cursor: 'pointer', color: '#aaa', fontSize: 13,
          }}
        >
          <Icon name="plus" size={14} /> Add block
        </button>
        {showMenu && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 200,
            background: '#fff', border: '1px solid #e2e2e0', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 6, minWidth: 200,
          }}>
            {BLOCK_TYPES.map(bt => (
              <button
                key={bt.type}
                onClick={() => {
                  addBlock(blocks.length > 0 ? blocks[blocks.length - 1].id : null, bt.type as Block['type']);
                  setShowMenu(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '7px 10px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 13, color: '#333', borderRadius: 4, textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f3')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ width: 24, textAlign: 'center', fontWeight: 600, fontSize: 12, color: '#888' }}>{bt.icon}</span>
                {bt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Editable block view ────────────────────────────────────────────────────────
function BlockEditView({ block, numbered, onChange, onKeyDown, onFocus }: {
  block: Block;
  numbered: number;
  onChange: (patch: Partial<Block>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
}) {
  switch (block.type) {
    case 'divider':
      return <hr style={{ border: 'none', borderTop: '1px solid #e2e2e0', margin: '12px 0' }} />;
    case 'image':
      return <ImageBlockView block={block as ImageBlock} />;
    case 'database_embed':
      return <div style={{ padding: 8, background: '#f5f5f3', borderRadius: 6, fontSize: 13, color: '#888' }}>📊 Embedded database</div>;
    case 'todo':
      return (
        <TodoBlockView
          block={block as TodoBlock}
          onChange={text => onChange({ text })}
          onToggle={() => onChange({ checked: !(block as TodoBlock).checked })}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
        />
      );
    case 'toggle':
      return (
        <ToggleBlockView
          block={block as ToggleBlock}
          onChange={text => onChange({ text })}
          onToggleOpen={() => onChange({ open: !(block as ToggleBlock).open })}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
        />
      );
    case 'callout':
      return (
        <CalloutBlockView
          block={block as CalloutBlock}
          onChange={text => onChange({ text })}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
        />
      );
    case 'numbered':
      return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ color: '#555', fontSize: 15, marginTop: 2, minWidth: 20, flexShrink: 0 }}>{numbered}.</span>
          <div
            contentEditable
            suppressContentEditableWarning
            onInput={e => onChange({ text: e.currentTarget.textContent ?? '' })}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            style={{ flex: 1, outline: 'none', fontSize: 15, color: '#333', minHeight: 22, wordBreak: 'break-word' }}
            dangerouslySetInnerHTML={{ __html: (block as TextBlock).text }}
          />
        </div>
      );
    default:
      return (
        <TextBlockView
          block={block as TextBlock}
          onChange={text => onChange({ text })}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
        />
      );
  }
}

// ─── Read-only block view ───────────────────────────────────────────────────────
export function BlockView({ block, numbered }: { block: Block; numbered: number }) {
  switch (block.type) {
    case 'divider':
      return <hr style={{ border: 'none', borderTop: '1px solid #e2e2e0', margin: '12px 0' }} />;
    case 'image':
      return <ImageBlockView block={block as ImageBlock} />;
    case 'todo': {
      const b = block as TodoBlock;
      return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '2px 0', fontSize: 15 }}>
          <span style={{ marginTop: 2 }}>{b.checked ? '☑' : '☐'}</span>
          <span style={{ textDecoration: b.checked ? 'line-through' : 'none', color: b.checked ? '#aaa' : '#333' }}>{b.text}</span>
        </div>
      );
    }
    case 'toggle': {
      const b = block as ToggleBlock;
      return (
        <div style={{ fontSize: 15, margin: '2px 0' }}>
          <span style={{ fontWeight: 500 }}>▶ {b.text}</span>
        </div>
      );
    }
    case 'callout': {
      const b = block as CalloutBlock;
      return (
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderRadius: 6, background: b.color ?? '#f5f5f5', margin: '4px 0', fontSize: 14 }}>
          <span>{b.icon}</span><span>{b.text}</span>
        </div>
      );
    }
    case 'bullet':
      return <div style={{ fontSize: 15, margin: '1px 0', paddingLeft: 16 }}>• {(block as TextBlock).text}</div>;
    case 'numbered':
      return <div style={{ fontSize: 15, margin: '1px 0', paddingLeft: 8 }}>{numbered}. {(block as TextBlock).text}</div>;
    case 'quote':
      return <div style={{ fontSize: 15, fontStyle: 'italic', color: '#555', borderLeft: '3px solid #ccc', paddingLeft: 12, margin: '6px 0' }}>{(block as TextBlock).text}</div>;
    case 'heading1':
      return <h1 style={{ fontSize: 28, fontWeight: 700, margin: '20px 0 4px', color: '#1a1a1a' }}>{(block as TextBlock).text}</h1>;
    case 'heading2':
      return <h2 style={{ fontSize: 20, fontWeight: 600, margin: '16px 0 4px', color: '#1a1a1a' }}>{(block as TextBlock).text}</h2>;
    case 'heading3':
      return <h3 style={{ fontSize: 16, fontWeight: 600, margin: '12px 0 2px', color: '#333' }}>{(block as TextBlock).text}</h3>;
    default:
      return <p style={{ fontSize: 15, margin: '2px 0', color: '#333' }}>{(block as TextBlock).text}</p>;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function makeBlock(type: Block['type']): Block {
  const id = nanoid();
  switch (type) {
    case 'todo': return { id, type: 'todo', text: '', checked: false };
    case 'toggle': return { id, type: 'toggle', text: '', children: [], open: false };
    case 'divider': return { id, type: 'divider' };
    case 'callout': return { id, type: 'callout', text: '', icon: '💡', color: '#fef9c3' };
    case 'image': return { id, type: 'image', url: '' };
    case 'database_embed': return { id, type: 'database_embed', databaseFileId: '' };
    default: return { id, type: type as TextBlock['type'], text: '' };
  }
}

function ControlBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 12,
        borderRadius: 3, padding: 0,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#eee')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {children}
    </button>
  );
}
