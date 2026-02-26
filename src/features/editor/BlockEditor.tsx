import React, { useState, useCallback, useMemo } from 'react';
import type { Block, TextBlock, TodoBlock, ToggleBlock, CalloutBlock, ImageBlock, DatabaseEmbedBlock } from '../../shared/types';
import { Icon } from '../../shared/components/Icon';
import { nanoid } from '../../shared/utils/nanoid';

// ─── Block renderers ────────────────────────────────────────────────────────────

function EditableText({
  value,
  onChange,
  onKeyDown,
  onFocus,
  style,
}: {
  value: string;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
  style: React.CSSProperties;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || isFocused) return;
    if (el.textContent !== value) {
      el.textContent = value;
    }
  }, [value, isFocused]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={e => onChange(readEditableText(e.currentTarget))}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(e.currentTarget);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          return;
        }
        onKeyDown(e);
      }}
      onFocus={() => {
        setIsFocused(true);
        onFocus();
      }}
      onBlur={e => {
        setIsFocused(false);
        onChange(readEditableText(e.currentTarget));
      }}
      style={{ whiteSpace: 'pre-wrap', ...style }}
    />
  );
}

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
      <EditableText
        value={block.text}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        style={{ ...styles[block.type] ?? styles.paragraph, flex: 1, outline: 'none', minHeight: 24, wordBreak: 'break-word' }}
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
      <EditableText
        value={block.text}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        style={{
          flex: 1, outline: 'none', fontSize: 15, color: block.checked ? '#aaa' : '#333',
          textDecoration: block.checked ? 'line-through' : 'none', minHeight: 22, wordBreak: 'break-word',
        }}
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
        <EditableText
          value={block.text}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          style={{ flex: 1, outline: 'none', fontSize: 15, color: '#333', fontWeight: 500, minHeight: 22, wordBreak: 'break-word' }}
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
      <EditableText
        value={block.text}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        style={{ flex: 1, outline: 'none', fontSize: 15, color: '#333', minHeight: 22, wordBreak: 'break-word' }}
      />
    </div>
  );
}

function ImageBlockReadView({ block }: { block: ImageBlock }) {
  return (
    <div style={{ margin: '12px 0' }}>
      {block.url ? (
        <img src={block.url} alt={block.caption ?? ''} style={{ maxWidth: '100%', borderRadius: 6, display: 'block' }} />
      ) : (
        <div style={{ border: '1px dashed #ccc', borderRadius: 8, padding: 16, color: '#888', fontSize: 13 }}>
          No image
        </div>
      )}
      {block.caption && <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{block.caption}</p>}
    </div>
  );
}

