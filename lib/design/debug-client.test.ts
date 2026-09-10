// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientEntries, noteNavigation, record, resetClientEntries, subscribe } from './debug-client';

// The browser store (P1.9): lines timed from the page's start, listeners told,
// a new address dropping the last page's lines and restarting the clock.

afterEach(() => {
  resetClientEntries();
  vi.restoreAllMocks();
});

describe('the Debug browser store', () => {
  it('records lines timed from the page, tells its listeners, and starts over on a new address', () => {
    let t = 5000;
    vi.spyOn(performance, 'now').mockImplementation(() => t);
    const heard = vi.fn();
    const off = subscribe(heard);
    window.history.replaceState(null, '', '/history/monza');
    record('bind', '1 dynamic action bound');
    t += 250;
    record('action:a1', 'Unfold on click: toggle wire');
    expect(clientEntries().map(e => `${e.phase}@${e.at}`)).toEqual(['bind@0', 'action:a1@250']);
    expect(heard).toHaveBeenCalledTimes(2);
    const same = clientEntries();
    noteNavigation('/history/monza');
    expect(clientEntries()).toBe(same);
    // Another page in the same tab: the old lines go, the clock restarts, the listeners hear it.
    t += 1000;
    window.history.replaceState(null, '', '/calendar');
    noteNavigation('/calendar');
    expect(clientEntries()).toEqual([]);
    expect(heard).toHaveBeenCalledTimes(3);
    t += 40;
    record('bind', '0 dynamic actions bound');
    expect(clientEntries().map(e => `${e.phase}@${e.at}`)).toEqual(['bind@40']);
    off();
    record('action:x', 'y');
    expect(heard).toHaveBeenCalledTimes(4);
  });
});
