import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWikipediaBio, parseBioResponse } from './wikipedia-bio';

afterEach(() => {
  vi.restoreAllMocks();
});

// action=query&prop=extracts|pageprops response shapes (format=json,
// formatversion=2), trimmed to the fields the parser reads.
function pagesResponse(page: Record<string, unknown>): unknown {
  return { batchcomplete: true, query: { pages: [page] } };
}

const DRIVER_PAGE = pagesResponse({
  pageid: 27796780,
  ns: 0,
  title: 'Max Verstappen',
  extract:
    'Max Emilian Verstappen (born 30 September 1997) is a Dutch racing driver who competes in Formula One for Red Bull Racing.\n' +
    'Verstappen is a four-time Formula One World Drivers’ Champion.\n' +
    'Born in Hasselt, Verstappen began karting aged four.\n' +
    'A fourth paragraph that should be dropped by the cap.',
});

describe('parseBioResponse', () => {
  it('parses a normal page into title, capped paragraphs and a wiki URL', () => {
    const bio = parseBioResponse(DRIVER_PAGE);
    expect(bio).not.toBeNull();
    expect(bio?.title).toBe('Max Verstappen');
    expect(bio?.paragraphs).toHaveLength(3); // 4 in the extract, capped at 3
    expect(bio?.paragraphs[0]).toContain('Dutch racing driver');
    expect(bio?.url).toBe('https://en.wikipedia.org/wiki/Max_Verstappen');
  });

  it('returns null for a missing title', () => {
    const bio = parseBioResponse(
      pagesResponse({ ns: 0, title: 'No Such Driver Xyz', missing: true }),
    );
    expect(bio).toBeNull();
  });

  it('returns null for a disambiguation page', () => {
    const bio = parseBioResponse(
      pagesResponse({
        pageid: 1,
        title: 'Mercedes',
        extract: 'Mercedes may refer to: the Formula One racing team, the car marque, a given name.',
        pageprops: { disambiguation: '' },
      }),
    );
    expect(bio).toBeNull();
  });

  it('returns null for an empty extract', () => {
    const bio = parseBioResponse(pagesResponse({ pageid: 2, title: 'Stub Page', extract: '' }));
    expect(bio).toBeNull();
  });

  it('returns null when the intro does not read as a motorsport subject (wrong-person guard)', () => {
    const bio = parseBioResponse(
      pagesResponse({
        pageid: 3,
        title: 'Josh Berry',
        extract:
          'Josh Berry is a Scottish comedian and impressionist known for his online sketches.',
      }),
    );
    expect(bio).toBeNull();
  });

  it('returns null on a shapeless payload', () => {
    expect(parseBioResponse({})).toBeNull();
    expect(parseBioResponse(null)).toBeNull();
    expect(parseBioResponse({ query: { pages: [] } })).toBeNull();
  });
});

describe('fetchWikipediaBio', () => {
  it('fetches and parses a bio (no KV configured in tests → straight through)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(DRIVER_PAGE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const bio = await fetchWikipediaBio('Max Verstappen');
    expect(bio?.title).toBe('Max Verstappen');
    const url = String(spy.mock.calls[0][0]);
    // Action API, never the /wiki/ frontend (datacenter-blocked, 0.150.2).
    expect(url).toContain('en.wikipedia.org/w/api.php');
    expect(url).toContain('prop=extracts');
    expect(url).toContain('titles=Max%20Verstappen');
    expect(url).not.toContain('/wiki/');
  });

  it('returns null when the API responds non-ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 503 }));
    expect(await fetchWikipediaBio('Max Verstappen')).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    expect(await fetchWikipediaBio('Max Verstappen')).toBeNull();
  });

  it('returns null for a blank name without fetching', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    expect(await fetchWikipediaBio('   ')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
