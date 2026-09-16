import { describe, expect, it } from 'vitest';
import type { PageDocument, Region } from '@/lib/design/page-document';
import type { PageRow } from '@/lib/design/pages';
import {
  PAGE_SELECTION,
  SHIPPED_REGION_DEFAULTS,
  addAction,
  addComponent,
  addRegion,
  designerMessages,
  duplicateRegion,
  messageIndex,
  moveRegion,
  nextComponentId,
  nextRegionId,
  openPositions,
  placeRegion,
  regionName,
  regionSummary,
  removeRegion,
  goOptions,
  destinationLabel,
  effectText,
  renumber,
  sameSelection,
  searchPage,
  selectionCovers,
  spanName,
  splitBody,
  splitRecipe,
  toggleRegion,
  withImplicitBody,
  type Selection,
} from './page-designer-model';

// The Page Designer's model: where a region lands, what a removal takes with
// it, what the designer says about a page, what Page Search finds.

const STAMP = '2026-09-08T16:00:00.505502+00:00';
const page: PageRow = {
  id: 'a1b2c3d4-0000-4000-8000-000000000010',
  path: '/history/monza',
  name: 'Monza, a history',
  kind: 'row',
  group: 'editorial',
  template: 'paddock-standard',
  authz: 'public',
  title: null,
  rendering: 'cached',
  indexable: true,
  comments: null,
  updatedAt: STAMP,
};
const region = (over: Partial<Region> & { id: string }): Region =>
  ({ kind: 'static', title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'Words.', ...over }) as Region;
const doc: PageDocument = {
  version: 1,
  regions: [region({ id: 'intro', title: 'Intro', seq: 10, span: 8 }), region({ id: 'aside', title: 'Aside', seq: 20, column: 9, span: 4, newRow: false })],
  actions: [{ id: 'action-1', name: 'Unfold', when: { event: 'click', region: 'intro' }, do: [{ action: 'toggle', region: 'aside' }] }],
};

describe('placement', () => {
  it('renumbers by tens within a position and mints ids', () => {
    expect(renumber(doc.regions).map(r => r.seq)).toEqual([10, 20]);
    expect(nextRegionId('static', ['text-1'])).toBe('text-2');
    expect(nextRegionId('button', [])).toBe('button-1');
    expect(spanName(12)).toBe('Full');
    expect(spanName(5)).toBe('5/12');
  });

  it('places a region first, after, before, on the same row with a capped span, and in another position', () => {
    const first = placeRegion(doc, region({ id: 'new' }), { position: 'body', first: true, newRow: true });
    expect(first.regions.map(r => r.id)).toEqual(['new', 'intro', 'aside']);
    const after = placeRegion(doc, region({ id: 'new' }), { position: 'body', after: 'intro', newRow: false, column: 9, span: 4 });
    const placed = after.regions.find(r => r.id === 'new')!;
    expect(after.regions.map(r => r.id)).toEqual(['intro', 'new', 'aside']);
    expect(placed).toMatchObject({ column: 9, span: 4, newRow: false });
    const capped = placeRegion(doc, region({ id: 'new', span: 12 }), { position: 'body', after: 'intro', column: 11 });
    expect(capped.regions.find(r => r.id === 'new')!.span).toBe(2);
    const moved = placeRegion(doc, doc.regions[1], { position: 'right', newRow: true });
    expect(moved.regions.find(r => r.id === 'aside')).toMatchObject({ position: 'right', seq: 10, column: 1 });
    expect(moved.regions.filter(r => r.position === 'body').map(r => r.id)).toEqual(['intro']);
  });

  it('adds a region of a kind at a position, a button a quarter wide', () => {
    const added = addRegion(doc, 'button', { position: 'footer' });
    expect(added.id).toBe('button-1');
    expect(added.doc.regions.find(r => r.id === 'button-1')).toMatchObject({ position: 'footer', span: 3, kind: 'button', label: 'Read more' });
  });

  it('removing a region takes the triggers and effects that named it, and an action left empty', () => {
    const gone = removeRegion(doc, 'aside');
    expect(gone.regions.map(r => r.id)).toEqual(['intro']);
    expect(gone.actions).toEqual([]);
    const trigger = removeRegion(doc, 'intro');
    expect(trigger.actions).toEqual([]);
  });

  it('duplicates beneath the original and swaps neighbours', () => {
    const dup = duplicateRegion(doc, 'intro')!;
    expect(dup.id).toBe('text-1');
    expect(dup.doc.regions.map(r => r.id)).toEqual(['intro', 'text-1', 'aside']);
    expect(dup.doc.regions[1].title).toBe('Intro (copy)');
    expect(moveRegion(doc, 'aside', -1).regions.map(r => r.id)).toEqual(['aside', 'intro']);
    expect(moveRegion(doc, 'intro', -1).regions.map(r => r.id)).toEqual(['intro', 'aside']);
  });

  it('adds an action watching a region', () => {
    const a = addAction(doc, { event: 'click', region: 'aside' });
    expect(a.id).toBe('action-2');
    expect(a.doc.actions[1]).toMatchObject({ when: { event: 'click', region: 'aside' }, do: [{ action: 'toggle', region: 'intro' }] });
  });
});

