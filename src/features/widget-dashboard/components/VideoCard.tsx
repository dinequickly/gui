import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';

interface VideoCardProps {
  title: string;
  label: string;
  embedUrl?: string;
}

const NON_OVERVIEW_VIDEO_WIDTH = 1030;

export function VideoCard({ item }: WidgetComponentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { title, label, embedUrl } = item.props as unknown as VideoCardProps;
  const canOpenTheater = Boolean(embedUrl);
  const isNonOverviewView = location.pathname.startsWith('/widgets/view/');

  const openTheaterMode = () => {
    if (!embedUrl) return;
    const params = new URLSearchParams({
      embedUrl,
      title: title || 'Video content',
    });
    navigate(`/widgets/iframe-theater?${params.toString()}`);
  };

  return (
    <GlassCardShell width={isNonOverviewView ? NON_OVERVIEW_VIDEO_WIDTH : item.width} height={item.height}>
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
        <div className={`video-frame ${embedUrl ? 'has-iframe' : ''}`}>
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={title || 'Video content'}
              loading="lazy"
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
