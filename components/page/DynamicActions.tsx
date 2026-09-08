'use client';

import { useEffect } from 'react';
import type { DynamicAction, Effect } from '@/lib/design/page-document';
import { resolveDestination } from '@/lib/design/destinations';

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

/** Run one effect against the document; exported for the tests. */
export function applyEffect(effect: Effect, root: ParentNode = document): void {
  if (effect.action === 'go') {
    const dest = resolveDestination(effect.dest);
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
export function bindActions(actions: readonly DynamicAction[], root: ParentNode = document): () => void {
  const cleanups: (() => void)[] = [];
  const run = (a: DynamicAction) => a.do.forEach(e => applyEffect(e, root));
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
      const handler = () => run(a);
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

export function DynamicActions({ actions }: { actions: readonly DynamicAction[] }) {
  useEffect(() => {
    if (actions.length === 0) return;
    return bindActions(actions);
  }, [actions]);
  return null;
}
