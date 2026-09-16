'use client';

import { useEffect } from 'react';
import type { DynamicAction, Effect } from '@/lib/design/page-document';
import { resolveDestination, type PageDestinations } from '@/lib/design/destinations';
import { record } from '@/lib/design/debug-client';

// The dynamic-action interpreter (APEX: Dynamic Actions, Phase 3 step 5): the
// declarative actions of a served row page, executed in the browser. Mounted by
// RowPageView after the regions, it finds each region by its `data-region`
// wrapper and binds the triggers: a click or a scroll-into-view on a region,
// the page loading, a timer. Effects show, hide or toggle a region (the HTML
// `hidden` attribute, which the stylesheet honours), scroll to one, or go to a
// destination from the catalogue. Nothing here evaluates code from a row: the
// document names regions and destination keys, and this file does the rest.

const regionEl = (root: ParentNode, id: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-region="${id}"]`);

/** Run one effect against the document; exported for the tests. A `go` to a
 *  row page resolves through the live pages the server handed over (P1.12 B2)
 *  and goes nowhere for a page not live. */
export function applyEffect(effect: Effect, root: ParentNode = document, pages?: PageDestinations): void {
  if (effect.action === 'go') {
    const dest = resolveDestination(effect.dest, pages);
    if (dest && dest.kind !== 'action') window.location.assign(dest.href);
    return;
  }
  const el = regionEl(root, effect.region);
  if (!el) return;
  switch (effect.action) {
    case 'show':
      el.hidden = false;
      break;
    case 'hide':
      el.hidden = true;
      break;
    case 'toggle':
      el.hidden = !el.hidden;
      break;
    case 'scroll-to': {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.hidden = false;
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      break;
    }
  }
}

/** Bind every action's trigger; returns the function that unbinds them all. */
export function bindActions(actions: readonly DynamicAction[], root: ParentNode = document, pages?: PageDestinations): () => void {
  const cleanups: (() => void)[] = [];
  // Each firing goes to the Debug panel's browser log (P1.9; APEX: which dynamic actions fired).
  const run = (a: DynamicAction) => {
    record(`action:${a.id}`, `${a.name || a.id} on ${a.when.event}: ${a.do.map(e => (e.action === 'go' ? `go ${e.dest}` : `${e.action} ${e.region}`)).join(', ')}`);
    a.do.forEach(e => applyEffect(e, root, pages));
  };
  record('bind', `${actions.length} dynamic action${actions.length === 1 ? '' : 's'} bound`);
  for (const a of actions) {
    const when = a.when;
    if (when.event === 'load') {
      run(a);
    } else if (when.event === 'timer') {
      const id = window.setInterval(() => run(a), when.seconds * 1000);
      cleanups.push(() => window.clearInterval(id));
    } else if (when.event === 'click') {
      const el = regionEl(root, when.region);
      if (!el) continue;
      // A sub region's wrapper sits inside its parent's (P1.4): a click inside the child is the child's alone.
      const handler = (e: Event) => {
        const target = e.target instanceof Element ? e.target.closest('[data-region]') : null;
        if (target && target !== el) return;
        run(a);
      };
      el.addEventListener('click', handler);
      el.style.cursor = 'pointer';
      cleanups.push(() => el.removeEventListener('click', handler));
    } else if (when.event === 'visible') {
      const el = regionEl(root, when.region);
      if (!el || typeof IntersectionObserver === 'undefined') continue;
      const observer = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          run(a);
          observer.disconnect();
        }
      });
      observer.observe(el);
      cleanups.push(() => observer.disconnect());
    }
  }
  return () => cleanups.forEach(c => c());
}

export function DynamicActions({ actions, pages }: { actions: readonly DynamicAction[]; pages?: PageDestinations }) {
  useEffect(() => {
    if (actions.length === 0) return;
    return bindActions(actions, document, pages);
  }, [actions, pages]);
  return null;
}
