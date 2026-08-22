import { describe, it, expect } from 'vitest';
import { applyPrivacySignals, type ConsentPrefs } from '@/components/CookieConsent';

// Global Privacy Control is a PUBLISHED PROMISE: `/do-not-sell` tells visitors
// we honour "the GPC signal", and the privacy policy repeats it. Until 0.334.0
// nothing in the code read the signal at all — the claim had no implementation
// behind it. These assertions are the cheap permanent version of that promise,
// so it cannot quietly stop being true again.
//
// The clamp takes the signal as an argument precisely so this matrix needs no
// global stubbing.
const ALL_ON: ConsentPrefs = { analytics: true, advertising: true, functional: true };
const ALL_OFF: ConsentPrefs = { analytics: false, advertising: false, functional: false };

describe('applyPrivacySignals', () => {
  it('passes the choice straight through with no signal', () => {
    expect(applyPrivacySignals(ALL_ON, false)).toEqual(ALL_ON);
    expect(applyPrivacySignals(ALL_OFF, false)).toEqual(ALL_OFF);
  });

  it('forces analytics and advertising off under GPC, whatever was stored', () => {
    expect(applyPrivacySignals(ALL_ON, true)).toEqual({
      analytics: false,
      advertising: false,
      functional: true,
    });
  });

  it('leaves functional alone: GPC is about selling and sharing, not preferences', () => {
    expect(applyPrivacySignals({ ...ALL_OFF, functional: true }, true).functional).toBe(true);
    expect(applyPrivacySignals({ ...ALL_OFF, functional: false }, true).functional).toBe(false);
  });

  it('is idempotent, so clamping on render and again on save cannot drift', () => {
    const once = applyPrivacySignals(ALL_ON, true);
    expect(applyPrivacySignals(once, true)).toEqual(once);
  });

  it('does not mutate the input', () => {
    const input = { ...ALL_ON };
    applyPrivacySignals(input, true);
    expect(input).toEqual(ALL_ON);
  });
});
