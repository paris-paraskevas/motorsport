import { describe, it, expect } from 'vitest';
import { reconcileHomeLayout, parseHomeLayout, DEFAULT_HOME_LAYOUT } from './homeLayout';

describe('homeLayout.reconcile', () => {
  it('returns the default order for empty/absent prefs', () => {
    expect(reconcileHomeLayout(null).order).toEqual(DEFAULT_HOME_LAYOUT.order);
    expect(reconcileHomeLayout({}).order).toEqual(DEFAULT_HOME_LAYOUT.order);
  });

  it('keeps a stored order and appends any missing registry ids', () => {
    const r = reconcileHomeLayout({ order: ['schedule'] });
    expect(r.order[0]).toBe('schedule');
    // the other two are appended in registry order
    expect(new Set(r.order)).toEqual(new Set(['chyron', 'just-missed', 'schedule']));
    expect(r.order).toHaveLength(3);
  });

  it('drops unknown ids and de-dupes', () => {
    const r = reconcileHomeLayout({ order: ['nope', 'chyron', 'chyron', 'schedule'] as never });
    expect(r.order).toHaveLength(3);
    expect(r.order.filter(x => x === 'chyron')).toHaveLength(1);
    expect(r.order).not.toContain('nope' as never);
  });

  it('filters hidden to known ids', () => {
    const r = reconcileHomeLayout({ hidden: ['just-missed', 'bogus'] as never });
    expect(r.hidden).toEqual(['just-missed']);
  });

  it('parseHomeLayout rejects non-object / non-array fields, accepts valid', () => {
    expect(parseHomeLayout(null)).toBeNull();
    expect(parseHomeLayout('x')).toBeNull();
    expect(parseHomeLayout({ order: 'nope' })).toBeNull();
    expect(parseHomeLayout({ hidden: 5 })).toBeNull();
    expect(parseHomeLayout({ collapsed: 5 })).toBeNull();
    expect(parseHomeLayout({ order: ['schedule'], hidden: ['chyron'] })?.order[0]).toBe('schedule');
  });
});

describe('homeLayout.collapsed', () => {
  it('defaults to just-missed collapsed when absent (pre-v2 prefs inherit it)', () => {
    expect(reconcileHomeLayout(null).collapsed).toEqual(['just-missed']);
    expect(reconcileHomeLayout({}).collapsed).toEqual(['just-missed']);
    expect(reconcileHomeLayout({ order: ['schedule'] }).collapsed).toEqual(['just-missed']);
  });

  it('honours an explicit empty collapsed (the user expanded it)', () => {
    expect(reconcileHomeLayout({ collapsed: [] }).collapsed).toEqual([]);
  });

  it('drops ids that are not collapsible (chyron / schedule)', () => {
    expect(reconcileHomeLayout({ collapsed: ['chyron', 'schedule'] as never }).collapsed).toEqual([]);
    expect(reconcileHomeLayout({ collapsed: ['just-missed', 'chyron'] as never }).collapsed).toEqual(['just-missed']);
  });
});
