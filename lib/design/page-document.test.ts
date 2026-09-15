import { describe, expect, it } from 'vitest';
import {
  EMPTY_DOCUMENT,
  applyBuildOptions,
  applyShow,
  documentRefs,
  isLegacyBody,
  parsePageDocument,
  passesShow,
  showAsks,
  patternMatches,
  refRows,
  rowPagePathProblem,
  overlappingRegions,
  rowMates,
  rowsAt,
  schemesAsked,
  substituteShortcuts,
  type PageDocument,
} from './page-document';

const ASSET = 'a1b2c3d4-0000-4000-8000-000000000001';
const DOC: PageDocument = {
  version: 1,
  actions: [],
  regions: [
    { id: 'intro', kind: 'static', title: 'Monza, a history', position: 'body', seq: 10, column: 1, span: 8, newRow: false, hidden: false, authz: null, text: 'The Autodromo opened in 1922. {shortcut:times.local} {shortcut:data.sources}' },
    { id: 'photo', kind: 'image', title: '', position: 'body', seq: 20, column: 9, span: 4, newRow: false, hidden: false, authz: null, assetId: ASSET, alt: 'The grid at Monza', showCaption: true },
    { id: 'more', kind: 'list', title: 'More', position: 'right', seq: 10, column: 1, span: 12, newRow: false, hidden: false, authz: 'signed_in', listKey: 'footer-site', style: 'links' },
  ],
};

