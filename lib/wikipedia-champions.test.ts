import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchChampions } from './wikipedia-champions';

const TABLE_HTML = `
<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr><th>Season</th><th>Driver</th><th>Constructor</th><th>Points</th></tr>
    <tr><td>2024</td><td>Max Verstappen</td><td>Red Bull Racing-Honda RBPT</td><td>437</td></tr>
    <tr><td>2023</td><td>Max Verstappen</td><td>Red Bull Racing-Honda RBPT</td><td>575</td></tr>
    <tr><td>2022</td><td>Max Verstappen</td><td>Red Bull Racing-RBPT</td><td>454</td></tr>
    <tr><td>2021</td><td>Max Verstappen</td><td>Red Bull Racing-Honda</td><td>395.5</td></tr>
  </tbody>
</table>
</body></html>
`;

const TABLE_HTML_UPPERCASE = `
<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr><th>YEAR</th><th>DRIVER</th><th>CONSTRUCTOR</th><th>POINTS</th></tr>
    <tr><td>2024</td><td>Max Verstappen</td><td>Red Bull</td><td>437</td></tr>
    <tr><td>2023</td><td>Max Verstappen</td><td>Red Bull</td><td>575</td></tr>
  </tbody>
</table>
</body></html>
`;

const NO_TABLE_HTML = `
<!DOCTYPE html>
<html><body><p>No tables here, just prose about racing history.</p></body></html>
`;

const SEASON_RANGE_HTML = `
<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr><th>Season</th><th>Rider</th><th>Manufacturer</th><th>Points</th></tr>
    <tr><td>2023&#8211;24</td><td>Test Rider</td><td>Honda</td><td>300</td></tr>
  </tbody>
</table>
</body></html>
`;

function mockFetchOnceOk(html: string) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => html,
  }) as unknown as typeof fetch;
}

function mockFetch404() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    text: async () => 'Not found',
  }) as unknown as typeof fetch;
}

function mockFetchReject() {
  globalThis.fetch = vi
    .fn()
    .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
}

describe('fetchChampions', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses year/driver/constructor/points from a table', async () => {
    mockFetchOnceOk(TABLE_HTML);
    const champions = await fetchChampions('List_of_Formula_One_World_Champions');
    expect(champions.length).toBeGreaterThan(0);
    const first = champions[0];
    expect(first.year).toBe(2024);
    expect(first.driver).toBe('Max Verstappen');
    expect(first.constructor).toContain('Red Bull');
    expect(first.points).toBe(437);
    // Includes all four rows
    expect(champions).toHaveLength(4);
  });

  it('returns [] when no table present', async () => {
    mockFetchOnceOk(NO_TABLE_HTML);
    const champions = await fetchChampions('Bogus_Page');
    expect(champions).toEqual([]);
  });

  it('matches columns case-insensitively (header "DRIVER" still works)', async () => {
    mockFetchOnceOk(TABLE_HTML_UPPERCASE);
    const champions = await fetchChampions('Some_Page');
    expect(champions).toHaveLength(2);
    expect(champions[0].year).toBe(2024);
    expect(champions[0].driver).toBe('Max Verstappen');
    expect(champions[0].constructor).toBe('Red Bull');
    expect(champions[0].points).toBe(437);
  });

  it('returns [] on 404 without throwing', async () => {
    mockFetch404();
    const champions = await fetchChampions('Missing_Page');
    expect(champions).toEqual([]);
  });

  it('returns [] on network failure without throwing', async () => {
    mockFetchReject();
    const champions = await fetchChampions('Any_Page');
    expect(champions).toEqual([]);
  });

  it('parses season range like "2023-24" to the later year', async () => {
    mockFetchOnceOk(SEASON_RANGE_HTML);
    const champions = await fetchChampions('Season_Range_Page');
    expect(champions).toHaveLength(1);
    expect(champions[0].year).toBe(2024);
    expect(champions[0].driver).toBe('Test Rider');
    expect(champions[0].constructor).toBe('Honda');
  });
});