function ImageBlockEditView({
  block,
  onChange,
}: {
  block: ImageBlock;
  onChange: (patch: Partial<ImageBlock>) => void;
}) {
  async function applyFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const url = await fileToDataUrl(file);
    onChange({ url });
  }

  return (
    <div style={{ margin: '12px 0', border: '1px solid #e2e2e0', borderRadius: 8, padding: 12, background: '#fafafa' }}>
      {block.url ? (
        <img src={block.url} alt={block.caption ?? ''} style={{ maxWidth: '100%', borderRadius: 6, display: 'block', marginBottom: 8 }} />
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files?.[0];
            if (file) void applyFile(file);
          }}
          style={{
            border: '1px dashed #bfbfbf',
            borderRadius: 8,
            padding: 20,
            textAlign: 'center',
            color: '#777',
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          Drag an image here or choose a file
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void applyFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => onChange({ url: '' })}
          style={{ border: '1px solid #ddd', background: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
        >
          Clear
        </button>
      </div>

      <input
        type="text"
        value={block.url}
        onChange={(e) => onChange({ url: e.target.value })}
        placeholder="Paste image URL"
        style={{
          width: '100%',
          border: '1px solid #ddd',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 13,
          marginBottom: 8,
        }}
      />

      <input
        type="text"
        value={block.caption ?? ''}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Caption (optional)"
        style={{ width: '100%', border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}
      />
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

const SLASH_COMMANDS = BLOCK_TYPES.map((item) => ({
  type: item.type as Block['type'],
  label: item.label,
  keywords: [item.label.toLowerCase(), String(item.type).toLowerCase()],
}));

// ─── Main editor ───────────────────────────────────────────────────────────────
interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  readOnly?: boolean;
}

export function BlockEditor({ blocks, onChange, readOnly = false }: BlockEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; query: string; selectedIndex: number } | null>(null);

  const slashMatches = useMemo(() => {
    if (!slashMenu) return [];
    const query = slashMenu.query.trim().toLowerCase();
    if (!query) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((command) =>
      command.keywords.some((keyword) => keyword.includes(query)),
    );
  }, [slashMenu]);

  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    const nextBlocks = blocks.map((b) => (b.id === id ? { ...b, ...patch } as Block : b));
    onChange(nextBlocks);

    const patchText = (patch as { text?: unknown }).text;
    const text = typeof patchText === 'string' ? patchText : null;
    if (text !== null) {
      if (text.startsWith('/')) {
        setSlashMenu((prev) => ({
          blockId: id,
          query: text.slice(1),
          selectedIndex: prev?.blockId === id ? Math.min(prev.selectedIndex, Math.max(0, slashMatches.length - 1)) : 0,
        }));
      } else {
        setSlashMenu((prev) => (prev?.blockId === id ? null : prev));
      }
    }
  }, [blocks, onChange, slashMatches.length]);

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

  const applySlashCommand = useCallback((type: Block['type']) => {
    if (!slashMenu) return;
    const nextBlocks = blocks.map((b) => {
      if (b.id !== slashMenu.blockId) return b;
      const converted = convertBlockTypeKeepingId(b, type);
      if ('text' in converted) {
        return { ...converted, text: '' } as Block;
      }
      return converted;
    });
    onChange(nextBlocks);
    setSlashMenu(null);
  }, [blocks, onChange, slashMenu]);

  function handleKeyDown(e: React.KeyboardEvent, blockId: string) {
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      setSlashMenu({ blockId, query: '', selectedIndex: 0 });
    }

    if (slashMenu?.blockId === blockId) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashMenu((prev) => {
          if (!prev) return prev;
          const max = Math.max(0, slashMatches.length - 1);
          return { ...prev, selectedIndex: Math.min(max, prev.selectedIndex + 1) };
        });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenu((prev) => {
          if (!prev) return prev;
          return { ...prev, selectedIndex: Math.max(0, prev.selectedIndex - 1) };
        });
        return;
      }
      if (e.key === 'Enter' && slashMatches.length > 0) {
        e.preventDefault();
        const chosen = slashMatches[Math.min(slashMenu.selectedIndex, slashMatches.length - 1)];
        if (chosen) applySlashCommand(chosen.type);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenu(null);
        return;
      }
    }

    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    const block = blocks.find(b => b.id === blockId);
    if (e.key === ' ' && block && 'text' in block) {
      const token = (block.text ?? '').trim();
      const nextType = shortcutToType(token);
      if (nextType) {
        e.preventDefault();
        onChange(blocks.map(b => (b.id === blockId ? convertBlockTypeKeepingId(b, nextType) : b)));
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (block?.type === 'bullet') {
        e.preventDefault();
        const text = 'text' in block ? block.text.trim() : '';
        if (!text) {
          updateBlock(blockId, { type: 'paragraph', text: '' } as Partial<Block>);
          return;
        }
        addBlock(blockId, 'bullet');
        return;
      }
      if (block?.type === 'numbered') {
        e.preventDefault();
        const text = 'text' in block ? block.text.trim() : '';
        if (!text) {
          updateBlock(blockId, { type: 'paragraph', text: '' } as Partial<Block>);
          return;
        }
        addBlock(blockId, 'numbered');
        return;
      }
      if (block?.type === 'todo') {
        e.preventDefault();
        const todoText = (block as TodoBlock).text.trim();
        if (!todoText) {
          updateBlock(blockId, { type: 'paragraph', text: '' } as Partial<Block>);
          return;
        }
        addBlock(blockId, 'todo');
        return;
      }
      // For regular text blocks, keep native contentEditable Enter behavior (new line).
      return;
    }
    if (e.key === 'Backspace') {
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
          <BlockView key={block.id} block={block} numbered={getNumberedListNumber(blocks, idx)} />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{ position: 'relative' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const imageFiles = Array.from(e.dataTransfer.files ?? []).filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length === 0) return;
        void (async () => {
          const imageBlocks = await Promise.all(
            imageFiles.map(async (file) => ({
              id: nanoid(),
              type: 'image' as const,
              url: await fileToDataUrl(file),
              caption: file.name,
            })),
          );
          onChange([...blocks, ...imageBlocks]);
        })();
      }}
    >
      {blocks.map((block, idx) => (
        <div
          key={block.id}
          style={{ display: 'flex', gap: 4, alignItems: 'flex-start', padding: '1px 0', position: 'relative' }}
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
              numbered={getNumberedListNumber(blocks, idx)}
              onChange={(patch) => updateBlock(block.id, patch)}
              onKeyDown={(e) => handleKeyDown(e, block.id)}
              onFocus={() => setActiveId(block.id)}
            />
            {slashMenu?.blockId === block.id && slashMatches.length > 0 ? (
              <div
                style={{
                  width: 280,
                  maxHeight: 260,
                  overflowY: 'auto',
                  border: '1px solid #e2e2e0',
                  borderRadius: 10,
                  background: '#fff',
                  boxShadow: '0 12px 24px rgba(0, 0, 0, 0.12)',
                  zIndex: 220,
                  padding: 6,
                  marginTop: 8,
                }}
              >
                {slashMatches.map((command, index) => {
                  const selected = index === slashMenu.selectedIndex;
                  return (
                    <button
                      key={`${command.type}-${command.label}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applySlashCommand(command.type)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        background: selected ? '#edf3ff' : 'transparent',
                        color: selected ? '#1f4ed8' : '#333',
                        padding: '8px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                    >
                      /{command.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
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
      return <ImageBlockEditView block={block as ImageBlock} onChange={(patch) => onChange(patch)} />;
    case 'database_embed':
      return (
        <div style={{ padding: 10, background: '#f5f5f3', borderRadius: 6, border: '1px solid #e7e7e5' }}>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 6 }}>Embedded database file ID</div>
          <input
            type="text"
            value={(block as DatabaseEmbedBlock).databaseFileId}
            onChange={(e) => onChange({ databaseFileId: e.target.value })}
            placeholder="Enter database file id"
            style={{ width: '100%', border: '1px solid #ddd', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}
          />
        </div>
      );
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
          <EditableText
            value={(block as TextBlock).text}
            onChange={text => onChange({ text })}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            style={{ flex: 1, outline: 'none', fontSize: 15, color: '#333', minHeight: 22, wordBreak: 'break-word' }}
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
      return <ImageBlockReadView block={block as ImageBlock} />;
    case 'todo': {
      const b = block as TodoBlock;
      return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '2px 0', fontSize: 15 }}>
          <span style={{ marginTop: 2 }}>{b.checked ? '☑' : '☐'}</span>
          <span style={{ textDecoration: b.checked ? 'line-through' : 'none', color: b.checked ? '#aaa' : '#333', whiteSpace: 'pre-wrap' }}>{b.text}</span>
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
    case 'database_embed': {
      const b = block as DatabaseEmbedBlock;
      return (
        <div style={{ padding: 8, background: '#f5f5f3', borderRadius: 6, fontSize: 13, color: '#666', margin: '4px 0' }}>
          📊 Embedded database {b.databaseFileId ? `(${b.databaseFileId})` : '(no file linked)'}
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
      return <div style={{ fontSize: 15, margin: '1px 0', paddingLeft: 16, whiteSpace: 'pre-wrap' }}>• {(block as TextBlock).text}</div>;
    case 'numbered':
      return <div style={{ fontSize: 15, margin: '1px 0', paddingLeft: 8, whiteSpace: 'pre-wrap' }}>{numbered}. {(block as TextBlock).text}</div>;
    case 'quote':
      return <div style={{ fontSize: 15, fontStyle: 'italic', color: '#555', borderLeft: '3px solid #ccc', paddingLeft: 12, margin: '6px 0', whiteSpace: 'pre-wrap' }}>{(block as TextBlock).text}</div>;
    case 'heading1':
      return <h1 style={{ fontSize: 28, fontWeight: 700, margin: '20px 0 4px', color: '#1a1a1a', whiteSpace: 'pre-wrap' }}>{(block as TextBlock).text}</h1>;
    case 'heading2':
      return <h2 style={{ fontSize: 20, fontWeight: 600, margin: '16px 0 4px', color: '#1a1a1a', whiteSpace: 'pre-wrap' }}>{(block as TextBlock).text}</h2>;
    case 'heading3':
      return <h3 style={{ fontSize: 16, fontWeight: 600, margin: '12px 0 2px', color: '#333', whiteSpace: 'pre-wrap' }}>{(block as TextBlock).text}</h3>;
    default:
      return <p style={{ fontSize: 15, margin: '2px 0', color: '#333', whiteSpace: 'pre-wrap' }}>{(block as TextBlock).text}</p>;
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

function shortcutToType(token: string): Block['type'] | null {
  if (token === '#') return 'heading1';
  if (token === '##') return 'heading2';
  if (token === '###') return 'heading3';
  if (token === '>') return 'quote';
  if (token === '-' || token === '*') return 'bullet';
  if (token === '1.') return 'numbered';
  if (token === '[]' || token === '[ ]') return 'todo';
  if (token === '!!') return 'callout';
  return null;
}

function convertBlockTypeKeepingId(block: Block, type: Block['type']): Block {
  const converted = makeBlock(type);
  return { ...converted, id: block.id };
}

function readEditableText(el: HTMLElement): string {
  return (el.innerText ?? '').replace(/\r/g, '');
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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
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
