import type { WidgetComponentProps } from '../types';

interface TopNavProps {
  items: string[];
  active: string;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

export function TopNavBar({ item }: WidgetComponentProps) {
  const { items, active } = item.props as unknown as TopNavProps;

  return (
    <nav className="dashboard-top-nav" style={{ width: item.width }}>
      {items.map((label) => (
        <button key={label} className={label === active ? 'is-active' : ''}>{label}</button>
      ))}
      <span className="search">
        <SearchIcon />
      </span>
    </nav>
  );
}
