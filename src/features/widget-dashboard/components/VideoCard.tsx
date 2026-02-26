import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';

interface VideoCardProps {
  title: string;
  subtitle: string;
  label: string;
}

export function VideoCard({ item }: WidgetComponentProps) {
  const { title, subtitle, label } = item.props as unknown as VideoCardProps;

  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="video-card">
        <h3>{title}</h3>
        <p>{subtitle}</p>
        <div className="video-frame">
          <span>{label}</span>
        </div>
      </div>
    </GlassCardShell>
  );
}