describe('parsePageDocument', () => {
  it('accepts a well-formed document and keeps its regions in position and sequence order', () => {
    const shuffled = { ...DOC, regions: [DOC.regions[2], DOC.regions[1], DOC.regions[0]] };
    const { value, problems } = parsePageDocument(shuffled);
    expect(problems).toEqual([]);
    expect(value.regions.map(r => r.id)).toEqual(['intro', 'photo', 'more']);
    expect(value.regions[1]).toMatchObject({ kind: 'image', showCaption: true });
  });

  it('refuses what is not a document, an unknown version, and a regions field that is not a list; reads version 1 and 2 and writes 2', () => {
    expect(parsePageDocument(null)).toEqual({ value: EMPTY_DOCUMENT, problems: ['the document must be an object'] });
    expect(parsePageDocument({ version: 3, regions: [] })).toEqual({ value: EMPTY_DOCUMENT, problems: ['unknown document version 3'] });
    expect(parsePageDocument({ version: 1, regions: 'x' })).toEqual({ value: EMPTY_DOCUMENT, problems: ['regions must be a list'] });
    expect(parsePageDocument({ version: 1, regions: [] })).toEqual({ value: EMPTY_DOCUMENT, problems: [] });
    expect(parsePageDocument({ version: 2, regions: [] })).toEqual({ value: EMPTY_DOCUMENT, problems: [] });
    expect(EMPTY_DOCUMENT.version).toBe(2);
  });

  it('drops an unusable region and names each problem, keeping the rest', () => {
    const { value, problems } = parsePageDocument({
      version: 1,
      regions: [
        DOC.regions[0],
        { id: 'Bad Id', kind: 'static', position: 'body', seq: 20, column: 1, span: 12, text: 'x' },
        { id: 'wide', kind: 'static', position: 'body', seq: 30, column: 10, span: 4, text: 'x' },
        { id: 'noasset', kind: 'image', position: 'body', seq: 40, column: 1, span: 6 },
        { id: 'dup', kind: 'list', position: 'footer', seq: 10, column: 1, span: 12, listKey: 'doors' },
        { id: 'dup', kind: 'list', position: 'footer', seq: 20, column: 1, span: 12, listKey: 'bar' },
        { id: 'p1', kind: 'list', position: 'phonebar', seq: 10, column: 1, span: 12, listKey: 'bar' },
        { id: 'p2', kind: 'list', position: 'phonebar', seq: 20, column: 1, span: 12, listKey: 'bar' },
      ],
    });
    expect(value.regions.map(r => r.id)).toEqual(['intro', 'dup', 'p1', 'p2']);
    expect(problems).toEqual([
      'region Bad Id: the id must be lower-case letters, digits and dashes',
      'region wide: the span must be 1 to 3',
      'region noasset: the image must name one of your photos',
      'region dup: the id is used twice',
      'the phone bar holds one region at most',
    ]);
  });

  it('projects every reference a document names, unique and sorted', () => {
    expect(documentRefs(DOC)).toEqual({
      lists: ['footer-site'],
      assets: [ASSET],
      authz: ['signed_in'],
      shortcuts: ['data.sources', 'times.local'],
      dests: [],
    });
    expect(documentRefs(EMPTY_DOCUMENT)).toEqual({ lists: [], assets: [], authz: [], shortcuts: [], dests: [] });
  });

  it('parses a Button region and the dynamic actions, refusing what names nothing on the page', () => {
    const raw = {
      version: 1,
      regions: [
        { id: 'teaser', kind: 'static', position: 'body', seq: 10, column: 1, span: 12, text: 'Read on.' },
        { id: 'more', kind: 'static', position: 'body', seq: 20, column: 1, span: 12, hidden: true, text: 'The rest.' },
        { id: 'open', kind: 'button', position: 'body', seq: 30, column: 1, span: 4, label: ' Read more ', dest: null },
        { id: 'cal', kind: 'button', position: 'body', seq: 40, column: 5, span: 4, label: 'Calendar', dest: 'calendar' },
        { id: 'bad-dest', kind: 'button', position: 'body', seq: 50, column: 9, span: 4, label: 'x', dest: 'action:contact' },
        { id: 'no-label', kind: 'button', position: 'footer', seq: 10, column: 1, span: 12, label: ' ' },
      ],
      actions: [
        { id: 'reveal', name: 'Reveal the rest', when: { event: 'click', region: 'open' }, do: [{ action: 'show', region: 'more' }, { action: 'hide', region: 'open' }] },
        { id: 'tick', when: { event: 'timer', seconds: 30 }, do: [{ action: 'toggle', region: 'teaser' }] },
        { id: 'away', when: { event: 'load' }, do: [{ action: 'go', dest: 'calendar' }] },
        { id: 'seen', when: { event: 'visible', region: 'more' }, do: [{ action: 'scroll-to', region: 'teaser' }] },
        { id: 'ghost', when: { event: 'click', region: 'nowhere' }, do: [{ action: 'show', region: 'more' }] },
        { id: 'empty', when: { event: 'load' }, do: [] },
        { id: 'fast', when: { event: 'timer', seconds: 1 }, do: [{ action: 'show', region: 'more' }] },
        { id: 'lost', when: { event: 'load' }, do: [{ action: 'show', region: 'nowhere' }, { action: 'go', dest: 'action:contact' }] },
        { id: 'reveal', when: { event: 'load' }, do: [{ action: 'show', region: 'more' }] },
      ],
    };
    const { value, problems } = parsePageDocument(raw);
    expect(value.regions.map(r => r.id)).toEqual(['teaser', 'more', 'open', 'cal']);
    expect(value.regions[1].hidden).toBe(true);
    expect(value.regions[2]).toMatchObject({ kind: 'button', label: 'Read more', dest: null, hidden: false });
    expect(value.actions.map(a => a.id)).toEqual(['reveal', 'tick', 'away', 'seen']);
    expect(value.actions[0]).toEqual({ id: 'reveal', name: 'Reveal the rest', when: { event: 'click', region: 'open' }, do: [{ action: 'show', region: 'more' }, { action: 'hide', region: 'open' }] });
    expect(problems).toEqual([
      'region bad-dest: the destination must be a page or a link from the catalogue',
      'region no-label: the button needs a label',
      'action ghost: when must name a region of this page',
      'action empty: needs at least one effect',
      'action fast: the timer is 5 to 3600 seconds',
      'action lost, effect 1: must name a region of this page',
      'action lost, effect 2: go must name a page or a link from the catalogue',
      'action reveal: the id is used twice',
    ]);
    expect(documentRefs(value).dests).toEqual(['calendar']);
    expect(refRows(documentRefs(value))).toContainEqual({ kind: 'dest', key: 'calendar' });
    expect(parsePageDocument({ version: 1, regions: [], actions: 'x' }).problems).toEqual(['actions must be a list']);
  });

  it('substitutes shortcuts by key and drops an unknown one, and lists the schemes a page asks for beyond public', () => {
    expect(substituteShortcuts('A {shortcut:times.local} B {shortcut:nope} C', { 'times.local': 'local' })).toBe('A local B  C');
    expect(substituteShortcuts('no tokens', {})).toBe('no tokens');
    expect(schemesAsked('public', DOC)).toEqual(['signed_in']);
    expect(schemesAsked('administrator', DOC)).toEqual(['administrator', 'signed_in']);
    expect(schemesAsked(null, EMPTY_DOCUMENT)).toEqual([]);
  });

  it('splits a position into rows where a region starts a new row', () => {
    const doc: PageDocument = {
      version: 1,
      actions: [],
      regions: [
        { ...DOC.regions[0], id: 'a', seq: 10 },
        { ...DOC.regions[0], id: 'b', seq: 20, column: 9, span: 4 },
        { ...DOC.regions[0], id: 'c', seq: 30, column: 1, span: 12, newRow: true },
      ],
    };
    expect(rowsAt(doc, 'body').map(row => row.map(r => r.id))).toEqual([['a', 'b'], ['c']]);
    expect(rowsAt(doc, 'footer')).toEqual([]);
  });

  it('wraps a region whose columns another region of its row already holds, names the row mates and the overlap (R5)', () => {
    const doc: PageDocument = {
      version: 1,
      actions: [],
      regions: [
        { ...DOC.regions[0], id: 'a', seq: 10, column: 1, span: 6, newRow: true },
        { ...DOC.regions[0], id: 'b', seq: 20, column: 1, span: 6, newRow: false },
        { ...DOC.regions[0], id: 'c', seq: 30, column: 7, span: 6, newRow: false },
      ],
    };
    // Drawn: b cannot sit on a's columns, so it starts a row of its own and c joins it.
    expect(rowsAt(doc, 'body').map(row => row.map(r => r.id))).toEqual([['a'], ['b', 'c']]);
    // Declared: the three share one row, so the designer's checks see a and c beside b.
    expect(rowMates(doc, doc.regions[1]).map(r => r.id)).toEqual(['a', 'c']);
    expect(overlappingRegions(doc)).toEqual([{ position: 'body', a: 'a', b: 'b', from: 1, to: 6 }]);
    expect(overlappingRegions(DOC)).toEqual([]);
  });
});