describe('messages', () => {
  const legacy = (id: string, over: Partial<Region> = {}): Region => ({ ...region({ id }), kind: 'component', component: 'page.body', settings: {}, ...over }) as Region;

  it('says nothing for a sound page; a code page opens its Body and keeps the Right Side Column for its decision; the transitional body is one per code page and none on a row page', () => {
    expect(designerMessages(doc, page)).toEqual([]);
    const code: PageRow = { ...page, kind: 'code' };
    expect(designerMessages({ version: 1, regions: [], actions: [] }, code)).toEqual([]);
    expect(designerMessages({ version: 1, regions: [region({ id: 'welcome', title: 'Welcome', position: 'header' })], actions: [] }, code)).toEqual([]);
    expect(designerMessages({ version: 1, regions: [region({ id: 'intro', title: 'Intro' })], actions: [] }, code)).toEqual([]);
    const right = designerMessages({ version: 1, regions: [region({ id: 'aside', title: 'Aside', position: 'right' })], actions: [] }, code);
    expect(right.map(m => `${m.level}: ${m.text}`)).toEqual([
      'err: Aside sits in the Right Side Column, which waits for its own decision on a page whose body the code still draws. Move it to the Body or another position.',
    ]);
    expect(right[0].sel).toEqual({ kind: 'region', id: 'aside' });
    expect(designerMessages({ version: 1, regions: [legacy('code-body'), legacy('code-body-2', { seq: 20 })], actions: [] }, code).map(m => m.text)).toEqual([
      'The body as the code draws it is placed twice; a page has one.',
    ]);
    expect(designerMessages({ version: 1, regions: [legacy('code-body')], actions: [] }, page).map(m => m.text)).toEqual([
      'Body as the code draws it: this page has no body drawn by the code. Remove the component.',
    ]);
    expect(openPositions({ kind: 'code' })).toEqual(['header', 'breadcrumb', 'body', 'footer', 'phonebar']);
    expect(openPositions({ kind: 'row' })).toHaveLength(6);
    // A code page served from rows (its route file gone) is a page like any other.
    expect(openPositions({ kind: 'code', served: 'rows' })).toHaveLength(6);
    const composed: PageRow = { ...page, path: '/calendar', name: 'Calendar', kind: 'code', served: 'rows' };
    expect(designerMessages({ version: 1, regions: [legacy('code-body')], actions: [] }, composed).map(m => m.text)).toEqual([
      'Body as the code draws it: this page has no body drawn by the code. Remove the component.',
    ]);
    expect(designerMessages({ version: 1, regions: [region({ id: 'aside', position: 'right' })], actions: [] }, composed)).toEqual([]);
  });

  it('a commented-out region (P1.11): the Body warning counts it as not showing, Messages notes it under Configuration, Page Search finds it', () => {
    const only: PageDocument = { version: 2, regions: [region({ id: 'intro', title: 'Intro', commentedOut: true })], actions: [] };
    expect(designerMessages(only, page).map(m => `${m.level}: ${m.text}`)).toEqual([
      'warn: The Body has no region showing. The page runs as its title alone.',
      'info: Intro is commented out and leaves the page when it runs.',
    ]);
    const both: PageDocument = { version: 2, regions: [region({ id: 'intro', title: 'Intro', commentedOut: true }), region({ id: 'more', title: 'More', seq: 20 })], actions: [] };
    const ms = designerMessages(both, page);
    expect(ms.map(m => m.level)).toEqual(['info']);
    expect(ms[0]).toMatchObject({ sel: { kind: 'region', id: 'intro' }, group: 'Configuration' });
    expect(messageIndex(ms)).toEqual({});
    expect(searchPage('commented', both, page).map(h => `${h.what} · ${h.where} · ${h.value}`)).toEqual(['Region · Intro · commented · commented out']);
  });

  it('a page served from rows opens with its default composition when nothing is stored, never the transitional body', () => {
    const composed: PageRow = { ...page, path: '/calendar', name: 'Calendar', kind: 'code', served: 'rows' };
    const opened = withImplicitBody({ version: 1, regions: [], actions: [] }, composed);
    expect(opened.regions.map(r => `${r.position}:${r.id}`)).toEqual(['body:heading', 'body:month']);
    const stored: PageDocument = { version: 1, regions: [region({ id: 'own' })], actions: [] };
    expect(withImplicitBody(stored, composed)).toBe(stored);
    // A transitional body stored before the route file went (an R2 revision) opens as the recipe in its place.
    const withLegacy: PageDocument = { version: 1, regions: [legacy('code-body'), region({ id: 'own', seq: 20 })], actions: [] };
    expect(withImplicitBody(withLegacy, composed).regions.map(r => `${r.id}:${r.seq}`)).toEqual(['heading:10', 'month:20', 'own:30']);
  });

  it('a code page with no Body regions opens with the transitional body in its Body; a row page, a document that names it, and a split page are left alone', () => {
    const code: PageRow = { ...page, kind: 'code' };
    const opened = withImplicitBody({ version: 1, regions: [region({ id: 'welcome', position: 'header' })], actions: [] }, code);
    expect(opened.regions.map(r => `${r.position}:${r.id}:${r.seq}`)).toEqual(['header:welcome:10', 'body:code-body:10']);
    expect(withImplicitBody(opened, code)).toBe(opened);
    expect(withImplicitBody(doc, page)).toBe(doc);
    // Split: Body regions without the transitional body stay as they are, or the code's body would draw again.
    const split: PageDocument = { version: 1, regions: [legacy('wire', { component: 'home.wire' } as Partial<Region>)], actions: [] };
    expect(withImplicitBody(split, code)).toBe(split);
    expect(nextComponentId('page.body', ['code-body'])).toBe('code-body-2');
    expect(nextComponentId('home.wire', [])).toBe('wire');
    expect(nextComponentId('home.wire', ['wire', 'wire-2'])).toBe('wire-3');
  });

  it('places a component from the catalogue with its settings at their defaults, names it and sums it up, and refuses a key the catalogue lacks', () => {
    const placed = addComponent(doc, 'page.body', { position: 'body' })!;
    expect(placed.id).toBe('code-body');
    const r = placed.doc.regions.find(x => x.id === 'code-body')!;
    expect(r).toMatchObject({ kind: 'component', component: 'page.body', settings: {}, position: 'body', seq: 30, span: 12 });
    expect(regionName(r)).toBe('Body as the code draws it');
    expect(regionSummary(r, [], [])).toMatch(/exactly as its code writes it today/);
    expect(addComponent(doc, 'home.nothing', { position: 'body' })).toBeNull();
    expect(nextRegionId('component', [])).toBe('component-1');
  });

  it('splits Home: the transitional body gives way to its six components where it sat, What it changed and What’s next as two halves of one row; no recipe or no body, nothing', () => {
    expect(splitRecipe('/')).toEqual(['home.lead', 'home.live', 'home.result', 'home.changed', 'home.next', 'home.wire']);
    expect(splitRecipe('/nowhere')).toBeNull();
    const home: PageRow = { ...page, path: '/', name: 'Home', kind: 'code' };
    const fresh = withImplicitBody({ version: 1, regions: [region({ id: 'welcome', position: 'header' })], actions: [] }, home);
    const opened: PageDocument = { ...fresh, regions: renumber([...fresh.regions, region({ id: 'outro', title: 'Outro', seq: 90 })]) };
    const split = splitBody(opened, home.path)!;
    expect(split.regions.map(r => `${r.position}:${r.id}:${r.column}/${r.span}${r.newRow ? '' : ' same row'}`)).toEqual([
      'header:welcome:1/12',
      'body:lead:1/12',
      'body:live:1/12',
      'body:result:1/12',
      'body:changed:1/6',
      'body:next:7/6 same row',
      'body:wire:1/12',
      'body:outro:1/12',
    ]);
    expect(split.regions.filter(r => r.kind === 'component').every(r => r.kind === 'component' && r.component !== 'page.body')).toBe(true);
    expect(split.regions.find(r => r.id === 'wire')).toMatchObject({ settings: { items: 5 } });
    expect(splitBody(split, home.path)).toBeNull();
    expect(splitBody(opened, '/nowhere')).toBeNull();
  });

  it("names the parser's problems by component, the empty body, and what leads nowhere", () => {
    const bad: PageDocument = {
      version: 1,
      regions: [
        region({ id: 'photo-1', kind: 'image', assetId: '', alt: '', showCaption: true, position: 'right' } as Partial<Region> & { id: string }),
        region({ id: 'button-1', kind: 'button', label: 'Go', dest: null, position: 'right' } as Partial<Region> & { id: string }),
        region({ id: 'later', title: 'Later', position: 'right', hidden: true, text: '' }),
      ],
      actions: [],
    };
    const ms = designerMessages(bad, page);
    const texts = ms.map(m => `${m.level}: ${m.text}`);
    expect(texts).toContain('err: region photo-1: the image must name one of your photos');
    expect(texts).toContain('warn: The Body has no region showing. The page runs as its title alone.');
    expect(texts).toContain('warn: Button “Go” goes nowhere and no dynamic action listens to it.');
    expect(texts).toContain('warn: Later is hidden at first and no dynamic action shows it.');
    expect(texts).toContain('warn: Later has no text yet.');
    expect(ms.find(m => m.text.startsWith('region photo-1'))!.sel).toEqual({ kind: 'region', id: 'photo-1' });
    const idx = messageIndex(ms);
    expect(idx['region:photo-1']).toBe('err');
    expect(idx['region:later']).toBe('warn');
    expect(idx['position:body']).toBe('warn');
  });

  it('two regions on one row sharing a column are an error that names both and opens Layout (R5)', () => {
    const overlapping: PageDocument = {
      version: 1,
      regions: [region({ id: 'left', title: 'Left', span: 6 }), region({ id: 'right', title: 'Right', seq: 20, column: 1, span: 6, newRow: false })],
      actions: [],
    };
    const ms = designerMessages(overlapping, page);
    expect(ms.map(m => `${m.level}: ${m.text}`)).toEqual(['err: Right overlaps Left on one row (columns 1 to 6). Move it, or start a new row.']);
    expect(ms[0]).toMatchObject({ sel: { kind: 'region', id: 'right' }, group: 'Layout' });
    const beside: PageDocument = { ...overlapping, regions: [overlapping.regions[0], { ...overlapping.regions[1], column: 7 }] };
    expect(designerMessages(beside, page)).toEqual([]);
  });
});

