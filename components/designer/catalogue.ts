import type { NavListKey } from '@/lib/design/lists';

// The Shared Components catalogue, APEX's ten groups mapped to what Paddock has
// (Paddock Designer Field Guide §02). Every entry is listed so the operator sees
// the whole shape from day one; the four navigation lists (Phase 2 step 2), Text
// Messages (step 3), Build Options (step 4), Application Settings (step 5),
// Authorization Schemes (step 6), Themes (step 7), Appearance (step 8, APEX's
// User Interface Attributes), Shortcuts (step 9) and Assets (step 10, APEX's
// Static Application Files) are editable, and the rest say when they arrive
// rather than pretend.

export interface CatalogueItem {
  key: string;
  label: string;
  /** Set when the item is one of the navigation lists the editor can open. */
  listKey?: NavListKey;
  /** Set when the item opens another editor of its own. */
  editor?: 'text' | 'build' | 'settings' | 'authz' | 'themes' | 'appearance' | 'shortcuts' | 'assets';
  /** When an item is not editable yet: the phase that brings it, or why it never will be. */
  later?: string;
}

export interface CatalogueGroup {
  group: string;
  items: CatalogueItem[];
}

export const CATALOGUE: CatalogueGroup[] = [
  {
    group: 'Application Logic',
    items: [
      { key: 'appdef', label: 'Application Definition', later: 'Phase 2, later' },
      { key: 'appitems', label: 'Application Items', later: 'read-only, later' },
      { key: 'appprocs', label: 'Application Processes', later: 'read-only, later' },
      { key: 'appcomps', label: 'Application Computations', later: 'Phase 3' },
      { key: 'settings', label: 'Application Settings', editor: 'settings' },
      { key: 'build', label: 'Build Options', editor: 'build' },
    ],
  },
  {
    group: 'Security',
    items: [
      { key: 'secattrs', label: 'Security Attributes', later: 'read-only, later' },
      { key: 'auth', label: 'Authentication Schemes', later: 'read-only, later' },
      { key: 'authz', label: 'Authorization Schemes', editor: 'authz' },
      { key: 'access', label: 'Application Access Control', later: 'read-only, later' },
      { key: 'session', label: 'Session Management', later: 'read-only, later' },
    ],
  },
  {
    group: 'Other Components',
    items: [
      { key: 'lovs', label: 'Lists of Values', later: 'read-only, later' },
      { key: 'plugins', label: 'Plug-ins', later: 'read-only, later' },
      { key: 'compsettings', label: 'Component Settings', later: 'Phase 3' },
      { key: 'shortcuts', label: 'Shortcuts', editor: 'shortcuts' },
      { key: 'dataload', label: 'Data Load Definitions', later: 'read-only, later' },
    ],
  },
  {
    group: 'Navigation and Search',
    items: [
      { key: 'lists', label: 'Lists', later: 'Phase 3' },
      { key: 'doors', label: 'Navigation Menu', listKey: 'doors' },
      { key: 'breadcrumbs', label: 'Breadcrumbs', later: 'derived, never edited' },
      { key: 'bar', label: 'Navigation Bar List', listKey: 'bar' },
      { key: 'footer-site', label: 'Footer: Site', listKey: 'footer-site' },
      { key: 'footer-legal', label: 'Footer: Legal', listKey: 'footer-legal' },
      { key: 'search', label: 'Search Configurations', later: 'Phase 6' },
    ],
  },
  {
    group: 'User Interface',
    items: [
      { key: 'appearance', label: 'Appearance', editor: 'appearance' },
      { key: 'pwa', label: 'Progressive Web App', later: 'Phase 6' },
      { key: 'themes', label: 'Themes', editor: 'themes' },
      { key: 'templates', label: 'Templates', later: 'read-only, later' },
      { key: 'email', label: 'Email Templates', later: 'Phase 6' },
      { key: 'maps', label: 'Map Backgrounds', later: 'Phase 6' },
    ],
  },
  {
    group: 'Files and Reports',
    items: [
      { key: 'assets', label: 'Assets', editor: 'assets' },
      { key: 'reports', label: 'Report Layouts', later: 'read-only, later' },
      { key: 'queries', label: 'Report Queries', later: 'read-only, later' },
    ],
  },
  {
    group: 'Data Sources',
    items: [
      { key: 'data', label: 'REST Data Sources', later: 'read-only, later' },
      { key: 'json', label: 'JSON Sources', later: 'Phase 4' },
    ],
  },
  {
    group: 'Workflows and Automations',
    items: [
      { key: 'tasks', label: 'Task Definitions', later: 'Phase 6' },
      { key: 'automations', label: 'Automations', later: 'Phase 6' },
      { key: 'workflows', label: 'Workflows', later: 'read-only, later' },
    ],
  },
  {
    group: 'Globalization',
    items: [
      { key: 'glob', label: 'Globalization Attributes', later: 'read-only, later' },
      { key: 'textmsgs', label: 'Text Messages', editor: 'text' },
    ],
  },
];

/** What the editor says above each list. */
export const LIST_COPY: Record<NavListKey, { title: string; sub: string }> = {
  doors: {
    title: 'Navigation Menu',
    sub: 'The doors in the header on desktop and laptop. Phones use the Navigation Bar List instead.',
  },
  bar: {
    title: 'Navigation Bar List',
    sub: 'The phone bar: three to five cells, always visible on phones. Desktop and laptop use the Navigation Menu.',
  },
  'footer-site': {
    title: 'Footer: Site',
    sub: 'The first column of the footer on every page.',
  },
  'footer-legal': {
    title: 'Footer: Legal',
    sub: 'The second column of the footer on every page.',
  },
};
