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
    // the rest are appended in registry order
    expect(new Set(r.order)).toEqual(new Set(['chyron', 'just-missed', 'schedule', 'news', 'from-the-blog']));
    expect(r.order).toHaveLength(5);
  });

  it('drops unknown ids and de-dupes', () => {
    const r = reconcileHomeLayout({ order: ['nope', 'chyron', 'chyron', 'schedule'] as never });
    expect(r.order).toHaveLength(5);
    expect(r.order.filter(x => x === 'chyron')).toHaveLength(1);
    expect(r.order).not.toContain('nope' as never);
  });

  it('filters hidden to known ids (and default-hides a newly-seen opt-in widget)', () => {
    // No stored order → from-the-blog is "newly seen" and joins hidden.
    const r = reconcileHomeLayout({ hidden: ['just-missed', 'bogus'] as never });
    expect(r.hidden).toEqual(['just-missed', 'from-the-blog']);
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

  it('drops ids that are not collapsible (only the chyron)', () => {
    // schedule + news are collapsible now; the chyron is show/hide only.
    expect(reconcileHomeLayout({ collapsed: ['chyron'] as never }).collapsed).toEqual([]);
    expect(reconcileHomeLayout({ collapsed: ['schedule', 'news', 'chyron'] as never }).collapsed).toEqual([
      'schedule',
      'news',
    ]);
  });
});

describe('homeLayout.defaultHidden (opt-in widgets)', () => {
  it('default-hides from-the-blog for a fresh/absent layout', () => {
    expect(reconcileHomeLayout(null).hidden).toContain('from-the-blog');
    expect(DEFAULT_HOME_LAYOUT.hidden).toContain('from-the-blog');
  });

  it('default-hides from-the-blog for an existing user who has never seen it', () => {
    // pre-v4 prefs: a full order WITHOUT from-the-blog, empty hidden.
    const r = reconcileHomeLayout({ order: ['chyron', 'just-missed', 'schedule', 'news'], hidden: [] });
    expect(r.order).toContain('from-the-blog');
    expect(r.hidden).toEqual(['from-the-blog']);
  });

  it('respects the user choice once the widget is already in their stored order', () => {
    const full = ['chyron', 'just-missed', 'schedule', 'news', 'from-the-blog'] as const;
    // shown (not in hidden) → stays shown
    expect(reconcileHomeLayout({ order: [...full], hidden: [] }).hidden).toEqual([]);
    // hidden explicitly → stays hidden
    expect(reconcileHomeLayout({ order: [...full], hidden: ['from-the-blog'] }).hidden).toEqual(['from-the-blog']);
  });
});
