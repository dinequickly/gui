import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';

interface SourceLinkCardProps {
  source: string;
  title: string;
  url: string;
  cta?: string;
  iconUrl?: string;
}

function normalizeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function buildFaviconUrl(url: string): string {
  const host = normalizeHost(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

export function SourceLinkCard({ item }: WidgetComponentProps) {
  const props = item.props as unknown as Partial<SourceLinkCardProps>;
  const url = (props.url ?? '').trim();
  const source = (props.source ?? normalizeHost(url)).trim();
  const title = (props.title ?? 'Source').trim();
  const cta = (props.cta ?? 'Open Link').trim();
  const iconUrl = (props.iconUrl ?? buildFaviconUrl(url)).trim();
  const canOpen = Boolean(url);

  return (
    <GlassCardShell width={item.width} height={item.height}>
      <article className="source-link-card">
        <div className="source-link-copy">
          <p className="source-link-host">{source}</p>
          <h3 className="source-link-title">{title}</h3>
          <a
            className={`source-link-cta dashboard-liquid-btn ${canOpen ? '' : 'is-disabled'}`}
            href={canOpen ? url : undefined}
            target={canOpen ? '_blank' : undefined}
            rel={canOpen ? 'noreferrer' : undefined}
            aria-disabled={!canOpen}
            onClick={(event) => {
              if (!canOpen) event.preventDefault();
            }}
          >
            + {cta}
          </a>
        </div>
        <div className="source-link-logo-wrap">
          {iconUrl ? <img src={iconUrl} alt="" className="source-link-logo" /> : null}
        </div>
      </article>
    </GlassCardShell>
  );
}
