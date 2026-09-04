// @vitest-environment jsdom
//
// The first hook test in this repo. useDraftBackup exists because a post was
// lost on 2026-08-24, and every branch below is one of the ways it can quietly
// stop protecting against that — a backup that never writes, or one that
// deletes itself, fails silently and only shows up the next time someone
// loses work.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fmtRecoveredAt, useDraftBackup } from './useDraftBackup';

const KEY = 'paddock:draft:42';
const DEBOUNCE_MS = 1000;

function store(values: unknown, ts = 1_700_000_000_000): void {
  window.localStorage.setItem(KEY, JSON.stringify({ values, ts }));
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('recovery', () => {
  it('offers back what was left behind', () => {
    store({ title: 'half a post' });
    const { result } = renderHook(() => useDraftBackup('42', { title: '' }, false));
    expect(result.current.recovered?.values).toEqual({ title: 'half a post' });
  });

  it('offers nothing when nothing was left behind', () => {
    const { result } = renderHook(() => useDraftBackup('42', { title: '' }, false));
    expect(result.current.recovered).toBeNull();
  });

  it('ignores a snapshot with no usable timestamp', () => {
    window.localStorage.setItem(KEY, '{"values":{"title":"x"}}');
    const { result } = renderHook(() => useDraftBackup('42', { title: '' }, false));
    expect(result.current.recovered).toBeNull();
  });

  it('ignores a snapshot that is not JSON', () => {
    window.localStorage.setItem(KEY, 'not json at all');
    const { result } = renderHook(() => useDraftBackup('42', { title: '' }, false));
    expect(result.current.recovered).toBeNull();
  });

  // The guard this exists for: on mount, the first store read and the
  // clean-form effect land in the SAME commit. Without it the hook deletes the
  // snapshot it has just offered, and a second reload finds nothing.
  it('does NOT delete the snapshot it just offered', () => {
    store({ title: 'half a post' });
    renderHook(() => useDraftBackup('42', { title: '' }, false));
    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS * 5));
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
  });

  it('does clear a snapshot it could not offer', () => {
    window.localStorage.setItem(KEY, 'not json at all');
    renderHook(() => useDraftBackup('42', { title: '' }, false));
    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS * 5));
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('discard() resolves the banner and drops the snapshot', () => {
    store({ title: 'half a post' });
    const { result } = renderHook(() => useDraftBackup('42', { title: '' }, false));
    act(() => result.current.discard());
    expect(result.current.recovered).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  // The read is frozen after the first call on purpose: this hook's own
  // debounced writes constantly change the stored value, and a live read would
  // make the recovery banner reappear while the author is typing.
  it('freezes the read, so the banner cannot reappear mid-typing', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: { title: string } }) => useDraftBackup('42', v, true),
      { initialProps: { v: { title: 'a' } } },
    );
    expect(result.current.recovered).toBeNull();

    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS));
    expect(window.localStorage.getItem(KEY)).not.toBeNull(); // it wrote its own

    rerender({ v: { title: 'ab' } });
    expect(result.current.recovered).toBeNull(); // and did not re-offer it
  });
});

