import { describe, expect, it } from 'vitest';
import type { PageDocument, Region } from '@/lib/design/page-document';
import type { PageRow } from '@/lib/design/pages';
import {
  addAction,
  addRegion,
  designerMessages,
  duplicateRegion,
  messageIndex,
  moveRegion,
  nextRegionId,
  openPositions,
  placeRegion,
  removeRegion,
  renumber,
  searchPage,
  spanName,
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
  it('says nothing for a sound page; asks no Body of a code page but refuses a region in the Body the code owns', () => {
    expect(designerMessages(doc, page)).toEqual([]);
    const code: PageRow = { ...page, kind: 'code' };
    expect(designerMessages({ version: 1, regions: [], actions: [] }, code)).toEqual([]);
    expect(designerMessages({ version: 1, regions: [region({ id: 'welcome', title: 'Welcome', position: 'header' })], actions: [] }, code)).toEqual([]);
    const inBody = designerMessages({ version: 1, regions: [region({ id: 'intro', title: 'Intro' })], actions: [] }, code);
    expect(inBody.map(m => `${m.level}: ${m.text}`)).toEqual([
      'err: Intro sits in the Body, which the code owns on this page. Move it to the Page Header, the Breadcrumb Bar, the Footer or the Phone Bar.',
    ]);
    expect(inBody[0].sel).toEqual({ kind: 'region', id: 'intro' });
    expect(openPositions('code')).toEqual(['header', 'breadcrumb', 'footer', 'phonebar']);
    expect(openPositions('row')).toHaveLength(6);
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
    expect(texts).toContain('err: The Body has no region showing. The page would be empty.');
    expect(texts).toContain('warn: Button “Go” goes nowhere and no dynamic action listens to it.');
    expect(texts).toContain('warn: Later is hidden at first and no dynamic action shows it.');
    expect(texts).toContain('warn: Later has no text yet.');
    expect(ms.find(m => m.text.startsWith('region photo-1'))!.sel).toEqual({ kind: 'region', id: 'photo-1' });
    const idx = messageIndex(ms);
    expect(idx['region:photo-1']).toBe('err');
    expect(idx['region:later']).toBe('warn');
    expect(idx['position:body']).toBe('err');
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
