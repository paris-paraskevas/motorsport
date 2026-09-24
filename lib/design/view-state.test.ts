import { describe, expect, it } from 'vitest';
import { CANONICAL_MAX, COLS_MAX, EMPTY_VIEW, FILTERS_MAX, PREFIXES_MAX, VIEW_PREFIX, applySavedView, bindViewState, decodeSegment, definitionOf, encodeSegment, encodeViewState, isEmptyView, parseRule, parseViewDefinition, parseViewState, rewriteTarget, sortHref, viewKeyProblem, viewNameProblem, viewStateHref, type ViewDefinition, type ViewState } from './view-state';
import { SHAPES } from './presets';

// The URL vocabulary of a Data region (P2.3; APEX: the Interactive Report's request syntax): what a reader's address may
// say about a table — sort, cols, filter, view — read leniently, bound to a shape, written canonically so one state is one
// cached variant, and the middleware's rule that turns a page carrying a state into its variant path.

describe('parseViewState', () => {
  it('reads sort (a leading minus for descending), cols (a comma list or repeated), filter (column.op:value, eq implicit) and view; unknown keys are ignored, malformed values dropped with a problem', () => {
    const { value, problems } = parseViewState('sort=-points&cols=name,points&cols=wins&filter=team.eq:Mercedes&filter=points.gte:100&filter=name:Max&view=top-five&foo=bar');
    expect(problems).toEqual([]);
    expect(value).toEqual({
      sort: { column: 'points', desc: true },
      cols: ['name', 'points', 'wins'],
      filters: [
        { column: 'team', op: 'eq', value: 'Mercedes' },
        { column: 'points', op: 'gte', value: '100' },
        { column: 'name', op: 'eq', value: 'Max' },
      ],
      view: 'top-five',
    });
    expect(parseViewState('sort=points').value.sort).toEqual({ column: 'points', desc: false });
    expect(parseViewState(new URLSearchParams('sort=points')).value.sort).toEqual({ column: 'points', desc: false });
    expect(parseViewState('').value).toEqual(EMPTY_VIEW);
    expect(isEmptyView(parseViewState('foo=1').value)).toBe(true);
    const bad = parseViewState('sort=-&cols=,&filter=nope&filter=team.like:x&filter=points.gt:&view=Not+A+Slug');
    expect(bad.value).toEqual(EMPTY_VIEW);
    expect(bad.problems).toHaveLength(6);
    // At most four filters, a value at most eighty characters.
    const many = parseViewState(Array.from({ length: 6 }, (_, i) => `filter=c${i}:v`).join('&') + `&filter=team:${'x'.repeat(81)}`);
    expect(many.value.filters).toHaveLength(FILTERS_MAX);
    expect(many.problems.length).toBeGreaterThan(0);
  });

  it('reads one region’s keys under its prefix and leaves the bare ones to the bare state', () => {
    const q = 'sort=-points&r.table.sort=name&r.table.cols=name&r.other.view=v';
    expect(parseViewState(q).value.sort).toEqual({ column: 'points', desc: true });
    expect(parseViewState(q, 'r.table.').value).toEqual({ sort: { column: 'name', desc: false }, cols: ['name'], filters: [] });
    expect(parseViewState(q, 'r.other.').value.view).toBe('v');
  });
});

describe('bindViewState', () => {
  const shape = SHAPES['driver-rows'];
  it('keeps what the shape can honour and drops the rest silently: no sort on a percent or image column, cols within the shape, filter operators by the column’s type', () => {
    const state: ViewState = {
      sort: { column: 'points', desc: true },
      cols: ['name', 'points', 'nope'],
      filters: [
        { column: 'team', op: 'eq', value: 'Mercedes' },
        { column: 'team', op: 'gt', value: 'M' },
        { column: 'points', op: 'gte', value: '100' },
        { column: 'nope', op: 'eq', value: 'x' },
      ],
      view: 'top',
    };
    expect(bindViewState(state, shape)).toEqual({ sort: { column: 'points', desc: true }, cols: ['name', 'points'], filters: [{ column: 'team', op: 'eq', value: 'Mercedes' }, { column: 'points', op: 'gte', value: '100' }], view: 'top' });
    expect(bindViewState({ sort: { column: 'share', desc: false }, filters: [] }, shape).sort).toBeUndefined();
    expect(bindViewState({ cols: ['nope'], filters: [] }, shape).cols).toBeUndefined();
    expect(bindViewState({ sort: { column: 'name', desc: false }, filters: [{ column: 'name', op: 'in', value: 'A,B' }] }, shape)).toEqual({ sort: { column: 'name', desc: false }, filters: [{ column: 'name', op: 'in', value: 'A,B' }] });
  });
});

