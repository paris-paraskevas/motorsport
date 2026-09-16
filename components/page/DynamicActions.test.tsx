// @vitest-environment jsdom
//
// The dynamic-action interpreter: effects against region wrappers, triggers
// bound and unbound, a missing region ignored, a destination followed.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyEffect, bindActions } from './DynamicActions';
import type { DynamicAction } from '@/lib/design/page-document';

function page(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `
    <div data-region="teaser">Teaser</div>
    <div data-region="more" hidden>The rest</div>
    <div data-region="open"><button type="button">Read more</button></div>`;
  document.body.appendChild(root);
  return root;
}
const el = (root: ParentNode, id: string) => root.querySelector<HTMLElement>(`[data-region="${id}"]`)!;

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, media: '', addEventListener() {}, removeEventListener() {} }));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('applyEffect', () => {
  it('shows, hides and toggles a region through the hidden attribute, scrolls to one, and ignores a region that is not there', () => {
    const root = page();
    applyEffect({ action: 'show', region: 'more' }, root);
    expect(el(root, 'more').hidden).toBe(false);
    applyEffect({ action: 'hide', region: 'more' }, root);
    expect(el(root, 'more').hidden).toBe(true);
    applyEffect({ action: 'toggle', region: 'more' }, root);
    expect(el(root, 'more').hidden).toBe(false);
    applyEffect({ action: 'scroll-to', region: 'teaser' }, root);
    expect(el(root, 'teaser').scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    expect(() => applyEffect({ action: 'show', region: 'nowhere' }, root)).not.toThrow();
  });

  it('goes to a route or an external destination and never to a fixed action', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    applyEffect({ action: 'go', dest: 'calendar' });
    expect(assign).toHaveBeenCalledWith('/calendar');
    applyEffect({ action: 'go', dest: 'external:support' });
    expect(assign).toHaveBeenCalledTimes(2);
    applyEffect({ action: 'go', dest: 'action:contact' });
    applyEffect({ action: 'go', dest: 'nope' });
    expect(assign).toHaveBeenCalledTimes(2);
  });

  it('goes to a row page through the pages it is given, and nowhere without them (P1.12 B2)', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const PAGE = 'a1b2c3d4-0000-4000-8000-000000000010';
    applyEffect({ action: 'go', dest: `page:${PAGE}` }, document, { [PAGE]: { path: '/history/monza', name: 'Monza, a history' } });
    expect(assign).toHaveBeenCalledWith('/history/monza');
    applyEffect({ action: 'go', dest: `page:${PAGE}` }, document);
    // The page deleted: the map the server hands over has no such id (the reviewer’s gap).
    applyEffect({ action: 'go', dest: `page:${PAGE}` }, document, {});
    expect(assign).toHaveBeenCalledTimes(1);
  });
});

describe('bindActions', () => {
  it('runs a load action at once, a click action on the region’s click, a timer every N seconds, and unbinds them all', () => {
    vi.useFakeTimers();
    const root = page();
    const actions: DynamicAction[] = [
      { id: 'a', name: '', when: { event: 'load' }, do: [{ action: 'hide', region: 'teaser' }] },
      { id: 'b', name: '', when: { event: 'click', region: 'open' }, do: [{ action: 'show', region: 'more' }, { action: 'hide', region: 'open' }] },
      { id: 'c', name: '', when: { event: 'timer', seconds: 10 }, do: [{ action: 'toggle', region: 'teaser' }] },
      { id: 'd', name: '', when: { event: 'click', region: 'nowhere' }, do: [{ action: 'show', region: 'more' }] },
    ];
    const unbind = bindActions(actions, root);
    expect(el(root, 'teaser').hidden).toBe(true);
    expect(el(root, 'open').style.cursor).toBe('pointer');
    el(root, 'open').querySelector('button')!.click();
    expect(el(root, 'more').hidden).toBe(false);
    expect(el(root, 'open').hidden).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(el(root, 'teaser').hidden).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(el(root, 'teaser').hidden).toBe(true);
    unbind();
    vi.advanceTimersByTime(10_000);
    expect(el(root, 'teaser').hidden).toBe(true);
    el(root, 'open').hidden = false;
    el(root, 'more').hidden = true;
    el(root, 'open').querySelector('button')!.click();
    expect(el(root, 'more').hidden).toBe(true);
  });

  it('runs a visible action once when the region scrolls into view', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let callback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          callback = cb;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
    const root = page();
    bindActions([{ id: 'v', name: '', when: { event: 'visible', region: 'teaser' }, do: [{ action: 'show', region: 'more' }] }], root);
    expect(observe).toHaveBeenCalledWith(el(root, 'teaser'));
    callback!([{ isIntersecting: false }]);
    expect(el(root, 'more').hidden).toBe(true);
    callback!([{ isIntersecting: true }]);
    expect(el(root, 'more').hidden).toBe(false);
    expect(disconnect).toHaveBeenCalled();
  });
});
