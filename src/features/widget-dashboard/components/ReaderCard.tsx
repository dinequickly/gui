import type { ReactNode } from 'react';
import { GlassCardShell } from './GlassCardShell';
import { useLocation, useNavigate } from 'react-router-dom';
import type { WidgetComponentProps } from '../types';

const READER_PREVIEW_MAX_CHARS = 400;

interface ReaderCardProps {
  subtitle: string;
  title: string;
  body: string;
  cta: string;
  fileId?: string;
  linkUrl?: string;
}

function renderInlineRichText(input: string, keyPrefix: string): ReactNode[] {
  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  for (const match of input.matchAll(tokenPattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(input.slice(cursor, start));

    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b-${tokenIndex}`}>{token.slice(2, -2)}</strong>);
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      nodes.push(<em key={`${keyPrefix}-i-${tokenIndex}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(<code key={`${keyPrefix}-c-${tokenIndex}`}>{token.slice(1, -1)}</code>);
    } else {
      nodes.push(token);
    }

    cursor = start + token.length;
    tokenIndex += 1;
  }

  if (cursor < input.length) nodes.push(input.slice(cursor));
  return nodes;
}

function normalizePreviewText(text: string): string {
  return text
    .replace(/\s-\s(?=\*\*)/g, '\n- ')
    .replace(/\s•\s/g, '\n• ');
}

function renderPreviewBody(text: string): ReactNode[] {
  const normalized = normalizePreviewText(text);
  const lines = normalized.split('\n');
  const nodes: ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    const lineKey = `line-${index}`;

    if (trimmed.startsWith('- ')) {
      nodes.push(<span key={`${lineKey}-bullet`}>- </span>);
      nodes.push(...renderInlineRichText(trimmed.slice(2), `${lineKey}-content`));
    } else if (trimmed.startsWith('• ')) {
      nodes.push(<span key={`${lineKey}-dot`}>• </span>);
      nodes.push(...renderInlineRichText(trimmed.slice(2), `${lineKey}-content`));
    } else {
      nodes.push(...renderInlineRichText(trimmed, `${lineKey}-content`));
    }

    if (index < lines.length - 1) nodes.push(<br key={`${lineKey}-br`} />);
  }

  return nodes;
}

export function ReaderCard({ item }: WidgetComponentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { subtitle, title, body, cta, fileId, linkUrl } = item.props as unknown as ReaderCardProps;
  const previewBody = body.length > READER_PREVIEW_MAX_CHARS
    ? `${body.slice(0, READER_PREVIEW_MAX_CHARS).trimEnd()}...`
    : body;

  const hasTarget = Boolean((fileId && fileId.trim()) || (linkUrl && linkUrl.trim()));
  const dashboardKey = location.pathname.startsWith('/widgets/view/')
    ? `dashboard-view-${decodeURIComponent(location.pathname.replace('/widgets/view/', ''))}`
    : 'dashboard-2';

  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="reader-card">
        <p className="subtitle">{subtitle}</p>
        <h3>{title}</h3>
        <p className="body">{renderPreviewBody(previewBody)}</p>
        <button
          className="reader-cta dashboard-liquid-btn"
          disabled={!hasTarget}
          onClick={() => {
            if (fileId) {
              navigate(`/page?fileId=${encodeURIComponent(fileId)}&dashboardKey=${encodeURIComponent(dashboardKey)}`);
              return;
            }
            if (linkUrl) {
              window.open(linkUrl, '_blank', 'noopener');
            }
          }}
        >
          {cta}
        </button>
      </div>
    </GlassCardShell>
  );
}
