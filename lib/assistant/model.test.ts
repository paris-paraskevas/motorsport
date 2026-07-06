import { describe, it, expect, beforeEach } from 'vitest';
import { askModel, isAssistantConfigured } from './model';

// Ships DARK until a key is set: with no GOOGLE_GENERATIVE_AI_API_KEY the model
// seam must report 'unconfigured' WITHOUT making a network call, so the route
// can degrade to "not available yet" (503) rather than error.
describe('model seam (no key)', () => {
  beforeEach(() => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  });

  it('reports not configured', () => {
    expect(isAssistantConfigured()).toBe(false);
  });

  it('returns reason "unconfigured" without calling the network', async () => {
    const result = await askModel('system', [{ role: 'user', content: 'hi there' }]);
    expect(result).toEqual({ ok: false, reason: 'unconfigured' });
  });
});