describe('snapshotting', () => {
  it('writes after the debounce while dirty', () => {
    renderHook(() => useDraftBackup('42', { title: 'typed' }, true));
    expect(window.localStorage.getItem(KEY)).toBeNull();

    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS));
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    expect(saved.values).toEqual({ title: 'typed' });
    expect(typeof saved.ts).toBe('number');
  });

  it('does not write before the debounce elapses', () => {
    renderHook(() => useDraftBackup('42', { title: 'typed' }, true));
    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS - 1));
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('a keystroke inside the window replaces the pending write', () => {
    const { rerender } = renderHook(
      ({ v }: { v: { title: string } }) => useDraftBackup('42', v, true),
      { initialProps: { v: { title: 'ty' } } },
    );
    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS - 1));
    rerender({ v: { title: 'typed' } });
    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS));

    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    expect(saved.values).toEqual({ title: 'typed' });
  });

  it('a re-render with the same contents does not rewrite the store', () => {
    const { rerender } = renderHook(
      ({ v }: { v: { title: string } }) => useDraftBackup('42', v, true),
      { initialProps: { v: { title: 'typed' } } },
    );
    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS));
    const first = window.localStorage.getItem(KEY);

    // A NEW object with identical contents — the effect keys off the serialised
    // form precisely so this is a no-op.
    rerender({ v: { title: 'typed' } });
    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS));
    expect(window.localStorage.getItem(KEY)).toBe(first);
  });

  // Private modes and an exhausted quota both throw. A backup that takes the
  // editor down with it is worse than no backup.
  //
  // Spied on Storage.PROTOTYPE, not on the instance: jsdom's Storage is a proxy
  // that turns an instance property assignment into a stored KEY, so an instance
  // spy silently never fires. The first draft of these two tests did that — one
  // failed outright, and the other passed for the wrong reason, because "no
  // recovery" is also what an empty store looks like. Both now seed a snapshot
  // first, so a spy that fails to land fails the test.
  it('survives localStorage throwing on read', () => {
    store({ title: 'half a post' });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });
    const { result } = renderHook(() => useDraftBackup('42', { title: '' }, false));
    expect(result.current.recovered).toBeNull();
  });

  it('survives localStorage throwing on write', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    renderHook(() => useDraftBackup('42', { title: 'typed' }, true));
    act(() => void vi.advanceTimersByTime(DEBOUNCE_MS));
    expect(setItem).toHaveBeenCalledWith(KEY, expect.stringContaining('typed'));
  });
});

describe('navigate-away guard', () => {
  // `String(type)` rather than a direct comparison: this repo's ambient types
  // include the service-worker lib, so `vi.spyOn(window, 'addEventListener')`
  // resolves to the DedicatedWorkerGlobalScope overload and tsc rejects
  // comparing its event map against 'beforeunload'. Converting is honest — the
  // runtime value is that string either way.
  const countBeforeUnload = (spy: { mock: { calls: unknown[][] } }): number =>
    spy.mock.calls.filter((call) => String(call[0]) === 'beforeunload').length;

  it('is registered while dirty and removed when clean', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');

    const { rerender } = renderHook(({ d }: { d: boolean }) => useDraftBackup('42', { t: 'x' }, d), {
      initialProps: { d: true },
    });
    expect(countBeforeUnload(add)).toBe(1);
    expect(countBeforeUnload(remove)).toBe(0);

    rerender({ d: false });
    expect(countBeforeUnload(remove)).toBe(1);
  });

  it('is never registered on a clean form', () => {
    const add = vi.spyOn(window, 'addEventListener');
    renderHook(() => useDraftBackup('42', { t: 'x' }, false));
    expect(countBeforeUnload(add)).toBe(0);
  });
});

describe('fmtRecoveredAt', () => {
  // Asserted as a RELATIONSHIP, not a literal: this machine resolves to el-GR
  // and renders "02:02 μ.μ.", where a CI runner on en-US renders "02:02 PM".
  // What the function actually decides is which branch to take, so that is what
  // is checked.
  it('shows time only for today, and prefixes a date for any other day', () => {
    vi.setSystemTime(new Date(2026, 7, 23, 18, 0, 0));

    const today = fmtRecoveredAt(new Date(2026, 7, 23, 14, 2).getTime());
    const yesterday = fmtRecoveredAt(new Date(2026, 7, 22, 14, 2).getTime());

    expect(yesterday).not.toBe(today);
    expect(yesterday.endsWith(today)).toBe(true); // same clock time, date in front
    expect(yesterday.length).toBeGreaterThan(today.length);
  });

  it('treats the same clock time on the previous day as another day', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 0, 30, 0));
    // 90 minutes earlier is the previous calendar day, not "today".
    const justBeforeMidnight = fmtRecoveredAt(new Date(2025, 11, 31, 23, 0).getTime());
    const thisMorning = fmtRecoveredAt(new Date(2026, 0, 1, 0, 0).getTime());
    expect(justBeforeMidnight.length).toBeGreaterThan(thisMorning.length);
  });
});
