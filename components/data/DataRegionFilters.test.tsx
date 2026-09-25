import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataRegionFilters, type Facet } from './DataRegionFilters';

// The Filters region's chips (P2.5; APEX: Smart Filters): a facet a disclosure whose summary names it and what is picked, its
// values links that toggle one value each with a count and a bar; a facet set to pick several a GET form with checkboxes and
// Apply, the rest of the address's state as hidden inputs; a dependent facet closed until its parent carries a value; Reset the
// region's plain address. The page keeps its cache: the address carries the state, the middleware serves the variant.

const facets: Facet[] = [
  { key: 'facet1', column: 'team', label: 'Team', several: false, open: true, parentLabel: null, current: ['McLaren'], values: [{ value: 'McLaren', count: 2 }, { value: 'Ferrari', count: 1 }], more: 0 },
  { key: 'facet2', column: 'name', label: 'Driver', several: true, open: true, parentLabel: null, current: [], values: [{ value: 'A Driver', count: 1 }, { value: 'B Driver', count: 1 }], more: 3 },
  { key: 'facet3', column: 'code', label: 'Code', several: false, open: false, parentLabel: 'Team', current: [], values: [], more: 0 },
];
const state = { filters: [{ column: 'team', op: 'in' as const, value: 'McLaren' }] };
const html = renderToStaticMarkup(<DataRegionFilters href="/x" prefix="" others="filter=team.in%3AMcLaren" state={state} facets={facets} />);

describe('DataRegionFilters (P2.5; APEX: Smart Filters)', () => {
  it('draws each facet as a chip: the picked values in its summary, each value a link that toggles it, with its count and a bar', () => {
    expect(html).toContain('Team · McLaren');
    // McLaren is picked: its link drops it (the plain address); Ferrari's adds it beside McLaren, one `in` filter for the column.
    expect(html).toContain('href="/x"');
    expect(html).toContain('team.in%3AFerrari%2CMcLaren');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('width:100%');
    expect(html).toContain('width:50%');
  });

  it('a facet that picks several is a form with checkboxes and Apply, the rest of the state as hidden inputs; the overflow is counted', () => {
    expect(html).toContain('data-facet="name"');
    expect(html).toContain('name="pick" value="A Driver"');
    expect(html).toContain('Apply');
    expect(html).toContain('and 3 more');
    expect(html).toContain('type="hidden" name="filter" value="team.in:McLaren"');
    expect(html).toContain('data-facet-search');
  });

  it('a dependent facet waits for its parent; Reset clears this region’s filters alone; text is escaped', () => {
    expect(html).toContain('Pick Team first');
    expect(html).toContain('>Reset<');
    const hostile = renderToStaticMarkup(<DataRegionFilters href="/x" prefix="" others="" state={{ filters: [] }} facets={[{ key: 'facet1', column: 'team', label: '<b>Team</b>', several: false, open: true, parentLabel: null, current: [], values: [{ value: '<i>x</i>', count: 1 }], more: 0 }]} />);
    expect(hostile).not.toContain('<b>');
    expect(hostile).not.toContain('<i>');
    expect(hostile).toContain('&lt;i&gt;x&lt;/i&gt;');
  });
});