describe('components and show rules (the components programme, R2a)', () => {
  const region = (over: Record<string, unknown>) => ({ id: 'r', kind: 'component', title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, ...over });
  const doc = (regions: unknown[]) => ({ version: 1, regions, actions: [] });

  it('parses a component region against the catalogue: the transitional body with its settings filled, a key the code does not have refused', () => {
    const ok = parsePageDocument(doc([region({ component: 'page.body' })]));
    expect(ok.problems).toEqual([]);
    expect(ok.value.regions[0]).toMatchObject({ kind: 'component', component: 'page.body', settings: {} });
    expect(isLegacyBody(ok.value.regions[0])).toBe(true);
    const bad = parsePageDocument(doc([region({ component: 'home.nothing' })]));
    expect(bad.value.regions).toEqual([]);
    expect(bad.problems).toEqual(['region r: names a component the code does not have (home.nothing)']);
    const none = parsePageDocument(doc([region({})]));
    expect(none.problems[0]).toMatch(/names a component the code does not have \(none\)/);
    const settings = parsePageDocument(doc([region({ component: 'page.body', settings: { items: 5 } })]));
    expect(settings.problems).toEqual(['region r: Body as the code draws it has no setting called items']);
  });

  it('reads a show rule, leaves it out when it is always, and refuses one it does not know', () => {
    const rule = parsePageDocument(doc([region({ component: 'page.body', show: 'signed-in' })]));
    expect(rule.problems).toEqual([]);
    expect(rule.value.regions[0].show).toBe('signed-in');
    const always = parsePageDocument(doc([region({ component: 'page.body', show: 'always' })]));
    expect(always.value.regions[0].show).toBeUndefined();
    const unknown = parsePageDocument(doc([region({ component: 'page.body', show: 'on tuesdays' })]));
    expect(unknown.value.regions).toEqual([]);
    expect(unknown.problems[0]).toMatch(/the show rule must be one of always, race-weekend/);
  });

  it('passesShow: a fact the server lacks shows the region; phones and desktop pass here because the stylesheet decides them', () => {
    expect(passesShow(undefined, { signedIn: null, raceWeekend: null })).toBe(true);
    expect(passesShow('signed-in', { signedIn: false, raceWeekend: null })).toBe(false);
    expect(passesShow('signed-in', { signedIn: true, raceWeekend: null })).toBe(true);
    expect(passesShow('signed-in', { signedIn: null, raceWeekend: null })).toBe(true);
    expect(passesShow('signed-out', { signedIn: true, raceWeekend: null })).toBe(false);
    expect(passesShow('race-weekend', { signedIn: null, raceWeekend: false })).toBe(false);
    expect(passesShow('between-weekends', { signedIn: null, raceWeekend: true })).toBe(false);
    expect(passesShow('between-weekends', { signedIn: null, raceWeekend: null })).toBe(true);
    expect(passesShow('phones', { signedIn: false, raceWeekend: false })).toBe(true);
    expect(passesShow('desktop', { signedIn: false, raceWeekend: false })).toBe(true);
  });

  it('applyShow drops the regions whose rule fails and keeps the document as it was when none does; showAsks names the facts the rules need', () => {
    const parsed = parsePageDocument(
      doc([
        region({ id: 'a', component: 'page.body' }),
        region({ id: 'b', kind: 'static', text: 'members', show: 'signed-in' }),
        region({ id: 'c', kind: 'static', text: 'guests', show: 'signed-out' }),
        region({ id: 'd', kind: 'static', text: 'race', show: 'race-weekend' }),
      ]),
    ).value;
    expect(showAsks(parsed)).toEqual({ visitor: true, calendar: true });
    expect(showAsks(DOC)).toEqual({ visitor: false, calendar: false });
    expect(applyShow(parsed, { signedIn: true, raceWeekend: false }).regions.map(r => r.id)).toEqual(['a', 'b']);
    expect(applyShow(parsed, { signedIn: false, raceWeekend: null }).regions.map(r => r.id)).toEqual(['a', 'c', 'd']);
    expect(applyShow(DOC, { signedIn: false, raceWeekend: false })).toBe(DOC);
  });
});

