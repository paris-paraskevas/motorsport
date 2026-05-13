export const TABS = [
  { key: 'calendar',  label: 'Calendar' },
  { key: 'about',     label: 'About' },
  { key: 'history',   label: 'History' },
  { key: 'drivers',   label: 'Drivers & Teams' },
  { key: 'rules',     label: 'Rules' },
  { key: 'champions', label: 'Champions' },
  { key: 'standings', label: 'Standings' },
  { key: 'results',   label: 'Results' },
  { key: 'news',      label: 'News' },
] as const;

export type TabKey = typeof TABS[number]['key'];

export function resolveTab(value: string | string[] | undefined): TabKey {
  const v = Array.isArray(value) ? value[0] : value;
  const match = TABS.find(t => t.key === v);
  return match?.key ?? 'calendar';
}

export function labelForTab(key: TabKey): string {
  return TABS.find(t => t.key === key)?.label ?? '';
}
