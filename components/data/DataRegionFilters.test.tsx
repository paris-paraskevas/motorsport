// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataRegionFilters, FILTERS_SCRIPT, type Facet } from './DataRegionFilters';

// The Filters region's chips (P2.5; APEX: Smart Filters): a facet a disclosure whose summary names it and what is picked, its
// values links that toggle one value each with a count and a bar; a facet set to pick several a GET form with checkboxes and
// Apply, the rest of the address's state as hidden inputs; a dependent facet closed until its parent carries a value, and
// cleared with it; Reset the region's plain address. The page keeps its cache: the address carries the state, the middleware
// serves the variant. The one script is a constant: it folds a form's ticks into one filter and narrows a drawn list by a search.

const facets: Facet[] = [
  { key: 'facet1', column: 'team', label: 'Team', several: false, open: true, parentLabel: null, parentColumn: null, current: ['McLaren'], values: [{ value: 'McLaren', count: 2 }, { value: 'Ferrari', count: 1 }, { value: 'Haas, Ferrari', count: 1 }], more: 0 },
  { key: 'facet2', column: 'name', label: 'Driver', several: true, open: true, parentLabel: 'Team', parentColumn: 'team', current: ['A Driver'], values: [{ value: 'A Driver', count: 1 }, { value: 'B Driver', count: 1 }], more: 3 },
  { key: 'facet3', column: 'code', label: 'Code', several: false, open: false, parentLabel: 'Team', parentColumn: 'team', current: [], values: [], more: 0 },
];
const state = { filters: [{ column: 'team', op: 'in' as const, value: 'McLaren' }, { column: 'name', op: 'in' as const, value: 'A Driver' }] };
const html = renderToStaticMarkup(<DataRegionFilters href="/x" prefix="" others="filter=team.in%3AMcLaren&filter=name.in%3AA+Driver" state={state} facets={facets} />);
const linkOf = (text: string) => new RegExp(`<a href="([^"]*)"[^>]*>${text}</a>`).exec(html)?.[1];

describe('DataRegionFilters (P2.5; APEX: Smart Filters)', () => {
  it('draws each facet as a chip: the picked values in its summary, each value a link that toggles it, with its count and a bar', () => {
    expect(html).toContain('Team · McLaren');
    // Ferrari's link adds it beside McLaren, one `in` filter for the column, the values in one order; the Driver pick rides along.
    expect(linkOf('Ferrari')).toBe('/x?filter=name.in%3AA+Driver&amp;filter=team.in%3AFerrari%2CMcLaren');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('width:100%');
    expect(html).toContain('width:50%');
  });

  it('un-picking a facet clears the facets that depend on it, so no filter stays that the chips cannot reach', () => {
    // McLaren is picked: its link drops the Team filter and, with it, the Driver's (which depends on Team).
    expect(linkOf('McLaren')).toBe('/x');
  });

  it('a value with a comma cannot ride an `in` list: it is picked alone, as `eq`', () => {
    expect(linkOf('Haas, Ferrari')).toBe('/x?filter=name.in%3AA+Driver&amp;filter=team.eq%3AHaas%2C+Ferrari');
  });

  it('a facet that picks several is a form with checkboxes and Apply, the rest of the state as hidden inputs; the overflow is counted', () => {
    expect(html).toContain('data-facet="name"');
    const aDriver = /<input[^>]*name="pick"[^>]*value="A Driver"[^>]*>/.exec(html)?.[0] ?? '';
    expect(aDriver).toContain('checked');
    const bDriver = /<input[^>]*name="pick"[^>]*value="B Driver"[^>]*>/.exec(html)?.[0] ?? '';
    expect(bDriver).not.toContain('checked');
    expect(html).toContain('Apply');
    expect(html).toContain('and 3 more');
    expect(html).toContain('type="hidden" name="filter" value="team.in:McLaren"');
    expect(html).not.toContain('type="hidden" name="filter" value="name.in:A Driver"');
    expect(html).toContain('data-facet-search');
  });

  it('a dependent facet waits for its parent; Reset clears this region’s filters alone; text is escaped', () => {
    expect(html).toContain('Pick Team first');
    expect(linkOf('Reset')).toBe('/x');
    const hostile = renderToStaticMarkup(<DataRegionFilters href="/x" prefix="" others="" state={{ filters: [] }} facets={[{ key: 'facet1', column: 'team', label: '<b>Team</b>', several: false, open: true, parentLabel: null, parentColumn: null, current: [], values: [{ value: '<i>x</i>', count: 1 }], more: 0 }]} />);
    expect(hostile).not.toContain('<b>');
    expect(hostile).not.toContain('<i>');
    expect(hostile).toContain('&lt;i&gt;x&lt;/i&gt;');
  });

  it('the script folds a form’s ticks into one `in` filter on submit and narrows a drawn list by the search; it binds each region once', () => {
    document.body.innerHTML = html;
    new Function(FILTERS_SCRIPT)();
    new Function(FILTERS_SCRIPT)();
    const form = document.querySelector<HTMLFormElement>('form[data-facet]')!;
    const picks = [...form.querySelectorAll<HTMLInputElement>('input[name="pick"]')];
    picks[1].checked = true;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const folded = [...form.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="filter"]')].map(i => i.value);
    expect(folded).toEqual(['team.in:McLaren', 'name.in:A Driver,B Driver']);
    expect(picks.every(p => p.disabled)).toBe(true);
    const search = form.querySelector<HTMLInputElement>('input[data-facet-search]')!;
    search.value = 'b dr';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const items = [...form.querySelectorAll<HTMLElement>('[data-facet-value]')].map(li => [li.getAttribute('data-facet-value'), li.hidden]);
    expect(items).toEqual([['A Driver', true], ['B Driver', false]]);
  });
});