describe('Header Text, Footer Text and the Build Option (the components programme, P1.3)', () => {
  const region = (over: Record<string, unknown>) => ({ id: 'r', kind: 'static', title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'body', ...over });
  const doc = (regions: unknown[], version: unknown = 2) => ({ version, regions, actions: [] });

  it('reads a version 1 document as version 2 with the three attributes absent, and a version 2 document with them', () => {
    const old = parsePageDocument(doc([region({})], 1));
    expect(old.problems).toEqual([]);
    expect(old.value.version).toBe(2);
    expect(old.value.regions[0]).not.toHaveProperty('headerText');
    expect(old.value.regions[0]).not.toHaveProperty('footerText');
    expect(old.value.regions[0]).not.toHaveProperty('buildOption');
    const full = parsePageDocument(doc([region({ headerText: ' Above ', footerText: 'Below {shortcut:times.local}', buildOption: 'weather' })]));
    expect(full.problems).toEqual([]);
    expect(full.value.regions[0]).toMatchObject({ headerText: 'Above', footerText: 'Below {shortcut:times.local}', buildOption: 'weather' });
  });

  it('leaves an empty text or option out, and refuses a text over the limit or an option the site does not have', () => {
    const empty = parsePageDocument(doc([region({ headerText: '  ', footerText: '', buildOption: '' })]));
    expect(empty.problems).toEqual([]);
    expect(empty.value.regions[0]).not.toHaveProperty('headerText');
    expect(empty.value.regions[0]).not.toHaveProperty('footerText');
    expect(empty.value.regions[0]).not.toHaveProperty('buildOption');
    const long = parsePageDocument(doc([region({ headerText: 'x'.repeat(301) }), region({ id: 'f', footerText: 'y'.repeat(301) })]));
    expect(long.value.regions).toEqual([]);
    expect(long.problems).toEqual(['region r: the header text is at most 300 characters', 'region f: the footer text is at most 300 characters']);
    const unknown = parsePageDocument(doc([region({ buildOption: 'holograms' })]));
    expect(unknown.value.regions).toEqual([]);
    expect(unknown.problems).toEqual(['region r: the build option must be one of ghost_lap_3d, weather, social, studio']);
  });

  it('applyBuildOptions drops the regions whose option is Excluded and keeps the rest, the document untouched when nothing changes', () => {
    const parsed = parsePageDocument(
      doc([region({ id: 'a' }), region({ id: 'b', buildOption: 'weather' }), region({ id: 'c', buildOption: 'social' }), region({ id: 'd', buildOption: 'studio' })]),
    ).value;
    expect(applyBuildOptions(parsed, { weather: 'exclude', social: 'include' }).regions.map(r => r.id)).toEqual(['a', 'c', 'd']);
    expect(applyBuildOptions(parsed, { weather: 'include', social: 'include', studio: 'include', ghost_lap_3d: 'exclude' })).toBe(parsed);
    expect(applyBuildOptions(parsed, {})).toBe(parsed);
  });
});

