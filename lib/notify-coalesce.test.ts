import { describe, it, expect, vi } from 'vitest';

// notify-coalesce → userPrefs → @vercel/kv at import time; stub it (the pure
// helpers under test never touch KV).
vi.mock('@vercel/kv', () => ({ kv: {} }));

import {
  eligibleForNotify,
  coalescedPayload,
  type CandidateSession,
  type QueuedNotification,
} from './notify-coalesce';

function session(slug: string, title = 'Race'): CandidateSession {
  return {
    uid: `${slug}-${title}`,
    title,
    start: new Date('2026-07-09T14:00:00Z'),
    end: new Date('2026-07-09T16:00:00Z'),
    seriesSlug: slug,
    seriesName: slug.toUpperCase(),
    seriesColor: '#e10600',
  };
}
function item(
  slug: string,
  kind: QueuedNotification['kind'] = 'res',
  title = 'Race',
): QueuedNotification {
  return {
    kind,
    session: session(slug, title),
    payload: { title: `${slug} · ${title}`, body: 'body', url: `/series/${slug}`, tag: `t-${slug}`, color: '#e10600' },
  };
}
const gate = (over: Partial<Parameters<typeof eligibleForNotify>[0]> = {}) => ({
  sessionsOn: true,
  sessionTypes: undefined,
  followed: null as string[] | null,
  muted: new Set<string>(),
  ...over,
});

describe('eligibleForNotify', () => {
  it('blocks everything when the sessions pref is off', () => {
    expect(eligibleForNotify(gate({ sessionsOn: false }), item('f1'))).toBe(false);
  });

  it('applies the session-type filter to pre-session kinds only', () => {
    const practiceOff = { practice: false, qualifying: true, race: true };
    // t30 practice reminder is blocked when practice is off…
    expect(eligibleForNotify(gate({ sessionTypes: practiceOff }), item('f1', 't30', 'Practice 1'))).toBe(false);
    // …but a results push for the same session is not (results ignore the type filter).
    expect(eligibleForNotify(gate({ sessionTypes: practiceOff }), item('f1', 'res', 'Practice 1'))).toBe(true);
  });

  it('honours followed series (null = all series)', () => {
    expect(eligibleForNotify(gate({ followed: ['motogp'] }), item('f1'))).toBe(false);
    expect(eligibleForNotify(gate({ followed: ['f1'] }), item('f1'))).toBe(true);
    expect(eligibleForNotify(gate({ followed: null }), item('f1'))).toBe(true);
  });

  it('honours a per-series mute', () => {
    expect(eligibleForNotify(gate({ muted: new Set(['f1']) }), item('f1'))).toBe(false);
  });
});

describe('coalescedPayload', () => {
  it('summarizes N items with the lead title + count and a stable digest tag', () => {
    const p = coalescedPayload(
      [item('f1', 't30', 'Qualifying'), item('motogp', 'res'), item('wec', 'res')],
      false,
    );
    expect(p.title).toBe('Paddock · 3 updates');
    expect(p.body).toContain('+ 2 more');
    expect(p.tag).toBe('paddock-digest');
    expect(p.url).toBe('/app');
    expect(p.silent).toBeUndefined();
  });

  it('passes silent through', () => {
    expect(coalescedPayload([item('f1'), item('f2')], true).silent).toBe(true);
  });
});
