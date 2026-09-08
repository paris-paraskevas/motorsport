import type { NavListKey } from '@/lib/design/lists';

// The Shared Components catalogue, APEX's ten groups mapped to what Paddock has
// (Paddock Designer Field Guide §02). Every entry is listed so the operator sees
// the whole shape from day one; only the four navigation lists are editable in
// Phase 2 step 2, and the rest say when they arrive rather than pretend.

export interface CatalogueItem {
  key: string;
  label: string;
  /** Set when the item is one of the navigation lists the editor can open. */
  listKey?: NavListKey;
  /** Set when the item opens another editor of its own. */
  editor?: 'text';
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
      { key: 'settings', label: 'Application Settings', later: 'Phase 2, later' },
      { key: 'build', label: 'Build Options', later: 'Phase 2, later' },
    ],
  },
  {
    group: 'Security',
    items: [
      { key: 'secattrs', label: 'Security Attributes', later: 'read-only, later' },
      { key: 'auth', label: 'Authentication Schemes', later: 'read-only, later' },
      { key: 'authz', label: 'Authorization Schemes', later: 'Phase 2, later' },
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
      { key: 'shortcuts', label: 'Shortcuts', later: 'Phase 2, later' },
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
      { key: 'uiattrs', label: 'User Interface Attributes', later: 'Phase 2, later' },
      { key: 'pwa', label: 'Progressive Web App', later: 'Phase 6' },
      { key: 'themes', label: 'Themes', later: 'Phase 2, later' },
      { key: 'templates', label: 'Templates', later: 'read-only, later' },
      { key: 'email', label: 'Email Templates', later: 'Phase 6' },
      { key: 'maps', label: 'Map Backgrounds', later: 'Phase 6' },
    ],
  },
  {
    group: 'Files and Reports',
    items: [
      { key: 'files', label: 'Static Application Files', later: 'Phase 2, later' },
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

/** The authorization schemes an entry may name. Mirrors the rows migration
 *  20260908090000 seeded; the Authorization Schemes editor reads them from the
 *  table when it arrives. */
export const SCHEMES: { key: string; label: string }[] = [
  { key: '', label: 'Public' },
  { key: 'signed_in', label: 'Signed in' },
  { key: 'contributor', label: 'Contributor' },
  { key: 'administrator', label: 'Administrator' },
];
