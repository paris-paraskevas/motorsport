import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchNews } from './news';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test</title>
    <link>https://example.com</link>
    <item>
      <title><![CDATA[Story one]]></title>
      <link>https://example.com/one</link>
      <pubDate>Mon, 12 May 2026 10:00:00 +0000</pubDate>
      <description><![CDATA[Short summary.<br>More text.<a class='more' href='x'>Keep reading</a>]]></description>
    </item>
    <item>
      <title>Story two</title>
      <link>https://example.com/two</link>
      <pubDate>Mon, 12 May 2026 09:00:00 +0000</pubDate>
      <description>Plain description.</description>
    </item>
  </channel>
</rss>`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchNews', () => {
  it('parses RSS into NewsItem[]', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(SAMPLE_RSS, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      }),
    );
    const items = await fetchNews('f1');
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Story one');
    expect(items[0].link).toBe('https://example.com/one');
    expect(items[0].description).toBe('Short summary. More text.');
    expect(items[1].title).toBe('Story two');
  });

  it('returns [] for an unknown series slug', async () => {
    const items = await fetchNews('not-a-series');
    expect(items).toEqual([]);
  });

  it('returns [] when fetch returns 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not found', { status: 404 }),
    );
    const items = await fetchNews('f1');
    expect(items).toEqual([]);
  });

  it('returns [] when XML is malformed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<not real xml>', { status: 200 }),
    );
    const items = await fetchNews('f1');
    expect(items).toEqual([]);
  });
});