describe('Template Options on a region (the components programme, P1.2)', () => {
  const region = (over: Record<string, unknown>) => ({ id: 'r', kind: 'static', title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'body', ...over });
  const doc = (regions: unknown[]) => ({ version: 2, regions, actions: [] });

  it('reads an absent list, or one that only says defaults, as absent; keeps a list canonical; keeps an empty list, which turns the defaults off', () => {
    expect(parsePageDocument(doc([region({})])).value.regions[0]).not.toHaveProperty('templateOptions');
    expect(parsePageDocument(doc([region({ templateOptions: ['#DEFAULT#'] })])).value.regions[0]).not.toHaveProperty('templateOptions');
    const picked = parsePageDocument(doc([region({ templateOptions: ['WIDTH_READING', 'SPACING_COMPACT', '#DEFAULT#'] })]));
    expect(picked.problems).toEqual([]);
    expect(picked.value.regions[0]).toMatchObject({ templateOptions: ['#DEFAULT#', 'SPACING_COMPACT', 'WIDTH_READING'] });
    expect(parsePageDocument(doc([region({ templateOptions: [] })])).value.regions[0]).toMatchObject({ templateOptions: [] });
  });

  it('refuses an identifier the code does not have and two options of one group, naming the region', () => {
    const unknown = parsePageDocument(doc([region({ templateOptions: ['#DEFAULT#', 'SPACING_HUGE'] })]));
    expect(unknown.value.regions).toEqual([]);
    expect(unknown.problems).toEqual(['region r: names a template option the code does not have (SPACING_HUGE)']);
    const twice = parsePageDocument(doc([region({ templateOptions: ['RULE_ABOVE', 'RULE_BELOW'] })]));
    expect(twice.value.regions).toEqual([]);
    expect(twice.problems).toEqual(['region r: picks two options of Rule (RULE_ABOVE, RULE_BELOW)']);
    expect(parsePageDocument(doc([region({ templateOptions: 'RULE_ABOVE' })])).problems).toEqual(['region r: the template options must be a list']);
  });
});

describe('row page paths', () => {
  const code = ['/', '/about', '/series/[slug]', '/series/[slug]/[tab]', '/archive/[season]/[slug]/weekend/[round]', '/sign-in'];

  it('matches a registry pattern segment by segment', () => {
    expect(patternMatches('/series/[slug]', '/series/monza')).toBe(true);
    expect(patternMatches('/series/[slug]', '/series/monza/history')).toBe(false);
    expect(patternMatches('/series/[slug]/[tab]', '/series/f1/standings')).toBe(true);
    expect(patternMatches('/about', '/about')).toBe(true);
    expect(patternMatches('/about', '/about-us')).toBe(false);
    expect(patternMatches('/docs/[...rest]', '/docs/a/b/c')).toBe(true);
  });

  it('refuses a malformed, reserved, code-owned or duplicate path and accepts a free one', () => {
    expect(rowPagePathProblem('', code)).toBe('needs a path');
    expect(rowPagePathProblem('history/monza', code)).toMatch(/lower-case letters/);
    expect(rowPagePathProblem('/History', code)).toMatch(/lower-case letters/);
    expect(rowPagePathProblem('/api/anything', code)).toBe('that part of the site is reserved');
    expect(rowPagePathProblem('/media', code)).toBe('that part of the site is reserved');
    expect(rowPagePathProblem('/preview/anything', code)).toBe('that part of the site is reserved');
    expect(rowPagePathProblem('/about', code)).toBe('the code already serves /about');
    expect(rowPagePathProblem('/series/monza', code)).toBe('the code already serves /series/[slug]');
    expect(rowPagePathProblem('/history/monza', code, ['/history/monza'])).toBe('a page with this path exists already');
    expect(rowPagePathProblem('/history/monza', code)).toBeNull();
    expect(rowPagePathProblem('/a/b/c/d/e/f/g', code)).toMatch(/six deep/);
  });
});