describe('destinations a button or a go effect may name (P1.12 B2)', () => {
  const PAGE = 'a1b2c3d4-0000-4000-8000-000000000010';
  const pages: PageRow[] = [{ ...page, id: PAGE, kind: 'row', name: 'Monza, a history', path: '/history/monza' }];

  it('goOptions lists the catalogue and, given the pages, the row pages under their names; the labels name a page or fall back to the key', () => {
    expect(goOptions().some(o => o.key === `page:${PAGE}`)).toBe(false);
    expect(goOptions(pages).find(o => o.key === `page:${PAGE}`)?.label).toBe('Monza, a history');
    expect(goOptions([{ ...pages[0], kind: 'code' }]).some(o => o.key.startsWith('page:'))).toBe(false);
    expect(destinationLabel(`page:${PAGE}`, pages)).toBe('Monza, a history');
    expect(destinationLabel(`page:${PAGE}`)).toBe(`page:${PAGE}`);
    expect(effectText({ action: 'go', dest: `page:${PAGE}` }, [], pages)).toBe('Navigate to Page · Monza, a history');
    expect(regionSummary(region({ id: 'b', kind: 'button', label: 'Go', dest: `page:${PAGE}` } as Partial<Region> & { id: string }), [], [], pages)).toBe('“Go” → Monza, a history');
  });
});

