'use client';

import { useEffect, useState } from 'react';

// Show Landmarks and Show Headings (P1.13; APEX: the Developer Toolbar's Info
// menu, its third and fourth entries: landmarks "identify the structure of the
// application", headings "view headings on the current page"). Ours outline
// the page's landmarks (the HTML-AAM implicit roles and the ARIA landmark
// roles) or its headings, a label on each, as fixed boxes over the running
// page, the way Show Layout Columns draws its grid and Quick Edit its outline.
// Collected when the overlay opens, measured again on scroll and resize; the
// toolbar's own elements never count. Loaded on demand by the toolbar.

export type OutlineKind = 'landmarks' | 'headings';

const LABEL = 'bg-brand px-1.5 py-0.5 font-mono text-9 uppercase tracking-[0.12em] text-bg';
const IMPLICIT: Record<string, string> = { header: 'banner', nav: 'navigation', main: 'main', aside: 'complementary', footer: 'contentinfo', form: 'form', section: 'region' };
const LANDMARKS = 'header, nav, main, aside, footer, form, section, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="search"], [role="region"], [role="form"]';
const HEADINGS = 'h1, h2, h3, h4, h5, h6';
/** A header or footer inside these is no landmark (HTML-AAM). */
const SECTIONING = 'article, aside, main, nav, section';
const LABEL_MAX = 40;

export interface Outlined {
  el: Element;
  label: string;
}

/** aria-label, else the first aria-labelledby target's text, else nothing. */
function accessibleName(el: Element): string {
  const own = el.getAttribute('aria-label')?.trim();
  if (own) return own;
  const by = el.getAttribute('aria-labelledby')?.trim().split(/\s+/)[0];
  const target = by ? el.ownerDocument.getElementById(by) : null;
  return target?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** The elements an overlay outlines, in document order, each with its label. */
export function collect(root: Document | Element, kind: OutlineKind): Outlined[] {
  const out: Outlined[] = [];
  if (kind === 'headings') {
    for (const el of root.querySelectorAll(HEADINGS)) {
      if (el.closest('[data-developer-toolbar]')) continue;
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      out.push({ el, label: `H${el.tagName.slice(1)} · ${text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX).trimEnd()}…` : text}` });
    }
    return out;
  }
  for (const el of root.querySelectorAll(LANDMARKS)) {
    if (el.closest('[data-developer-toolbar]')) continue;
    const tag = el.tagName.toLowerCase();
    const explicit = el.getAttribute('role');
    const role = explicit ?? IMPLICIT[tag];
    if (!role) continue;
    // A header or footer nested in sectioning content is no landmark; a section, or any region, is one only with a name.
    if (!explicit && (tag === 'header' || tag === 'footer') && el.parentElement?.closest(SECTIONING)) continue;
    const name = accessibleName(el);
    if (role === 'region' && !name) continue;
    out.push({ el, label: name ? `${role} · ${name}` : role });
  }
  return out;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function PageOutlines({ kind }: { kind: OutlineKind }) {
  // Collected once, when the overlay opens (the toolbar mounts one instance per kind); loaded on demand, so the document is there.
  const [items] = useState<Outlined[]>(() => (typeof document === 'undefined' ? [] : collect(document, kind)));
  const [boxes, setBoxes] = useState<Box[]>([]);
  useEffect(() => {
    const measure = () =>
      setBoxes(
        items.map(({ el }) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, left: r.left, width: r.width, height: r.height };
        }),
      );
    // The first measure a task later, then on every scroll and resize.
    const first = window.setTimeout(measure, 0);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [items]);
  return (
    <div data-page-outlines={kind} aria-hidden="true">
      {items.map((item, i) => {
        const box = boxes[i];
        // An element that is not drawn (or not yet measured) gets no box.
        const empty = !box || (box.width === 0 && box.height === 0);
        return (
          <div key={i} data-page-outline={kind} hidden={empty} className="pointer-events-none fixed z-[55] border-2 border-brand bg-brand/5" style={box}>
            <span className={`absolute left-0 top-0 ${LABEL}`}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
