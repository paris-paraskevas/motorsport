// @vitest-environment jsdom
//
// The designer keeps the selected catalogue entry in the URL (`?sc=`), so a
// refresh reopens the same editor (operator, 2026-09-08: "upon refresh we
// should stay on the example page"). These cases pin that round trip: a click
// writes the URL, the crumb clears it, and the page's `?sc=` opens the entry.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: unknown; children: React.ReactNode }) => <a href={String(href)}>{children}</a>,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/designer',
  useRouter: () => ({ push() {}, replace() {}, prefetch() {} }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isSignedIn: false, isLoaded: true }),
  useUser: () => ({ user: null, isLoaded: true, isSignedIn: false }),
  SignedIn: () => null,
  SignedOut: () => null,
  UserButton: () => null,
}));
vi.mock('@/lib/betting/client', () => ({ isBettingConfigured: () => false, betDb: () => ({}) }));

import { Designer } from './Designer';
import { LIST_COPY } from './catalogue';
import { DEFAULT_NAV, type EditableList, type NavListKey } from '@/lib/design/lists';
import { TEXT_DEFAULTS, TEXT_KEYS } from '@/lib/design/text-defaults';
import { BUILD_OPTION_DEFAULTS, BUILD_OPTION_KEYS } from '@/lib/design/build-option-defaults';
import { SETTING_KEYS, SETTING_SPECS } from '@/lib/design/setting-defaults';
import type { EditableBuildOption } from '@/lib/design/build-options';
import type { EditableSetting } from '@/lib/design/settings';

const STAMP = '2026-09-08T08:33:32.994153+00:00';
const lists: Partial<Record<NavListKey, EditableList>> = {
  doors: { key: 'doors', role: 'menu', label: LIST_COPY.doors.title, updatedAt: STAMP, entries: DEFAULT_NAV.doors },
  bar: { key: 'bar', role: 'bar', label: LIST_COPY.bar.title, updatedAt: STAMP, entries: DEFAULT_NAV.bar },
  'footer-site': { key: 'footer-site', role: 'footer', label: LIST_COPY['footer-site'].title, updatedAt: STAMP, entries: DEFAULT_NAV.footerSite },
  'footer-legal': { key: 'footer-legal', role: 'footer', label: LIST_COPY['footer-legal'].title, updatedAt: STAMP, entries: DEFAULT_NAV.footerLegal },
};
const text = TEXT_KEYS.map(key => ({ key, text: TEXT_DEFAULTS[key].text, where: TEXT_DEFAULTS[key].where, updatedAt: STAMP }));
const options: EditableBuildOption[] = BUILD_OPTION_KEYS.map(key => ({
  key,
  label: BUILD_OPTION_DEFAULTS[key].label,
  status: 'include',
  updatedAt: STAMP,
}));
const settings: EditableSetting[] = SETTING_KEYS.map(key => ({
  key,
  value: SETTING_SPECS[key].shipped,
  description: SETTING_SPECS[key].description,
  updatedAt: STAMP,
}));
const loaded = { initialLists: lists, initialText: text, initialBuildOptions: options, initialSettings: settings, series: [] };

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/admin/designer');
});

describe('Designer keeps the selection in the URL', () => {
  it('opens the overview when the URL names nothing, and writes ?sc= when an entry is chosen', () => {
    render(<Designer readOnly={false} who="Test · Administrator · production" {...loaded} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Shared Components' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /^Build Options/ })[0]);
    expect(window.location.search).toBe('?sc=build');
    expect(screen.getByRole('heading', { level: 2, name: 'Build Options' })).toBeTruthy();
  });

  it('opens the entry the page hands over, and the crumb returns to the overview and clears the URL', () => {
    window.history.replaceState(null, '', '/admin/designer?sc=settings');
    render(<Designer readOnly={false} who="Test · Administrator · production" initialSelected="settings" {...loaded} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Application Settings' })).toBeTruthy();
    // The workspace tab carries the same words; the crumb is the one with the title.
    fireEvent.click(screen.getByTitle('Back to the overview'));
    expect(window.location.search).toBe('');
    expect(screen.getByRole('heading', { level: 2, name: 'Shared Components' })).toBeTruthy();
  });

  it('opens the overview for a key the catalogue does not know', () => {
    render(<Designer readOnly={false} who="Test · Administrator · production" initialSelected="no-such-entry" {...loaded} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Shared Components' })).toBeTruthy();
  });
});
