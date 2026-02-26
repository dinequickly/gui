import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';

interface MiniActionStackProps {
  actions: string[];
}

function DotIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}

export function MiniActionStack({ item }: WidgetComponentProps) {
  const { actions } = item.props as unknown as MiniActionStackProps;

  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="mini-action-stack">
        {actions.map((action, idx) => (
          <button className="mini-action-item" key={`${action}-${idx}`}>
            <DotIcon />
            {action}
          </button>
        ))}
      </div>
    </GlassCardShell>
  );
}
