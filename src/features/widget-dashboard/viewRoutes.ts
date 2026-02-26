export const WIDGET_VIEW_SLOTS = [
  { label: 'AM Brief', slug: 'am-brief' },
  { label: 'News', slug: 'news' },
  { label: "To-Do's", slug: 'todos' },
] as const;

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

export function resolveSlotSlug(input: string): string | null {
  const text = normalize(input);
  if (!text) return null;
  if (text.includes('am brief') || text.includes('brief')) return 'am-brief';
  if (text.includes('news')) return 'news';
  if (text.includes("to-do") || text.includes('todo') || text.includes('tasks')) return 'todos';

  for (const slot of WIDGET_VIEW_SLOTS) {
    if (normalize(slot.label) === text) return slot.slug;
  }
  return null;
}

export function labelFromViewSlug(slug: string): string {
  const cleanSlug = normalize(slug);
  const known = WIDGET_VIEW_SLOTS.find((slot) => slot.slug === cleanSlug);
  if (known) return known.label;

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

  const slotOrder = new Map<string, number>(WIDGET_VIEW_SLOTS.map((slot, index) => [slot.slug, index]));
  custom.sort((a, b) => {
    const aSlot = slotOrder.get(a.slug);
    const bSlot = slotOrder.get(b.slug);
    if (aSlot != null && bSlot != null) return aSlot - bSlot;
    if (aSlot != null) return -1;
    if (bSlot != null) return 1;
    return a.label.localeCompare(b.label);
  });

  return ['Overview', ...custom.map((entry) => entry.label)];
}

export function pathForTopNavLabel(label: string): string {
  const text = normalize(label);
  if (text === 'overview') return '/widgets';

  const slot = resolveSlotSlug(label);
  if (slot) return `/widgets/view/${slot}`;

  return `/widgets/view/${slugifyView(label)}`;
}

export function activeLabelForPath(pathname: string): string {
  if (pathname === '/widgets') return 'Overview';
  if (pathname.startsWith('/widgets/view/am-brief')) return 'AM Brief';
  if (pathname.startsWith('/widgets/view/news')) return 'News';
  if (pathname.startsWith('/widgets/view/todos')) return "To-Do's";
  return '';
}
