import { useState, useRef } from 'react';
import Block from './Block.jsx';
import './BlockCanvas.css';

export default function BlockCanvas({ blocks, onBlocksChange, parentContext }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const dragNode = useRef(null);

  function handleDragStart(e, index) {
    dragNode.current = e.currentTarget;
    setDragIndex(index);
    // Ghost image: use the block itself, slightly faded
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(e.currentTarget, 20, 20);
    // Small delay so the clone appears before the original dims
    requestAnimationFrame(() => setDragIndex(index));
  }

  function handleDragEnter(e, index) {
    e.preventDefault();
    if (index !== dragIndex) setDropIndex(index);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e, targetIndex) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...blocks];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    onBlocksChange(next);
    setDragIndex(null);
    setDropIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDropIndex(null);
  }

  function handleDelete(index) {
    onBlocksChange(blocks.filter((_, i) => i !== index));
  }

  return (
    <div className="block-canvas">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className={`block-canvas__slot${dropIndex === index && dragIndex !== index ? ' block-canvas__slot--over' : ''}`}
          draggable
          onDragStart={e => handleDragStart(e, index)}
          onDragEnter={e => handleDragEnter(e, index)}
          onDragOver={handleDragOver}
          onDrop={e => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
        >
          <Block
            block={block}
            onDelete={() => handleDelete(index)}
            isDragging={dragIndex === index}
            parentContext={parentContext}
            dragHandleProps={{
              // The entire slot is draggable; the handle is just visual
            }}
          />
        </div>
      ))}
    </div>
  );
}
