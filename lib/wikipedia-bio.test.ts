import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchWikipediaBio,
  parseBioResponse,
  parseIdentity,
  ageFromISO,
  flagEmoji,
} from './wikipedia-bio';

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
    // Identity layer parsed off the intro.
    expect(bio?.bornISO).toBe('1997-09-30');
    expect(bio?.nationality).toEqual({ code: 'NL', demonym: 'Dutch' });
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

describe('parseIdentity', () => {
  it('extracts DOB + nationality across disciplines and phrasings', () => {
    const cases: Array<[string, string, string, string]> = [
      ['Marc Márquez Alentà (born 17 February 1993) is a Spanish Grand Prix motorcycle road racer.', '1993-02-17', 'ES', 'Spanish'],
      ['Kyle Miyata Larson (born July 31, 1992) is an American professional racing driver.', '1992-07-31', 'US', 'American'],
      ['Max Emilian Verstappen (Dutch pronunciation: [x]; born 30 September 1997) is a Dutch and Belgian racing driver.', '1997-09-30', 'NL', 'Dutch'],
      ['Kalle Alex Rovanperä (Finnish: [x]; born 1 October 2000) is a Finnish professional rally and racing driver.', '2000-10-01', 'FI', 'Finnish'],
      ['Liam Jared Lawson (born 11 February 2002) is a New Zealand racing driver.', '2002-02-11', 'NZ', 'New Zealand'],
    ];
    for (const [intro, bornISO, code, demonym] of cases) {
      const id = parseIdentity(intro);
      expect(id.bornISO).toBe(bornISO);
      expect(id.nationality).toEqual({ code, demonym });
    }
  });

  it('builds the ISO date from local components (no UTC day-shift)', () => {
    // 1 October must never slip to 30 September, whatever the runner's timezone.
    expect(parseIdentity('(born 1 October 2000) is a Finnish racing driver.').bornISO).toBe('2000-10-01');
  });

  it('is fail-soft when neither a born-date nor a mappable demonym is present', () => {
    expect(parseIdentity('A racing team competing across Europe.')).toEqual({});
  });
});

describe('ageFromISO', () => {
  const now = new Date(2026, 6, 11); // 2026-07-11, local

  it('computes whole years, accounting for whether the birthday has passed', () => {
    expect(ageFromISO('1997-09-30', now)).toBe(28); // birthday later in the year
    expect(ageFromISO('1992-07-31', now)).toBe(33); // 20 days off — not yet
    expect(ageFromISO('1993-02-17', now)).toBe(33); // birthday already passed
  });

  it('returns null on malformed or implausible input', () => {
    expect(ageFromISO('not-a-date', now)).toBeNull();
    expect(ageFromISO('1800-01-01', now)).toBeNull();
  });
});

describe('flagEmoji', () => {
  it('maps an ISO alpha-2 code to regional-indicator symbols', () => {
    expect(flagEmoji('NL')).toBe('🇳🇱');
    expect(flagEmoji('us')).toBe('🇺🇸');
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
