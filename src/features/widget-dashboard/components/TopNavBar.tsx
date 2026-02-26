import type { WidgetComponentProps } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { activeLabelForPath, pathForTopNavLabel } from '../viewRoutes';

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
  const navigate = useNavigate();
  const location = useLocation();
  const { items, active } = item.props as unknown as TopNavProps;
  const routeActive = activeLabelForPath(location.pathname);
  const activeLabel = routeActive || active;

  return (
    <nav className="dashboard-top-nav">
      {items.map((label) => (
        <button
          key={label}
          className={label === activeLabel ? 'is-active' : ''}
          onClick={() => navigate(pathForTopNavLabel(label))}
          type="button"
        >
          {label}
        </button>
      ))}
      <span className="search">
        <SearchIcon />
      </span>
    </nav>
  );
}