describe('page search', () => {
  it('finds attribute values across the page, its regions and its actions', () => {
    const hits = searchPage('aside', doc, page);
    expect(hits.map(h => `${h.what} · ${h.where}`)).toEqual(expect.arrayContaining(['Region · Aside · name', 'Action · Unfold · effect']));
    expect(searchPage('monza', doc, page)[0]).toMatchObject({ sel: { kind: 'page' }, where: 'name' });
    expect(searchPage('', doc, page)).toEqual([]);
  });
});

describe('selection', () => {
  it('a set of regions is one selection: equal by its members, covering each of them, toggled by Ctrl+click (P1.6)', () => {
    const two: Selection = { kind: 'regions', ids: ['intro', 'aside'] };
    expect(sameSelection(two, { kind: 'regions', ids: ['aside', 'intro'] })).toBe(true);
    expect(sameSelection(two, { kind: 'regions', ids: ['intro'] })).toBe(false);
    expect(sameSelection(two, { kind: 'region', id: 'intro' })).toBe(false);
    expect(selectionCovers(two, { kind: 'region', id: 'aside' })).toBe(true);
    expect(selectionCovers(two, { kind: 'region', id: 'other' })).toBe(false);
    expect(selectionCovers(two, { kind: 'position', id: 'body' })).toBe(false);
    expect(selectionCovers({ kind: 'region', id: 'intro' }, { kind: 'region', id: 'intro' })).toBe(true);
    // Ctrl+click: a second region joins the first; a member clicked again leaves; one left is that region alone;
    // the only selected region clicked again leaves the page selected; from anything else it is a plain select.
    expect(toggleRegion({ kind: 'region', id: 'intro' }, 'aside')).toEqual(two);
    expect(toggleRegion(two, 'aside')).toEqual({ kind: 'region', id: 'intro' });
    expect(toggleRegion(two, 'third')).toEqual({ kind: 'regions', ids: ['intro', 'aside', 'third'] });
    expect(toggleRegion({ kind: 'region', id: 'intro' }, 'intro')).toEqual(PAGE_SELECTION);
    expect(toggleRegion(PAGE_SELECTION, 'intro')).toEqual({ kind: 'region', id: 'intro' });
    expect(toggleRegion({ kind: 'position', id: 'body' }, 'intro')).toEqual({ kind: 'region', id: 'intro' });
  });
});

