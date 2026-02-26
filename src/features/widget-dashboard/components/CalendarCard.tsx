import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';

interface CalendarProps {
  title: string;
  description: string;
  items: string[];
}

function CheckboxIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="4" />
    </svg>
  );
}

export function CalendarCard({ item }: WidgetComponentProps) {
  const { title, description, items } = item.props as unknown as CalendarProps;

  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="calendar-card">
        <h3>{title}</h3>
        <p className="description">{description}</p>
        <div className="calendar-actions">
          {items.map((action, idx) => (
            <button key={`${action}-${idx}`} className="calendar-action-btn">
              <CheckboxIcon />
              {action}
            </button>
          ))}
        </div>
      </div>
    </GlassCardShell>
  );
}
