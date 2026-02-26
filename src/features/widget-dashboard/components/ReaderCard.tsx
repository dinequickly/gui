import { GlassCardShell } from './GlassCardShell';
import { useNavigate } from 'react-router-dom';
import type { WidgetComponentProps } from '../types';

interface ReaderCardProps {
  subtitle: string;
  title: string;
  body: string;
  cta: string;
  fileId?: string;
}

export function ReaderCard({ item }: WidgetComponentProps) {
  const navigate = useNavigate();
  const { subtitle, title, body, cta, fileId } = item.props as unknown as ReaderCardProps;

  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="reader-card">
        <p className="subtitle">{subtitle}</p>
        <h3>{title}</h3>
        <p className="body">{body}</p>
        <button className="reader-cta dashboard-liquid-btn" onClick={() => navigate(fileId ? `/page?fileId=${fileId}` : '/page')}>
          {cta}
        </button>
      </div>
    </GlassCardShell>
  );
}
