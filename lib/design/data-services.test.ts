import { describe, expect, it } from 'vitest';
import { DATA_SERVICES, DATA_TIERS, findDataService } from './data-services';

// The Data workspace's catalogue: every service well-formed, every credential a
// NAME (an env var, never a value), the three tiers each holding something.

describe('DATA_SERVICES', () => {
  it('has unique keys, every tier represented, and credentials named like environment variables', () => {
    const keys = DATA_SERVICES.map(s => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of DATA_TIERS) expect(DATA_SERVICES.some(s => s.tier === t.tier), t.tier).toBe(true);
    for (const s of DATA_SERVICES) {
      expect(s.name.length, s.key).toBeGreaterThan(0);
      expect(s.mono.length, s.key).toBeGreaterThanOrEqual(2);
      expect(s.api.name.length, s.key).toBeGreaterThan(0);
      expect(s.health.length, s.key).toBeGreaterThan(0);
      for (const c of s.cred) expect(c, s.key).toMatch(/^[A-Z][A-Z0-9_]+$/);
      if (s.tier === 'cred') expect(s.steps?.length, s.key).toBeGreaterThan(0);
    }
  });

  it('names the readers the code has for the live tier, and finds a service by key', () => {
    expect(DATA_SERVICES.filter(s => s.tier === 'now').map(s => s.key)).toEqual(['ga4', 'gsc', 'bing', 'cf', 'auth', 'sb', 'upstash']);
    expect(findDataService('ga4')?.cred).toEqual(['GA4_SA_KEY', 'GA4_PROPERTY_ID']);
    expect(findDataService('nope')).toBeNull();
  });
});
