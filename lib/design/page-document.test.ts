import { describe, expect, it } from 'vitest';
import {
  EMPTY_DOCUMENT,
  applyBuildOptions,
  applyConditions,
  conditionAsks,
  conditionText,
  childrenOf,
  descendantsOf,
  documentRefs,
  firstBodyRegion,
  isInside,
  parentOf,
  isLegacyBody,
  parsePageDocument,
  passesCondition,
  patternMatches,
  refRows,
  rowPagePathProblem,
  isGoDestination,
  RECOVERY_DAYS,
  daysLeft,
  purgeDueAt,
  overlappingRegions,
  rowMates,
  rowsAt,
  schemesAsked,
  substituteShortcuts,
  type Condition,
  type PageDocument,
} from './page-document';
import { COMPONENTS, type ComponentDefinition } from './components';

const ASSET = 'a1b2c3d4-0000-4000-8000-000000000001';
const DOC: PageDocument = {
  version: 1,
  actions: [],
  regions: [
    { id: 'intro', kind: 'static', title: 'Monza, a history', position: 'body', seq: 10, column: 1, span: 8, newRow: false, hidden: false, authz: null, text: 'The Autodromo opened in 1922. {shortcut:times.local} {shortcut:data.sources}' },
    { id: 'photo', kind: 'image', title: '', position: 'body', seq: 20, column: 9, span: 4, newRow: false, hidden: false, authz: null, assetId: ASSET, alt: 'The grid at Monza', showCaption: true, headerText: 'The grid {shortcut:hdr.note}' },
    { id: 'more', kind: 'list', title: 'More', position: 'right', seq: 10, column: 1, span: 12, newRow: false, hidden: false, authz: 'signed_in', listKey: 'footer-site', style: 'links', footerText: 'Times {shortcut:times.local}' },
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

  it('projects every reference a document names, unique and sorted; a shortcut in a header or footer text counts (P1.13)', () => {
    expect(documentRefs(DOC)).toEqual({
      lists: ['footer-site'],
      assets: [ASSET],
      authz: ['signed_in'],
      shortcuts: ['data.sources', 'hdr.note', 'times.local'],
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

  it('reads a component’s link attribute against the destination rule and projects it into the refs; a colour outside its rule is a problem (P2.0)', () => {
    const card: ComponentDefinition = {
      key: 'test.card',
      name: 'Card',
      group: 'Page',
      holds: 'a card',
      settings: [
        { key: 'more', label: 'Read more', kind: 'link', default: '' },
        { key: 'accent', label: 'Accent', kind: 'colour', default: '#8c1c13' },
      ],
    };
    const components = [...COMPONENTS, card];
    const ok = parsePageDocument(doc([region({ component: 'test.card', settings: { more: 'calendar', accent: '#123456' } })]), components);
    expect(ok.problems).toEqual([]);
    expect(ok.value.regions[0]).toMatchObject({ component: 'test.card', settings: { more: 'calendar', accent: '#123456' } });
    expect(documentRefs(ok.value, components).dests).toEqual(['calendar']);
    // Without the definition the attribute is not known as a link: nothing is projected.
    expect(documentRefs(ok.value).dests).toEqual([]);
    const nowhere = parsePageDocument(doc([region({ component: 'test.card', settings: { more: 'nowhere-at-all' } })]), components);
    expect(nowhere.problems).toEqual(['region r: Read more must be a page or a link from the catalogue']);
    expect(nowhere.value.regions).toEqual([]);
    expect(parsePageDocument(doc([region({ component: 'test.card', settings: { accent: 'red' } })]), components).problems).toEqual(['region r: Accent must be a colour as #rrggbb']);
    expect(parsePageDocument(doc([region({ component: 'test.card' })])).problems).toEqual(['region r: names a component the code does not have (test.card)']);
  });

  it('P2.1: a component region carries a Source when its definition declares sources, stored canonically; a bad ref, or a source on a component that reads none, is the writer’s refusal naming the region', () => {
    const ok = parsePageDocument(doc([region({ component: 'home.changed', source: 'standings?season=2026&series=f1' })]));
    expect(ok.problems).toEqual([]);
    expect(ok.value.regions[0]).toMatchObject({ component: 'home.changed', settings: { rows: 5 }, source: 'standings?series=f1&season=2026' });
    const none = parsePageDocument(doc([region({ component: 'home.changed' })]));
    expect(none.problems).toEqual([]);
    expect(none.value.regions[0]).not.toHaveProperty('source');
    expect(parsePageDocument(doc([region({ component: 'home.changed', source: '' })])).value.regions[0]).not.toHaveProperty('source');
    expect(parsePageDocument(doc([region({ component: 'home.changed', source: 'standings?season=2026' })])).problems).toEqual(['region r: Standings needs a series']);
    expect(parsePageDocument(doc([region({ component: 'home.changed', source: 'posts?count=3' })])).problems).toEqual(['region r: Source must be one of Standings']);
    expect(parsePageDocument(doc([region({ component: 'home.changed', source: 'standings?series=f1&season=2025' })])).value.regions).toEqual([]);
    expect(parsePageDocument(doc([region({ component: 'home.wire', source: 'standings?series=f1&season=2026' })])).problems).toEqual(['region r: The wire reads no source']);
    expect(parsePageDocument(doc([region({ component: 'home.changed', source: 42 })])).problems).toEqual(['region r: Source must be text']);
  });

  it('P2.2: a Data region’s preset is bound to its Source: another source’s preset, a series the preset lacks, or one not yet pickable is the writer’s refusal in words; a preset with no Source parses', () => {
    const ok = parsePageDocument(doc([region({ component: 'data.region', settings: { preset: 'constructors', view: 'cards' }, source: 'standings?series=f1&season=2026' })]));
    expect(ok.problems).toEqual([]);
    expect(ok.value.regions[0]).toMatchObject({ component: 'data.region', settings: { preset: 'constructors', view: 'cards', rows: 10, heading: '' }, source: 'standings?series=f1&season=2026' });
    expect(parsePageDocument(doc([region({ component: 'data.region', settings: { preset: 'drivers' } })])).problems).toEqual([]);
    expect(parsePageDocument(doc([region({ component: 'data.region', settings: { preset: 'drivers' }, source: 'results?series=f1&season=2026' })])).problems).toEqual(['region r: Drivers is a Standings preset; this region reads Results']);
    expect(parsePageDocument(doc([region({ component: 'data.region', settings: { preset: 'imsa-gtp-drivers' }, source: 'standings?series=f1&season=2026' })])).problems).toEqual(['region r: GTP — Drivers is not a preset of Formula 1']);
    expect(parsePageDocument(doc([region({ component: 'data.region', settings: { preset: 'wec-lmgt3-teams' }, source: 'standings?series=wec&season=2026' })])).problems).toEqual([]);
    // P2.2 B1: the results presets parse against a Results source, stored with the List view they bring.
    const rounds = parsePageDocument(doc([region({ component: 'data.region', settings: { preset: 'season-results', view: 'list' }, source: 'results?series=f1&season=2026' })]));
    expect(rounds.problems).toEqual([]);
    expect(rounds.value.regions[0]).toMatchObject({ settings: { preset: 'season-results', view: 'list', rows: 10, heading: '' }, source: 'results?series=f1&season=2026' });
    expect(parsePageDocument(doc([region({ component: 'data.region', settings: { preset: 'feature-races' }, source: 'results?series=f2&season=2026' })])).problems).toEqual([]);
    expect(parsePageDocument(doc([region({ component: 'data.region', settings: { preset: 'feature-races' }, source: 'results?series=f1&season=2026' })])).problems).toEqual(['region r: Feature races is not a preset of Formula 1']);
    expect(parsePageDocument(doc([region({ component: 'data.region', settings: { preset: 'season-results-wec' }, source: 'results?series=wec&season=2026' })])).problems).toEqual([]);
  });

  it('P2.2: a choice option not yet pickable (`later`) is the writer’s refusal with its reason, on any definition that carries one', () => {
    const later: ComponentDefinition = {
      key: 'test.later',
      name: 'Later',
      group: 'Data',
      holds: 'a test',
      settings: [{ key: 'mode', label: 'Mode', kind: 'choice', default: 'now', options: [{ key: 'now', label: 'Now' }, { key: 'soon', label: 'Soon', later: 'arrives with a later step' }] }],
    };
    const components = [...COMPONENTS, later];
    expect(parsePageDocument(doc([region({ component: 'test.later', settings: { mode: 'now' } })]), components).problems).toEqual([]);
    expect(parsePageDocument(doc([region({ component: 'test.later', settings: { mode: 'soon' } })]), components).problems).toEqual(['region r: Soon arrives with a later step']);
  });

  // The Conditions vocabulary (P2.6; APEX: Server-side Condition, Appendix E).
  const LABELS =
    'Never, User is authenticated (not public), User is the public user (user has not authenticated), Race weekend, Between weekends, Phones, Desktop and laptop, Request = Value, Current Page is in comma delimited list, Item = Value';
  const PAGES_PROBLEM = 'region r: Current Page is in comma delimited list needs 1 to 20 paths of this site, like /history/monza';

  it('P2.6: reads a condition of each type and stores it canonically in one field order, leaves it out when absent, and refuses one it does not know or cannot evaluate yet', () => {
    const parsed = (condition: unknown) => parsePageDocument(doc([region({ component: 'page.body', condition })]));
    expect(parsed(undefined).value.regions[0]).not.toHaveProperty('condition');
    expect(parsed(null).value.regions[0]).not.toHaveProperty('condition');
    for (const type of ['never', 'authenticated', 'public', 'race-weekend', 'between-weekends', 'phones', 'desktop'] as const) {
      const r = parsed({ type, part: 'ignored' });
      expect(r.problems).toEqual([]);
      expect(r.value.regions[0].condition).toEqual({ type });
    }
    const req = parsed({ value: ' f1 ', part: 'slug', type: 'request-equals' });
    expect(req.problems).toEqual([]);
    expect(JSON.stringify(req.value.regions[0].condition)).toBe('{"type":"request-equals","part":"slug","value":"f1"}');
    const pages = parsed({ pages: ['/series/f1', ' /series/f1 ', '/series/motogp', ''], type: 'page-in' });
    expect(pages.problems).toEqual([]);
    expect(JSON.stringify(pages.value.regions[0].condition)).toBe('{"type":"page-in","pages":["/series/f1","/series/motogp"]}');
    // The comma-delimited string the type is named for is read too.
    expect(parsed({ type: 'page-in', pages: '/a, /b,' }).value.regions[0].condition).toEqual({ type: 'page-in', pages: ['/a', '/b'] });
    const unknown = parsed({ type: 'on tuesdays' });
    expect(unknown.value.regions).toEqual([]);
    expect(unknown.problems).toEqual([`region r: the condition must be one of ${LABELS}`]);
    expect(parsed('never').problems).toEqual(['region r: the condition must be an object with a type']);
    // The same words the Rules group's note uses for the disabled entry.
    expect(parsed({ type: 'item-equals', item: 'p1', value: 'x' }).problems).toEqual(['region r: Item = Value arrives with the page items (P2.18)']);
    expect(parsed({ type: 'request-equals', value: 'f1' }).problems).toEqual(['region r: Request = Value needs a part of the address, like slug']);
    expect(parsed({ type: 'request-equals', part: 'Slug!', value: 'f1' }).problems).toEqual(['region r: Request = Value needs a part of the address, like slug']);
    expect(parsed({ type: 'request-equals', part: 'slug', value: '  ' }).problems).toEqual(['region r: Request = Value needs a value of 1 to 80 characters']);
    expect(parsed({ type: 'request-equals', part: 'slug', value: 'x'.repeat(81) }).problems).toEqual(['region r: Request = Value needs a value of 1 to 80 characters']);
    expect(parsed({ type: 'page-in', pages: [] }).problems).toEqual([PAGES_PROBLEM]);
    expect(parsed({ type: 'page-in', pages: ['https://example.com/a'] }).problems).toEqual([PAGES_PROBLEM]);
    expect(parsed({ type: 'page-in', pages: ['/Series/[slug]'] }).problems).toEqual([PAGES_PROBLEM]);
    expect(parsed({ type: 'page-in', pages: Array.from({ length: 21 }, (_, i) => `/p${i}`) }).problems).toEqual([PAGES_PROBLEM]);
  });

  it('P2.6: every show rule of a document stored before the conditions maps to its condition, for one release; a condition beside it wins', () => {
    const map: Record<string, unknown> = {
      always: undefined,
      'race-weekend': { type: 'race-weekend' },
      'between-weekends': { type: 'between-weekends' },
      'signed-in': { type: 'authenticated' },
      'signed-out': { type: 'public' },
      phones: { type: 'phones' },
      desktop: { type: 'desktop' },
    };
    for (const [show, condition] of Object.entries(map)) {
      const r = parsePageDocument(doc([region({ component: 'page.body', show })]));
      expect(r.problems).toEqual([]);
      expect(r.value.regions[0]).not.toHaveProperty('show');
      if (condition === undefined) expect(r.value.regions[0]).not.toHaveProperty('condition');
      else expect(r.value.regions[0].condition).toEqual(condition);
    }
    expect(parsePageDocument(doc([region({ component: 'page.body', show: 'signed-in', condition: { type: 'never' } })])).value.regions[0].condition).toEqual({ type: 'never' });
    const unknown = parsePageDocument(doc([region({ component: 'page.body', show: 'on tuesdays' })]));
    expect(unknown.value.regions).toEqual([]);
    expect(unknown.problems).toEqual([`region r: the show rule must be one of always, race-weekend, between-weekends, signed-in, signed-out, phones, desktop; the conditions replace it: ${LABELS}`]);
  });

  it('P2.6 passesCondition: Never fails in every context; a fact the server has not got shows the region; phones and desktop pass here because the stylesheet decides them', () => {
    const none = { signedIn: null, raceWeekend: null, params: null, path: null };
    expect(passesCondition(undefined, none)).toBe(true);
    expect(passesCondition({ type: 'never' }, none)).toBe(false);
    expect(passesCondition({ type: 'never' }, { signedIn: true, raceWeekend: true, params: { slug: 'f1' }, path: '/series/f1' })).toBe(false);
    expect(passesCondition({ type: 'authenticated' }, { ...none, signedIn: false })).toBe(false);
    expect(passesCondition({ type: 'authenticated' }, { ...none, signedIn: true })).toBe(true);
    expect(passesCondition({ type: 'authenticated' }, none)).toBe(true);
    expect(passesCondition({ type: 'public' }, { ...none, signedIn: true })).toBe(false);
    expect(passesCondition({ type: 'public' }, { ...none, signedIn: false })).toBe(true);
    expect(passesCondition({ type: 'race-weekend' }, { ...none, raceWeekend: false })).toBe(false);
    expect(passesCondition({ type: 'between-weekends' }, { ...none, raceWeekend: true })).toBe(false);
    expect(passesCondition({ type: 'between-weekends' }, none)).toBe(true);
    expect(passesCondition({ type: 'phones' }, { ...none, signedIn: false, raceWeekend: false })).toBe(true);
    expect(passesCondition({ type: 'desktop' }, { ...none, signedIn: false, raceWeekend: false })).toBe(true);
    const f1: Condition = { type: 'request-equals', part: 'slug', value: 'f1' };
    expect(passesCondition(f1, none)).toBe(true);
    expect(passesCondition(f1, { ...none, params: { slug: 'f1' } })).toBe(true);
    expect(passesCondition(f1, { ...none, params: { slug: 'motogp' } })).toBe(false);
    // A part the address does not have is a fact not known: the region shows.
    expect(passesCondition(f1, { ...none, params: { round: '14' } })).toBe(true);
    expect(passesCondition(f1, { ...none, params: {} })).toBe(true);
    const monza: Condition = { type: 'page-in', pages: ['/history/monza', '/history/spa'] };
    expect(passesCondition(monza, none)).toBe(true);
    expect(passesCondition(monza, { ...none, path: '/history/monza' })).toBe(true);
    expect(passesCondition(monza, { ...none, path: '/history/imola' })).toBe(false);
  });

  it('P2.6 applyConditions drops the regions whose condition fails and keeps the document as it was when none does; conditionAsks names the facts the conditions need', () => {
    const parsed = parsePageDocument(
      doc([
        region({ id: 'a', component: 'page.body' }),
        region({ id: 'b', kind: 'static', text: 'members', condition: { type: 'authenticated' } }),
        region({ id: 'c', kind: 'static', text: 'guests', condition: { type: 'public' } }),
        region({ id: 'd', kind: 'static', text: 'race', condition: { type: 'race-weekend' } }),
        region({ id: 'e', kind: 'static', text: 'gone', condition: { type: 'never' } }),
        region({ id: 'f', kind: 'static', text: 'f1', condition: { type: 'request-equals', part: 'slug', value: 'f1' } }),
      ]),
    ).value;
    expect(conditionAsks(parsed)).toEqual({ visitor: true, calendar: true });
    expect(conditionAsks(DOC)).toEqual({ visitor: false, calendar: false });
    expect(applyConditions(parsed, { signedIn: true, raceWeekend: false, params: { slug: 'f1' }, path: '/series/f1' }).regions.map(r => r.id)).toEqual(['a', 'b', 'f']);
    expect(applyConditions(parsed, { signedIn: false, raceWeekend: null, params: { slug: 'motogp' }, path: null }).regions.map(r => r.id)).toEqual(['a', 'c', 'd']);
    expect(applyConditions(parsed, { signedIn: false, raceWeekend: null, params: null, path: null }).regions.map(r => r.id)).toEqual(['a', 'c', 'd', 'f']);
    expect(applyConditions(DOC, { signedIn: false, raceWeekend: false, params: {}, path: '/x' })).toBe(DOC);
  });

  it("P2.6 conditionText names a condition in APEX's words, with its value; empty when there is none", () => {
    expect(conditionText(undefined)).toBe('');
    expect(conditionText({ type: 'never' })).toBe('Never');
    expect(conditionText({ type: 'authenticated' })).toBe('User is authenticated (not public)');
    expect(conditionText({ type: 'request-equals', part: 'slug', value: 'f1' })).toBe('Request = Value: slug = f1');
    expect(conditionText({ type: 'page-in', pages: ['/a', '/b'] })).toBe('Current Page is in comma delimited list: /a, /b');
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

describe('Comment Out (the components programme, P1.11)', () => {
  const region = (over: Record<string, unknown>) => ({ id: 'r', kind: 'static', title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'body', ...over });
  const doc = (regions: unknown[]) => ({ version: 2, regions, actions: [] });

  it('reads commentedOut true, and leaves it out when false, absent or not a boolean, as hidden and newRow are read', () => {
    const on = parsePageDocument(doc([region({ commentedOut: true })]));
    expect(on.problems).toEqual([]);
    expect(on.value.regions[0]).toMatchObject({ commentedOut: true });
    for (const raw of [region({}), region({ commentedOut: false }), region({ commentedOut: 'yes' })]) {
      const off = parsePageDocument(doc([raw]));
      expect(off.problems).toEqual([]);
      expect(off.value.regions[0]).not.toHaveProperty('commentedOut');
    }
  });

  it('applyBuildOptions drops a commented-out region as it drops an Excluded one, keeps the rest, and returns the document itself when none is', () => {
    const parsed = parsePageDocument(
      doc([region({ id: 'a' }), region({ id: 'b', commentedOut: true }), region({ id: 'c', buildOption: 'weather' }), region({ id: 'd', commentedOut: true, buildOption: 'social' })]),
    ).value;
    expect(applyBuildOptions(parsed, {}).regions.map(r => r.id)).toEqual(['a', 'c']);
    expect(applyBuildOptions(parsed, { weather: 'exclude' }).regions.map(r => r.id)).toEqual(['a']);
    const none = parsePageDocument(doc([region({ id: 'a' }), region({ id: 'c', buildOption: 'weather' })])).value;
    expect(applyBuildOptions(none, {})).toBe(none);
  });

  it('a commented-out region keeps naming its rows in the refs projection: the write path stores the document as drawn, not as run', () => {
    const parsed = parsePageDocument(doc([region({ id: 'a', commentedOut: true, text: 'Hello {shortcut:times.local}', authz: 'signed_in' })])).value;
    expect(documentRefs(parsed)).toMatchObject({ shortcuts: ['times.local'], authz: ['signed_in'] });
  });
});

describe('page destinations in a document (P1.12 B2)', () => {
  const PAGE = 'a1b2c3d4-0000-4000-8000-000000000010';
  const region = (over: Record<string, unknown>) => ({ id: 'r', kind: 'static', title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'body', ...over });
  const doc = (regions: unknown[], actions: unknown[] = []) => ({ version: 2, regions, actions });

  it('a page key has the shape of a destination a button or a go effect may name; a malformed one has not', () => {
    expect(isGoDestination(`page:${PAGE}`)).toBe(true);
    expect(isGoDestination('page:nope')).toBe(false);
    expect(isGoDestination('page:')).toBe(false);
  });

  it('the parser keeps a button and a go effect naming a page, and the refs projection carries the key as a dest', () => {
    const parsed = parsePageDocument(
      doc([region({ id: 'go', kind: 'button', label: 'Read Monza', dest: `page:${PAGE}` })], [{ id: 'a1', name: 'Jump', when: { event: 'load' }, do: [{ action: 'go', dest: `page:${PAGE}` }] }]),
    );
    expect(parsed.problems).toEqual([]);
    expect(parsed.value.regions[0]).toMatchObject({ kind: 'button', dest: `page:${PAGE}` });
    expect(parsed.value.actions[0].do).toEqual([{ action: 'go', dest: `page:${PAGE}` }]);
    expect(documentRefs(parsed.value).dests).toEqual([`page:${PAGE}`]);
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

describe('Appearance › Template on a region (the components programme, P1.1)', () => {
  const region = (over: Record<string, unknown>) => ({ id: 'r', kind: 'static', title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'body', ...over });
  const doc = (regions: unknown[]) => ({ version: 2, regions, actions: [] });

  it('keeps a look, reads absent, empty and Plain as absent, and refuses a template the code does not have, naming the region', () => {
    expect(parsePageDocument(doc([region({})])).value.regions[0]).not.toHaveProperty('template');
    expect(parsePageDocument(doc([region({ template: '' })])).value.regions[0]).not.toHaveProperty('template');
    expect(parsePageDocument(doc([region({ template: 'standard' })])).value.regions[0]).not.toHaveProperty('template');
    const boxed = parsePageDocument(doc([region({ template: 'boxed' })]));
    expect(boxed.problems).toEqual([]);
    expect(boxed.value.regions[0]).toMatchObject({ template: 'boxed' });
    const unknown = parsePageDocument(doc([region({ template: 'nope' })]));
    expect(unknown.value.regions).toEqual([]);
    expect(unknown.problems).toEqual(['region r: the template must be one of standard, boxed, band, aside, hero']);
  });
});

describe('Sub regions (the components programme, P1.4)', () => {
  const region = (over: Record<string, unknown>) => ({ id: 'r', kind: 'static', title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'body', ...over });
  const doc = (regions: unknown[]) => ({ version: 2, regions, actions: [] });
  const ids = (d: { regions: { id: string }[] }) => d.regions.map(r => r.id);

  it('keeps a parent the page has; refuses a parent it lacks, a region inside itself, a cycle and a position other than the parent’s; a dropped region takes its descendants with it', () => {
    const ok = parsePageDocument(doc([region({ id: 'story' }), region({ id: 'pull', parent: 'story', seq: 20 })]));
    expect(ok.problems).toEqual([]);
    expect(ok.value.regions.find(r => r.id === 'pull')).toMatchObject({ parent: 'story', position: 'body' });
    expect(ok.value.regions.find(r => r.id === 'story')).not.toHaveProperty('parent');
    expect(parsePageDocument(doc([region({ id: 'story', parent: null }), region({ id: 'pull', parent: '', seq: 20 })])).value.regions.every(r => !('parent' in r))).toBe(true);
    const missing = parsePageDocument(doc([region({ id: 'pull', parent: 'nope' })]));
    expect(missing.value.regions).toEqual([]);
    expect(missing.problems).toEqual(['region pull: names a parent the page does not have (nope)']);
    expect(parsePageDocument(doc([region({ id: 'pull', parent: 'Bad Id' })])).problems).toEqual(['region pull: the parent must be a region id']);
    const self = parsePageDocument(doc([region({ id: 'loop', parent: 'loop' })]));
    expect(self.value.regions).toEqual([]);
    expect(self.problems).toEqual(['region loop: is inside itself']);
    const cycle = parsePageDocument(doc([region({ id: 'a', parent: 'b' }), region({ id: 'b', parent: 'a', seq: 20 })]));
    expect(cycle.value.regions).toEqual([]);
    expect(cycle.problems).toEqual(['region a: is inside itself', 'region b: is inside itself']);
    const elsewhere = parsePageDocument(doc([region({ id: 'story' }), region({ id: 'pull', parent: 'story', position: 'footer' })]));
    expect(ids(elsewhere.value)).toEqual(['story']);
    expect(elsewhere.problems).toEqual(['region pull: must sit in its parent’s position (body)']);
    // Three levels: the grandparent's bad parent takes the child and the grandchild with it; an unrelated region stays.
    const cascade = parsePageDocument(doc([region({ id: 'a', parent: 'nope' }), region({ id: 'b', parent: 'a', seq: 20 }), region({ id: 'c', parent: 'b', seq: 30 }), region({ id: 'd', seq: 40 })]));
    expect(ids(cascade.value)).toEqual(['d']);
    expect(cascade.problems).toEqual(['region a: names a parent the page does not have (nope)', 'region b: left with its parent a', 'region c: left with its parent b']);
  });

  it('groups rows by parent: the page level draws no sub region, a parent’s rows hold its children, and the row mates and the overlaps stay inside one group', () => {
    const d = parsePageDocument(
      doc([
        region({ id: 'story', span: 8 }),
        region({ id: 'aside', seq: 20, column: 9, span: 4, newRow: false }),
        region({ id: 'one', parent: 'story', seq: 10, column: 1, span: 6 }),
        region({ id: 'two', parent: 'story', seq: 20, column: 7, span: 6, newRow: false }),
        region({ id: 'three', parent: 'story', seq: 30, column: 1, span: 6, newRow: false }),
      ]),
    ).value;
    expect(rowsAt(d, 'body').map(row => row.map(r => r.id))).toEqual([['story', 'aside']]);
    expect(rowsAt(d, 'body', null).map(row => row.map(r => r.id))).toEqual([['story', 'aside']]);
    expect(rowsAt(d, 'body', 'story').map(row => row.map(r => r.id))).toEqual([['one', 'two'], ['three']]);
    expect(rowsAt(d, 'body', 'aside')).toEqual([]);
    expect(rowMates(d, d.regions.find(r => r.id === 'three')!).map(r => r.id)).toEqual(['one', 'two']);
    expect(rowMates(d, d.regions.find(r => r.id === 'aside')!).map(r => r.id)).toEqual(['story']);
    // three shares one's columns inside story: an overlap in the parent's group; aside shares no group with the children.
    expect(overlappingRegions(d)).toEqual([{ position: 'body', parent: 'story', a: 'one', b: 'three', from: 1, to: 6 }]);
    expect(childrenOf(d, 'story').map(r => r.id)).toEqual(['one', 'two', 'three']);
    expect(childrenOf(d, 'aside')).toEqual([]);
    expect(parentOf(d.regions.find(r => r.id === 'one')!)).toBe('story');
    expect(parentOf(d.regions.find(r => r.id === 'story')!)).toBeNull();
    expect(isInside(d, 'three', 'story')).toBe(true);
    expect(isInside(d, 'story', 'three')).toBe(false);
    expect(isInside(d, 'story', 'story')).toBe(true);
  });

  it('a region dropped by a condition or a build option takes its descendants with it; the phone bar counts page-level regions', () => {
    const d = parsePageDocument(
      doc([
        region({ id: 'story', condition: { type: 'authenticated' } }),
        region({ id: 'pull', parent: 'story', seq: 20 }),
        region({ id: 'deep', parent: 'pull', seq: 30 }),
        region({ id: 'other', seq: 40, commentedOut: true }),
        region({ id: 'inner', parent: 'other', seq: 50 }),
      ]),
    ).value;
    expect(applyConditions(d, { signedIn: false, raceWeekend: null, params: null, path: null }).regions.map(r => r.id)).toEqual(['other', 'inner']);
    expect(applyConditions(d, { signedIn: true, raceWeekend: null, params: null, path: null })).toBe(d);
    expect(applyBuildOptions(d, {}).regions.map(r => r.id)).toEqual(['story', 'pull', 'deep']);
    expect(descendantsOf(d, 'story')).toEqual(['pull', 'deep']);
    expect(descendantsOf(d, 'deep')).toEqual([]);
    const bar = parsePageDocument(doc([region({ id: 'bar', position: 'phonebar' }), region({ id: 'cell', parent: 'bar', position: 'phonebar', seq: 20 })]));
    expect(bar.problems).toEqual([]);
    // The page's h1 goes to the first page-level Body region showing, never to a sub region that comes first in the document.
    const early = parsePageDocument(doc([region({ id: 'story', seq: 10 }), region({ id: 'inner', parent: 'story', seq: 5 }), region({ id: 'shy', seq: 8, hidden: true })])).value;
    expect(early.regions.map(r => r.id)).toEqual(['inner', 'shy', 'story']);
    expect(firstBodyRegion(early)?.id).toBe('story');
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
    // A deleted page holds its address until it is purged (P1.12).
    expect(rowPagePathProblem('/history/monza', code, [], ['/history/monza'])).toBe('a deleted page holds this address: reinstate it or delete it permanently');
    expect(rowPagePathProblem('/history/imola', code, ['/history/spa'], ['/history/monza'])).toBeNull();
  });

  it('the recovery window (P1.12): thirty days from the deletion, the days left rounded up and never below zero', () => {
    expect(RECOVERY_DAYS).toBe(30);
    expect(purgeDueAt('2026-09-13T10:00:00.000Z')).toBe('2026-10-13T10:00:00.000Z');
    expect(daysLeft('2026-09-13T10:00:00.000Z', Date.parse('2026-09-15T10:00:00.000Z'))).toBe(28);
    expect(daysLeft('2026-09-13T10:00:00.000Z', Date.parse('2026-09-15T09:00:00.000Z'))).toBe(29);
    expect(daysLeft('2026-08-01T10:00:00.000Z', Date.parse('2026-09-15T10:00:00.000Z'))).toBe(0);
    // Postgres's own stamp form reads too; the half second past the hour rounds the window up.
    expect(daysLeft('2026-09-13 10:00:00.5+00', Date.parse('2026-09-15T10:00:00.000Z'))).toBe(29);
  });
});
