import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import waterlilies from '../../assets/waterlilies.webp';

export function IframeTheaterPage() {
  const navigate = useNavigate();
  const { search } = useLocation();

  const { embedUrl, title, subtitle } = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      embedUrl: params.get('embedUrl') ?? '',
      title: params.get('title') ?? 'Iframe Viewer',
      subtitle: params.get('subtitle') ?? '',
    };
  }, [search]);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        fontFamily: "'SF Pro Display', 'Plus Jakarta Sans', 'Segoe UI', sans-serif",
        background: '#cdd4de',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${waterlilies})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.2,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '100%',
          padding: '28px 20px 28px',
        }}
      >
        <div style={{ margin: '0 auto', width: 'min(99vw, 1680px)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              onClick={() => navigate('/widgets')}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.6)',
                background: 'rgba(245, 246, 250, 0.45)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                padding: '10px 16px',
                color: 'rgba(34, 37, 47, 0.82)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Back to widgets
            </button>
          </div>
          <div
            style={{
              borderRadius: 28,
              border: '1px solid rgba(255,255,255,0.55)',
              background: 'rgba(229, 234, 241, 0.55)',
              boxShadow:
                '0 14px 34px rgba(27, 33, 46, 0.14), inset 0 1px 0 rgba(255,255,255,0.58)',
              backdropFilter: 'blur(26px) saturate(1.18)',
              WebkitBackdropFilter: 'blur(26px) saturate(1.18)',
              padding: 'clamp(18px, 2.2vw, 34px) clamp(18px, 2.2vw, 36px) clamp(22px, 2.8vw, 42px)',
            }}
          >
            <h1
              style={{
                margin: 0,
                color: '#0f1117',
                fontSize: 'clamp(34px, 4.1vw, 62px)',
                lineHeight: 0.95,
                letterSpacing: '-0.045em',
                fontWeight: 700,
              }}
            >
              {title}
            </h1>
            {subtitle ? (
              <p
                style={{
                  margin: '8px 0 0',
                  color: 'rgba(73, 79, 95, 0.72)',
                  fontSize: 'clamp(15px, 1.4vw, 22px)',
                }}
              >
                {subtitle}
              </p>
            ) : null}
            <div
              style={{
                marginTop: 'clamp(16px, 2vw, 34px)',
                borderRadius: 30,
                overflow: 'hidden',
                minHeight: 'min(62vh, 760px)',
                background:
                  'linear-gradient(140deg, rgba(255,129,141,0.84), rgba(255,110,0,0.82), rgba(161,196,222,0.78), rgba(255,96,121,0.86))',
              }}
            >
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  style={{
                    width: '100%',
                    minHeight: 'min(62vh, 760px)',
                    height: '100%',
                    border: 0,
                    display: 'block',
                  }}
                />
              ) : (
                <div style={{ minHeight: 'min(62vh, 760px)', display: 'grid', placeItems: 'center', fontSize: 18 }}>
                  No iframe URL provided.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