describe('encodeViewState and the hrefs', () => {
  it('writes one canonical string per state (sort, cols, filters sorted, view), empty for nothing; the href is the path alone or the path and the state; sort toggles none → ascending → descending → none', () => {
    const state: ViewState = { view: 'v', filters: [{ column: 'name', op: 'eq', value: 'A B' }, { column: 'points', op: 'gte', value: '10' }], cols: ['name', 'points'], sort: { column: 'points', desc: true } };
    expect(encodeViewState(state)).toBe('sort=-points&cols=name%2Cpoints&filter=name.eq%3AA+B&filter=points.gte%3A10&view=v');
    // The filters and the columns in any order write the same string: one state, one cached variant (the shape's order draws the columns).
    expect(encodeViewState({ ...state, filters: [state.filters[1], state.filters[0]] })).toBe(encodeViewState(state));
    expect(encodeViewState({ filters: [], cols: ['points', 'name'] })).toBe('cols=name%2Cpoints');
    expect(encodeViewState(EMPTY_VIEW)).toBe('');
    expect(encodeViewState({ sort: { column: 'name', desc: false }, filters: [] }, 'r.table.')).toBe('r.table.sort=name');
    expect(parseViewState(encodeViewState(state)).value).toEqual(state);
    expect(viewStateHref('/history/monza', EMPTY_VIEW)).toBe('/history/monza');
    expect(viewStateHref('/history/monza', { sort: { column: 'points', desc: true }, filters: [] })).toBe('/history/monza?sort=-points');
    expect(viewStateHref('', { sort: { column: 'points', desc: true }, filters: [] })).toBe('?sort=-points');
    const none: ViewState = { filters: [], cols: ['name', 'points'] };
    expect(sortHref('/p', none, 'points')).toBe('/p?sort=points&cols=name%2Cpoints');
    expect(sortHref('/p', { ...none, sort: { column: 'points', desc: false } }, 'points')).toBe('/p?sort=-points&cols=name%2Cpoints');
    expect(sortHref('/p', { ...none, sort: { column: 'points', desc: true } }, 'points')).toBe('/p?cols=name%2Cpoints');
    expect(sortHref('/p', { ...none, sort: { column: 'points', desc: true } }, 'name', 'r.t.')).toBe('/p?r.t.sort=name&r.t.cols=name%2Cpoints');
  });
});

describe('rewriteTarget — the middleware’s rule', () => {
  it('turns a page carrying a state into its cached variant path, every prefix in one canonical string; nothing for a plain address, an unknown key, an excluded prefix, or a path the code serves', () => {
    expect(rewriteTarget('/history/monza', '?sort=-points&foo=1')).toBe(`${VIEW_PREFIX}/${encodeSegment('sort=-points')}/history/monza`);
    expect(rewriteTarget('/history/monza', '?r.b.sort=name&sort=points')).toBe(`${VIEW_PREFIX}/${encodeSegment('sort=points&r.b.sort=name')}/history/monza`);
    expect(rewriteTarget('/calendar', '?view=v')).toBe(`${VIEW_PREFIX}/${encodeSegment('view=v')}/calendar`);
    // The segment is base64url: an alphabet no router re-encodes; it decodes back to the canonical query, and nothing else does.
    expect(encodeSegment('sort=-points')).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSegment(encodeSegment('filter=team.eq%3AA%26B+%25&sort=-points'))).toBe('filter=team.eq%3AA%26B+%25&sort=-points');
    expect(decodeSegment('sort=points')).toBeNull();
    expect(decodeSegment('')).toBe('');
    // What one address may mint into the cache is bounded: the columns named, the regions addressed, the canonical string's length.
    const wide = parseViewState(`cols=${Array.from({ length: COLS_MAX + 3 }, (_, i) => `c${i}`).join(',')}`);
    expect(wide.value.cols).toHaveLength(COLS_MAX);
    expect(wide.problems).toEqual([`cols beyond the ${COLS_MAX} allowed`]);
    const regions = Array.from({ length: PREFIXES_MAX + 2 }, (_, i) => `r.reg${i}.sort=points`).join('&');
    expect(rewriteTarget('/history/monza', `?${regions}`)).toBe(`${VIEW_PREFIX}/${encodeSegment(Array.from({ length: PREFIXES_MAX }, (_, i) => `r.reg${i}.sort=points`).join('&'))}/history/monza`);
    const long = Array.from({ length: PREFIXES_MAX }, (_, i) => Array.from({ length: FILTERS_MAX }, (_, j) => `r.reg${i}.filter=column${j}.eq:${'v'.repeat(80)}`).join('&')).join('&');
    expect(long.length).toBeGreaterThan(CANONICAL_MAX);
    expect(rewriteTarget('/history/monza', `?${long}`)).toBeNull();
    expect(rewriteTarget('/history/monza', '')).toBeNull();
    expect(rewriteTarget('/history/monza', '?foo=1')).toBeNull();
    expect(rewriteTarget('/history/monza', '?sort=-&filter=nope')).toBeNull();
    for (const p of ['/admin/designer', '/api/data/csv', '/preview/abc', '/sign-in', '/sign-up', `${VIEW_PREFIX}/x/history/monza`]) expect(rewriteTarget(p, '?sort=points'), p).toBeNull();
    // A path the code serves keeps its own query string: Home, the compare tool, a series page and its tabs, an archived weekend.
    for (const p of ['/', '/f1/compare', '/series/f1', '/series/f1/standings', '/archive/2025/f1/weekend/3']) expect(rewriteTarget(p, '?sort=points'), p).toBeNull();
    // A value that needs escaping survives the round trip through the variant segment.
    const target = rewriteTarget('/history/monza', '?filter=team.eq:A%26B%20%25')!;
    expect(target.startsWith(`${VIEW_PREFIX}/`)).toBe(true);
    expect(parseViewState(decodeSegment(target.slice(VIEW_PREFIX.length + 1).split('/')[0])!).value.filters).toEqual([{ column: 'team', op: 'eq', value: 'A&B %' }]);
  });
});

