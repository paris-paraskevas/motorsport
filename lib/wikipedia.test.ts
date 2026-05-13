import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWikipediaSummary } from './wikipedia';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockResponse(init: { ok: boolean; status?: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 404),
    json: async () => init.body,
  } as unknown as Response;
}

describe('fetchWikipediaSummary', () => {
  it('parses a valid summary response into a WikipediaSummary', async () => {
    const payload = {
      title: 'Formula One',
      extract: 'Formula One is the highest class of international racing for open-wheel single-seater formula racing cars.',
      description: 'Highest class of international auto racing',
      content_urls: {
        desktop: { page: 'https://en.wikipedia.org/wiki/Formula_One' },
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse({ ok: true, body: payload }));

    const result = await fetchWikipediaSummary('Formula_One');

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Formula One');
    expect(result?.extract).toBe(payload.extract);
    expect(result?.description).toBe('Highest class of international auto racing');
    expect(result?.url).toBe('https://en.wikipedia.org/wiki/Formula_One');
    expect(result?.fetchedAt).toBeInstanceOf(Date);
  });

  it('returns null when fetch returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse({ ok: false, status: 404 }),
    );

    const result = await fetchWikipediaSummary('Nonexistent_Page_Xyz');

    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    const result = await fetchWikipediaSummary('Formula_One');

    expect(result).toBeNull();
  });

  it('returns null when response body lacks an extract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse({
        ok: true,
        body: { title: 'Empty', content_urls: { desktop: { page: 'https://x' } } },
      }),
    );

    const result = await fetchWikipediaSummary('Empty');

    expect(result).toBeNull();
  });
});
