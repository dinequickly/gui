import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';
import { useNavigate } from 'react-router-dom';

interface VideoCardProps {
  title: string;
  subtitle: string;
  label: string;
  embedUrl?: string;
}

export function VideoCard({ item }: WidgetComponentProps) {
  const navigate = useNavigate();
  const { title, subtitle, label, embedUrl } = item.props as unknown as VideoCardProps;
  const canOpenTheater = Boolean(embedUrl);

  const openTheaterMode = () => {
    if (!embedUrl) return;
    const params = new URLSearchParams({
      embedUrl,
      title: title || 'Video content',
      subtitle: subtitle || '',
    });
    navigate(`/widgets/iframe-theater?${params.toString()}`);
  };

  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="video-card">
        <div className="video-card-head">
          <h3>{title}</h3>
          <button
            type="button"
            className="video-theater-btn"
            onClick={openTheaterMode}
            disabled={!canOpenTheater}
            aria-label="Open theater mode"
          >
            Theater mode
          </button>
        </div>
        <p>{subtitle}</p>
        <div className="video-frame">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={title || 'Video content'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <span>{label}</span>
          )}
        </div>
      </div>
    </GlassCardShell>
  );
}
