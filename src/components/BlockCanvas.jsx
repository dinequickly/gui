import { useMemo, useState } from 'react';
import Block from './Block.jsx';
import './BlockCanvas.css';
import { getLayoutClassName, isDockBlock } from '../lib/pageDocument.js';
import { usePageRuntime } from '../runtime/PageRuntime.jsx';

export default function BlockCanvas({ blocks, layout, onBlocksChange, parentContext, pageMeta }) {
  const { visibleBlocks } = usePageRuntime();
  const [dragState, setDragState] = useState(null);
  const mode = layout?.mode || 'single-column';

  const mainBlocks = useMemo(() => {
    if (mode !== 'content-plus-dock') return visibleBlocks;
    return visibleBlocks.filter(block => !isDockBlock(block, layout));
  }, [layout, mode, visibleBlocks]);

  const dockBlocks = useMemo(() => {
    if (mode !== 'content-plus-dock') return [];
    return visibleBlocks.filter(block => isDockBlock(block, layout));
  }, [layout, mode, visibleBlocks]);

  function handleDelete(blockId) {
    onBlocksChange(blocks.filter(block => block.id !== blockId));
  }

  function handleDragStart(blockId, region) {
    setDragState({ blockId, region });
  }

  function handleDrop(targetId, regionIds, region) {
    if (!dragState || dragState.region !== region || dragState.blockId === targetId) {
      setDragState(null);
      return;
    }

    const reorderedIds = reorderIds(regionIds, dragState.blockId, targetId);
    const nextBlocks = mergeRegionOrder(blocks, regionIds, reorderedIds);
    onBlocksChange(nextBlocks);
    setDragState(null);
  }

  function handleDragEnd() {
    setDragState(null);
  }

  return (
    <div className={`block-canvas ${getLayoutClassName(mode)}`}>
      {mode === 'content-plus-dock' ? (
        <>
          <CanvasRegion
            className="block-canvas__main"
            blocks={mainBlocks}
            region="main"
            regionIds={mainBlocks.map(block => block.id)}
            dragState={dragState}
            onDelete={handleDelete}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            parentContext={parentContext}
            pageMeta={pageMeta}
          />
          <CanvasRegion
            className="block-canvas__dock"
            blocks={dockBlocks}
            region="dock"
            regionIds={dockBlocks.map(block => block.id)}
            dragState={dragState}
            onDelete={handleDelete}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            parentContext={parentContext}
            pageMeta={pageMeta}
          />
        </>
      ) : (
        <CanvasRegion
          className={mode === 'dashboard-grid' ? 'block-canvas__grid' : 'block-canvas__single-col'}
          blocks={visibleBlocks}
          region={mode}
          regionIds={visibleBlocks.map(block => block.id)}
          dragState={dragState}
          onDelete={handleDelete}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          parentContext={parentContext}
          pageMeta={pageMeta}
          grid={mode === 'dashboard-grid'}
        />
      )}
    </div>
  );
}

function CanvasRegion({
  blocks,
  region,
  regionIds,
  dragState,
  onDelete,
  onDragStart,
  onDrop,
  onDragEnd,
  parentContext,
  className,
  pageMeta,
  grid = false,
}) {
  return (
    <div className={`block-canvas__region ${className || ''}`}>
      {blocks.map(block => (
        <div
          key={block.id}
          className={`block-canvas__slot${dragState?.blockId === block.id ? ' block-canvas__slot--dragging' : ''}`}
          style={grid ? { '--col-span': String(Math.max(1, Math.min(block.colSpan || 12, 12))) } : undefined}
          draggable
          onDragStart={() => onDragStart(block.id, region)}
          onDragOver={event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={event => {
            event.preventDefault();
            onDrop(block.id, regionIds, region);
          }}
          onDragEnd={onDragEnd}
        >
          <Block
            block={block}
            onDelete={() => onDelete(block.id)}
            isDragging={dragState?.blockId === block.id}
            parentContext={parentContext}
            pageMeta={pageMeta}
            dragHandleProps={{}}
          />
        </div>
      ))}
    </div>
  );
}

function reorderIds(ids, sourceId, targetId) {
  const next = [...ids];
  const sourceIndex = next.indexOf(sourceId);
  const targetIndex = next.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) return ids;
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function mergeRegionOrder(allBlocks, regionIds, reorderedIds) {
  const regionSet = new Set(regionIds);
  const blockMap = new Map(allBlocks.map(block => [block.id, block]));
  const reorderedBlocks = reorderedIds.map(id => blockMap.get(id)).filter(Boolean);
  let cursor = 0;

  return allBlocks.map(block => {
    if (!regionSet.has(block.id)) return block;
    const nextBlock = reorderedBlocks[cursor];
    cursor += 1;
    return nextBlock;
  });
}
