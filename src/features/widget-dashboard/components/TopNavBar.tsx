import type { WidgetComponentProps } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { activeLabelForPath, pathForTopNavLabel, slugifyView } from '../viewRoutes';

interface TopNavProps {
  items: string[];
  active: string;
}

function nextAutoViewName(existingItems: string[]): string {
  const normalized = new Set(existingItems.map((item) => item.trim().toLowerCase()));
  if (!normalized.has('new view')) return 'New View';
  let suffix = 2;
  while (normalized.has(`new view ${suffix}`)) suffix += 1;
  return `New View ${suffix}`;
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
  const visibleItems = items?.length ? items : ['Overview'];

  const createNewView = () => {
    const name = nextAutoViewName(visibleItems);
    navigate(`/widgets/view/${slugifyView(name)}`);
  };

  return (
    <nav className="dashboard-top-nav">
      {visibleItems.map((label) => (
        <span key={label} className="dashboard-top-nav-pill">
          <button
            className={label === activeLabel ? 'is-active' : ''}
            onClick={() => navigate(pathForTopNavLabel(label))}
            type="button"
          >
            {label}
          </button>
        </span>
      ))}
      <button
        type="button"
        className="dashboard-top-nav-add dashboard-top-nav-add-fixed"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          createNewView();
        }}
        aria-label="Add new view"
        title="Add new view"
      >
        +
      </button>
      <span className="search">
        <SearchIcon />
      </span>
    </nav>
  );
}
