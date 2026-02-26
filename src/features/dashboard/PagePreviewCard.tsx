import React from 'react';
import type { PagePreview } from '../../shared/types';
import { Icon } from '../../shared/components/Icon';

interface Props {
  preview: PagePreview;
}

export function PagePreviewCard({ preview }: Props) {
  const { file, snippet, imageUrl } = preview;

  return (
    <div>
      {/* Cover image or placeholder */}
      {imageUrl ? (
        <div style={{ height: 120, overflow: 'hidden' }}>
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      ) : (
        <div style={{ height: 64, background: 'linear-gradient(135deg, #f0f0ef 0%, #e8e8e6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
          <Icon name="file" size={24} />
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Page</span>
          <span style={{ fontSize: 10, color: '#ccc' }}>·</span>
          <span style={{ fontSize: 11, color: '#aaa' }}>{file.author}</span>
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px', color: '#1a1a1a', lineHeight: 1.3 }}>
          {file.title || 'Untitled'}
        </h3>
        {snippet && (
          <p style={{ fontSize: 12, color: '#888', margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'] }}>
            {snippet}
          </p>
        )}
        {file.tags?.length ? (
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            {file.tags.map(t => (
              <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#f0f0ef', color: '#777' }}>#{t}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
