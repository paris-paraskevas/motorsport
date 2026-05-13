export const TABS = [
  { key: 'calendar',  label: 'Calendar' },
  { key: 'news',      label: 'News' },
  { key: 'standings', label: 'Standings' },
  { key: 'results',   label: 'Results' },
  { key: 'drivers',   label: 'Drivers & Teams' },
  { key: 'rules',     label: 'Rules' },
  { key: 'about',     label: 'About' },
  { key: 'history',   label: 'History' },
  { key: 'champions', label: 'Champions' },
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
