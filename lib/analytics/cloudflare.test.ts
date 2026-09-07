import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTION_SCRIPT_NAME, fetchWorkerUsage } from './cloudflare';

// The account runs three Workers (prod and two previews). The usage panel is
// about production, so the query must name the script; an unfiltered query sums
// all three and the number is wrong in a way nobody can see.
describe('fetchWorkerUsage', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct_1';
    process.env.CLOUDFLARE_ANALYTICS_TOKEN = 'tok';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_ANALYTICS_TOKEN;
  });

  function body(): { query: string; variables: Record<string, string> } {
    const init = fetchMock.mock.calls[0][1] as { body: string };
    return JSON.parse(init.body);
  }

  it('filters the dataset to the production script, by name, in filter and variables', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { viewer: { accounts: [{ workersInvocationsAdaptive: [{ sum: { requests: 5, errors: 1, subrequests: 9 } }] }] } },
        }),
        { status: 200 },
      ),
    );
    const usage = await fetchWorkerUsage(7);
    expect(usage).toEqual({ requests: 5, errors: 1, subrequests: 9, days: 7 });
    const { query, variables } = body();
    expect(query).toMatch(/scriptName:\s*\$script/);
    expect(variables.script).toBe(PRODUCTION_SCRIPT_NAME);
    expect(variables.tag).toBe('acct_1');
  });

  it('sums every returned row', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            viewer: {
              accounts: [
                {
                  workersInvocationsAdaptive: [
                    { sum: { requests: 2, errors: 0, subrequests: 1 } },
                    { sum: { requests: 3, errors: 1, subrequests: 0 } },
                  ],
                },
              ],
            },
          },
        }),
        { status: 200 },
      ),
    );
    expect(await fetchWorkerUsage(30)).toEqual({ requests: 5, errors: 1, subrequests: 1, days: 30 });
  });

  it('is null when GraphQL answers 200 with errors, on a non-2xx, or unconfigured', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: 'unknown field' }] }), { status: 200 }));
    expect(await fetchWorkerUsage()).toBeNull();
    fetchMock.mockResolvedValue(new Response('nope', { status: 403 }));
    expect(await fetchWorkerUsage()).toBeNull();
    delete process.env.CLOUDFLARE_ANALYTICS_TOKEN;
    fetchMock.mockClear();
    expect(await fetchWorkerUsage()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