describe('region defaults from Component Settings', () => {
  it('start a new region with the defaults it is given, the shipped ones otherwise', () => {
    const shipped = addRegion(doc, 'image', { position: 'body' });
    expect((shipped.doc.regions.find(r => r.id === shipped.id) as { showCaption: boolean }).showCaption).toBe(true);
    const own = {
      imageShowCaption: false,
      listStyle: 'cards' as const,
      buttonLabel: 'Read on',
      templates: { static: 'boxed' as const, image: 'standard' as const, list: 'standard' as const, button: 'band' as const },
    };
    const image = addRegion(doc, 'image', { position: 'body' }, own);
    expect((image.doc.regions.find(r => r.id === image.id) as { showCaption: boolean }).showCaption).toBe(false);
    expect(image.doc.regions.find(r => r.id === image.id)).not.toHaveProperty('template');
    const list = addRegion(doc, 'list', { position: 'right' }, own);
    expect((list.doc.regions.find(r => r.id === list.id) as { style: string }).style).toBe('cards');
    const button = addRegion(doc, 'button', { position: 'footer' }, own);
    expect((button.doc.regions.find(r => r.id === button.id) as { label: string }).label).toBe('Read on');
    // The template default (P1.1) is stored on the new region; a Band takes the whole row whatever the placement offered.
    const text = addRegion(doc, 'static', { position: 'body', column: 7, span: 6 }, own);
    expect(text.doc.regions.find(r => r.id === text.id)).toMatchObject({ template: 'boxed', column: 7, span: 6 });
    expect(button.doc.regions.find(r => r.id === button.id)).toMatchObject({ template: 'band', column: 1, span: 12, newRow: true });
    const capped = addRegion(doc, 'button', { position: 'body', column: 7, span: 6, newRow: false }, own);
    expect(capped.doc.regions.find(r => r.id === capped.id)).toMatchObject({ template: 'band', column: 1, span: 12, newRow: true });
    expect(SHIPPED_REGION_DEFAULTS).toEqual({
      imageShowCaption: true,
      listStyle: 'links',
      buttonLabel: 'Read more',
      templates: { static: 'standard', image: 'standard', list: 'standard', button: 'standard' },
    });
  });
});
