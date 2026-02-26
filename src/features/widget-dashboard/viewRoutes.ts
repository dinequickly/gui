function normalize(input: string): string {
  return input.trim().toLowerCase();
}

export function slugifyView(input: string): string {
  const slug = normalize(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || `view-${Math.floor(Date.now() / 1000)}`;
}

export function labelFromViewSlug(slug: string): string {
  const cleanSlug = normalize(slug);

  return cleanSlug
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ') || 'Untitled View';
}

export function labelFromDashboardKey(dashboardKey: string): string {
  if (dashboardKey === 'dashboard-2') return 'Overview';
  if (dashboardKey.startsWith('dashboard-view-')) {
    return labelFromViewSlug(dashboardKey.replace('dashboard-view-', ''));
  }
  return 'Overview';
}

export function navItemsFromDashboardKeys(dashboardKeys: string[]): string[] {
  const custom = dashboardKeys
    .filter((key) => key.startsWith('dashboard-view-'))
    .map((key) => key.replace('dashboard-view-', ''))
    .map((slug) => ({ slug, label: labelFromViewSlug(slug) }));

  custom.sort((a, b) => {
    return a.label.localeCompare(b.label);
  });

  return ['Overview', ...custom.map((entry) => entry.label)];
}

export function pathForTopNavLabel(label: string): string {
  const text = normalize(label);
  if (text === 'overview') return '/widgets';
  return `/widgets/view/${slugifyView(label)}`;
}

export function activeLabelForPath(pathname: string): string {
  if (pathname === '/widgets') return 'Overview';
  const viewMatch = pathname.match(/^\/widgets\/view\/([^/?#]+)/);
  if (viewMatch?.[1]) return labelFromViewSlug(decodeURIComponent(viewMatch[1]));
  return '';
}
