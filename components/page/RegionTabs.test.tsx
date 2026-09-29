// @vitest-environment jsdom
//
// The Tabs strip (P2.10; APEX: Region Display Selector) in the browser: a tab shows its region and hides the others in View
// Single Region, Show all shows every one, the choice is remembered where the setting says, Scroll Window hides nothing and
// scrolls to the region.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegionTabs, type RegionTab } from './RegionTabs';

const TABS: RegionTab[] = [
  { id: 'preview', label: 'Preview', icon: 'flag' },
  { id: 'report', label: 'Report' },
];
const KEY = 'paddock:tabs:/history/monza:tabs';
const region = (id: string) => document.querySelector<HTMLElement>(`[data-region="${id}"]`)!;
const tab = (name: string) => screen.getByRole('tab', { name });

function mount(over: Partial<Parameters<typeof RegionTabs>[0]> = {}) {
  // The regions as RowPageView draws them: wrappers by id, the second hidden before the page leaves the server (applyTabs).
  document.body.innerHTML = '<div id="region-preview" data-region="preview">Before</div><div id="region-report" data-region="report" hidden>After</div>';
  const host = document.createElement('div');
  document.body.prepend(host);
  return render(<RegionTabs tabs={TABS} mode="single" showAll={true} remember="browser" storageKey={KEY} icons={false} {...over} />, { container: host });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  // jsdom has neither; the strip asks the reduced-motion query before a scroll, as the interpreter does.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('RegionTabs', () => {
  it('lists Show all and the tabs with APEX’s roles, the first selected; a click shows its region, hides the others and remembers the choice in this browser', () => {
    mount();
    const list = screen.getByRole('tablist', { name: 'Sections' });
    expect(list.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(tab('Preview').getAttribute('aria-selected')).toBe('true');
    expect(tab('Preview').getAttribute('aria-controls')).toBe('region-preview');
    expect(tab('Show all').getAttribute('aria-controls')).toBeNull();
    fireEvent.click(tab('Report'));
    expect(tab('Report').getAttribute('aria-selected')).toBe('true');
    expect(tab('Preview').getAttribute('aria-selected')).toBe('false');
    expect(region('report').hidden).toBe(false);
    expect(region('preview').hidden).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe('report');
    fireEvent.click(tab('Show all'));
    expect(region('report').hidden).toBe(false);
    expect(region('preview').hidden).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe('all');
  });

  it('restores the remembered tab after mount from this browser or this visit, ignores one no tab carries, and stores nothing under No', async () => {
    window.localStorage.setItem(KEY, 'report');
    await act(async () => {
      mount();
    });
    expect(tab('Report').getAttribute('aria-selected')).toBe('true');
    expect(region('report').hidden).toBe(false);
    expect(region('preview').hidden).toBe(true);
    cleanup();
    window.localStorage.setItem(KEY, 'gone');
    await act(async () => {
      mount();
    });
    expect(tab('Preview').getAttribute('aria-selected')).toBe('true');
    expect(region('report').hidden).toBe(true);
    cleanup();
    window.sessionStorage.setItem(KEY, 'report');
    await act(async () => {
      mount({ remember: 'visit' });
    });
    expect(tab('Report').getAttribute('aria-selected')).toBe('true');
    cleanup();
    mount({ remember: 'no' });
    fireEvent.click(tab('Report'));
    expect(window.localStorage.getItem(KEY)).toBe('gone');
    expect(window.sessionStorage.getItem(KEY)).toBe('report');
  });

  it('Scroll Window hides nothing, offers no Show all, and a tab scrolls its region into view; the icons draw before the names when asked', () => {
    mount({ mode: 'scroll', icons: true });
    region('report').hidden = false;
    expect(screen.queryByRole('tab', { name: 'Show all' })).toBeNull();
    expect(tab('Preview').querySelector('svg')).not.toBeNull();
    expect(tab('Report').querySelector('svg')).toBeNull();
    fireEvent.click(tab('Report'));
    expect(region('preview').hidden).toBe(false);
    expect(region('report').hidden).toBe(false);
    expect(tab('Report').getAttribute('aria-selected')).toBe('true');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('draws nothing with fewer than two tabs', () => {
    const { container } = mount({ tabs: [TABS[0]] });
    expect(container.innerHTML).toBe('');
  });
});
