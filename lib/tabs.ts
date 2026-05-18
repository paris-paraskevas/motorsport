export const TABS = [
  { key: 'calendar',  label: 'Calendar' },
  { key: 'news',      label: 'News' },
  { key: 'standings', label: 'Standings' },
  { key: 'results',   label: 'Results' },
  { key: 'drivers',   label: 'Drivers' },
  { key: 'rules',     label: 'Rules' },
  { key: 'about',     label: 'About' },
  { key: 'history',   label: 'History' },
  { key: 'champions', label: 'Champions' },
] as const;

export type TabKey = typeof TABS[number]['key'];

/** Tabs that make sense for a single-event series (one annual race,
 *  not a championship). Standings / Results / Drivers / News don't apply. */
export const SINGLE_EVENT_TAB_KEYS = ['calendar', 'about', 'history', 'champions'] as const;

export function tabsFor(singleEvent: boolean | undefined): typeof TABS[number][] {
  if (!singleEvent) return [...TABS];
  return TABS.filter(t => (SINGLE_EVENT_TAB_KEYS as readonly string[]).includes(t.key));
}

export function resolveTab(value: string | string[] | undefined, singleEvent?: boolean): TabKey {
  const v = Array.isArray(value) ? value[0] : value;
  const allowed = tabsFor(singleEvent);
  const match = allowed.find(t => t.key === v);
  return match?.key ?? 'calendar';
}

export function labelForTab(key: TabKey): string {
  return TABS.find(t => t.key === key)?.label ?? '';
}
