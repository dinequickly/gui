import type { WidgetComponentProps } from '../types';

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 16V4" strokeLinecap="round" />
      <path d="m7 9 5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="12" width="16" height="8" rx="2" />
    </svg>
  );
}

export function TopCornerIcons(_: WidgetComponentProps) {
  return (
    <div className="dashboard-top-icons">
      <button aria-label="Documents">
        <DocIcon />
      </button>
      <button aria-label="Share">
        <ShareIcon />
      </button>
    </div>
  );
}
