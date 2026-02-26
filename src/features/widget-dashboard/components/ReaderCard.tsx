import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';

interface ReaderCardProps {
  subtitle: string;
  title: string;
  body: string;
  cta: string;
}

export function ReaderCard({ item }: WidgetComponentProps) {
  const { subtitle, title, body, cta } = item.props as unknown as ReaderCardProps;

  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="reader-card">
        <p className="subtitle">{subtitle}</p>
        <h3>{title}</h3>
        <p className="body">{body}</p>
        <button className="reader-cta dashboard-liquid-btn">{cta}</button>
      </div>
    </GlassCardShell>
  );
}
