// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageOutlines, collect } from './PageOutlines';

// Show Landmarks and Show Headings (P1.13; APEX: the Developer Toolbar's Info
// menu, its third and fourth entries). The collection follows the HTML-AAM
// mapping for the implicit roles; a header or footer inside an article, aside,
// main, nav or section is no landmark; a region counts only with a name; the
// toolbar's own elements never count.

const FIXTURE = `
<header id="top"><nav aria-label="Doors"><a href="/">Home</a></nav></header>
<main>
  <article>
    <header><h1>Monza, a history</h1></header>
    <h2>The story</h2>
    <section aria-labelledby="els"><h2 id="els">Elsewhere on Paddock</h2></section>
    <div role="search"></div>
    <div role="region"></div>
    <h3>A century of speed at the Autodromo Nazionale, from the banked oval</h3>
  </article>
  <aside>Aside</aside>
</main>
<footer>Footer</footer>
<div data-developer-toolbar=""><nav aria-label="Toolbar nav"></nav><h4>Not counted</h4></div>`;

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('PageOutlines', () => {
  it('collects the landmarks with their roles and names, in document order, skipping a header inside an article, an unnamed region and the toolbar’s own; the headings with their level and first words', () => {
    document.body.innerHTML = FIXTURE;
    expect(collect(document, 'landmarks').map(x => x.label)).toEqual(['banner', 'navigation · Doors', 'main', 'region · Elsewhere on Paddock', 'search', 'complementary', 'contentinfo']);
    expect(collect(document, 'headings').map(x => x.label)).toEqual(['H1 · Monza, a history', 'H2 · The story', 'H2 · Elsewhere on Paddock', 'H3 · A century of speed at the Autodromo Nazi…']);
  });

  it('draws one labelled box per element, hidden while the element has no size (jsdom measures nothing)', () => {
    document.body.innerHTML = FIXTURE;
    render(<PageOutlines kind="headings" />);
    const boxes = [...document.querySelectorAll('[data-page-outlines="headings"] [data-page-outline]')];
    expect(boxes.map(b => b.textContent)).toEqual(['H1 · Monza, a history', 'H2 · The story', 'H2 · Elsewhere on Paddock', 'H3 · A century of speed at the Autodromo Nazi…']);
    expect(boxes.every(b => b.hasAttribute('hidden'))).toBe(true);
    expect(document.querySelector('[data-page-outlines="headings"]')?.getAttribute('aria-hidden')).toBe('true');
    cleanup();
    render(<PageOutlines kind="landmarks" />);
    expect(document.querySelectorAll('[data-page-outlines="landmarks"] [data-page-outline]').length).toBe(7);
  });
});
