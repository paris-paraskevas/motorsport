import { describe, expect, it } from 'vitest';
import { adoptRecipe, composedCodePages, composedDocument, extractParams, matchComposedPage } from './composed-page';
import { SPLITS } from './components';
import type { PageDocument, Region } from './page-document';

// Pages served from rows after their route file left (R4.1): which address is
// which page, its parts, and what it renders when nothing or only a frame is
// published.

describe('composed pages', () => {
  it('lists the pages the registry marks as served from rows, and matches an address to one with its parts', () => {
    expect(composedCodePages().map(p => p.path)).toEqual(['/calendar', '/news']);
    expect(matchComposedPage('/calendar')).toEqual({ page: expect.objectContaining({ path: '/calendar', served: 'rows' }), params: {} });
    expect(matchComposedPage('/calendar/extra')).toBeNull();
    expect(matchComposedPage('/series/f1')).toBeNull();
    expect(matchComposedPage('/history/monza')).toBeNull();
  });

  it('extracts an address’s parts by segment name, a catch-all segment taking the rest', () => {
    expect(extractParams('/series/[slug]/weekend/[round]', '/series/f1/weekend/14')).toEqual({ slug: 'f1', round: '14' });
    expect(extractParams('/calendar', '/calendar')).toEqual({});
    expect(extractParams('/docs/[...rest]', '/docs/a/b/c')).toEqual({ rest: 'a/b/c' });
  });

  it('renders the published document when it has Body regions, the default composition when nothing is published, and keeps a published frame around the default', () => {
    const base = composedDocument(null, '/calendar');
    expect(base.regions.map(r => (r.kind === 'component' ? r.component : r.kind))).toEqual(['page.heading', 'data.filters', 'calendar.month']);
    expect(base.regions.map(r => r.id)).toEqual(['heading', 'filters', 'month']);
    const published: PageDocument = {
      version: 1,
      actions: [],
      regions: [{ id: 'own', kind: 'static', title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'Mine' }],
    };
    expect(composedDocument(published, '/calendar')).toBe(published);
    const frameOnly: PageDocument = {
      version: 1,
      actions: [],
      regions: [{ id: 'kicker', kind: 'static', title: '', position: 'header', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'Above' }],
    };
    const merged = composedDocument(frameOnly, '/calendar');
    expect(merged.regions.map(r => `${r.position}:${r.id}`)).toEqual(['header:kicker', 'body:heading', 'body:filters', 'body:month']);
    expect(composedDocument(null, '/nowhere').regions).toEqual([]);
  });

  it('the news page (P2.5 PR C): the heading with the route’s words, the Filters region over the wire region’s series, the wire region on the Headlines view over the News page’s ten per series, every row shown', () => {
    const news = composedDocument(null, '/news');
    expect(news.regions.map(r => `${r.position}:${r.id}:${r.kind === 'component' ? r.component : r.kind}:${r.seq}`)).toEqual(['body:heading:page.heading:10', 'body:filters:data.filters:20', 'body:wire:data.region:30']);
    expect(news.regions[0]).toMatchObject({ settings: { text: 'The wire' } });
    expect(news.regions[1]).toMatchObject({ settings: { filteredRegion: 'wire', facet1: 'seriesName' } });
    expect(news.regions[2]).toMatchObject({ source: 'news?per=10', settings: { preset: 'wire', view: 'headlines', rows: 150 } });
  });

  it('adopts the recipe where a published transitional body sits, moving the Body regions after it past the fresh ones; every page served from rows has a recipe', () => {
    const legacy: Region = { id: 'code-body', kind: 'component', component: 'page.body', settings: {}, title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null };
    const note: Region = { id: 'note', kind: 'static', title: '', position: 'body', seq: 20, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'R2A' };
    const kicker: Region = { ...note, id: 'kicker', position: 'header', seq: 10 };
    const doc: PageDocument = { version: 1, actions: [], regions: [kicker, legacy, note] };
    const adopted = adoptRecipe(doc, '/calendar');
    expect(adopted.regions.map(r => `${r.position}:${r.id}:${r.seq}`)).toEqual(['header:kicker:10', 'body:heading:10', 'body:filters:20', 'body:month:30', 'body:note:50']);
    expect(composedDocument(doc, '/calendar')).toEqual(adopted);
    expect(adoptRecipe(doc, '/nowhere').regions.map(r => r.id)).toEqual(['kicker', 'note']);
    const plain: PageDocument = { version: 1, actions: [], regions: [note] };
    expect(adoptRecipe(plain, '/calendar')).toBe(plain);
    for (const p of composedCodePages()) expect(SPLITS[p.path]?.length ?? 0, p.path).toBeGreaterThan(0);
  });
});
