import { describe, expect, it } from 'vitest';
import {
  EMPTY_DOCUMENT,
  documentRefs,
  parsePageDocument,
  patternMatches,
  refRows,
  rowPagePathProblem,
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

  it('refuses what is not a document, an unknown version, and a regions field that is not a list', () => {
    expect(parsePageDocument(null)).toEqual({ value: EMPTY_DOCUMENT, problems: ['the document must be an object'] });
    expect(parsePageDocument({ version: 2, regions: [] })).toEqual({ value: EMPTY_DOCUMENT, problems: ['unknown document version 2'] });
    expect(parsePageDocument({ version: 1, regions: 'x' })).toEqual({ value: EMPTY_DOCUMENT, problems: ['regions must be a list'] });
    expect(parsePageDocument({ version: 1, regions: [] })).toEqual({ value: EMPTY_DOCUMENT, problems: [] });
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
