import type { WidgetComponentProps } from '../types';
import { GlassCardShell } from './GlassCardShell';

interface QuickActionsProps {
  actions: string[];
}

function MiniIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 6h14M5 12h14M5 18h8" strokeLinecap="round" />
    </svg>
  );
}

export function QuickActionsGrid({ item }: WidgetComponentProps) {
  const { actions } = item.props as unknown as QuickActionsProps;
  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="quick-actions-grid">
        {actions.map((action, idx) => (
          <button key={`${action}-${idx}`} className="quick-action-pill">
            <MiniIcon />
            {action}
          </button>
        ))}
      </div>
    </GlassCardShell>
  );
}