describe('saved views (PR B): the rules, a stored definition, the address over it', () => {
  it('a key is a slug of at most 40, a name at most 60; a definition is read field by field and refused whole when a field is wrong; the address’s own parameters replace the view’s', () => {
    expect(viewKeyProblem('top-five')).toBeNull();
    expect(viewKeyProblem('')).toBe('needs a key');
    expect(viewKeyProblem('Top Five')).toMatch(/lower-case/);
    expect(viewKeyProblem('a'.repeat(41))).toMatch(/at most 40/);
    expect(viewNameProblem('Top five')).toBeNull();
    expect(viewNameProblem(' ')).toBe('needs a name');
    expect(viewNameProblem('n'.repeat(61))).toMatch(/at most 60/);
    const def: ViewDefinition = { sort: { column: 'points', desc: true }, cols: ['name', 'points'], filters: [{ column: 'team', op: 'eq', value: 'Mercedes' }] };
    expect(parseViewDefinition(def)).toEqual(def);
    expect(parseViewDefinition({ filters: [] })).toEqual({ filters: [] });
    expect(parseViewDefinition({})).toEqual({ filters: [] });
    expect(parseViewDefinition(null)).toBeNull();
    expect(parseViewDefinition([])).toBeNull();
    expect(parseViewDefinition({ sort: { column: 'points' } })).toBeNull();
    expect(parseViewDefinition({ cols: [] })).toBeNull();
    expect(parseViewDefinition({ filters: [{ column: 'team', op: 'like', value: 'x' }] })).toBeNull();
    expect(definitionOf({ sort: { column: 'name', desc: false }, filters: [], view: 'v' })).toEqual({ sort: { column: 'name', desc: false }, filters: [] });
    const url: ViewState = { filters: [], view: 'top-five', cols: ['name'] };
    expect(applySavedView(url, def)).toEqual({ sort: { column: 'points', desc: true }, cols: ['name'], filters: [{ column: 'team', op: 'eq', value: 'Mercedes' }], view: 'top-five' });
    expect(applySavedView({ filters: [{ column: 'points', op: 'gte', value: '1' }] }, def)).toEqual({ sort: { column: 'points', desc: true }, cols: ['name', 'points'], filters: [{ column: 'points', op: 'gte', value: '1' }] });
    expect(applySavedView(url, null)).toBe(url);
  });
});

describe('highlight rules (P2.4): one condition in the vocabulary’s words', () => {
  it('parseRule reads column.op:value (eq implicit) and answers the problem as text', () => {
    expect(parseRule('position.lte:3')).toEqual({ column: 'position', op: 'lte', value: '3' });
    expect(parseRule('team:Mercedes')).toEqual({ column: 'team', op: 'eq', value: 'Mercedes' });
    expect(typeof parseRule('nope')).toBe('string');
    expect(typeof parseRule('team.like:x')).toBe('string');
    expect(typeof parseRule('points.gt:')).toBe('string');
  });
});
