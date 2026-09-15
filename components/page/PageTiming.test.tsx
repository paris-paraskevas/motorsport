// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PageTiming, readTimings, timingTable, type Timings } from './PageTiming';

// The Page Performance Timing dialog (P1.7; APEX: Info › Show Page Timing, a
// dialog whose Copy button copies the timing data as a table and whose Clear
// removes the current timing events). jsdom has none of the browser's timing
// APIs, so the tests hand the dialog its source and its sinks.

const timings: Timings = {
  navigation: [
    { label: 'Redirect', ms: 0 },
    { label: 'DNS', ms: 12.4 },
    { label: 'Connect', ms: 30 },
    { label: 'Request to first byte', ms: 210.6 },
    { label: 'Response', ms: 15 },
    { label: 'DOM interactive', ms: 480 },
    { label: 'DOM content loaded', ms: 495 },
    { label: 'Load', ms: 900.2 },
  ],
  resources: [
    { label: '/_next/static/chunks/main.js', ms: 120, detail: 'script · 48 KB' },
    { label: '/media/2026/09/a.jpg', ms: 80.5, detail: 'img' },
  ],
  total: 7,
};

afterEach(() => cleanup());

describe('PageTiming (P1.7)', () => {
  it('lists the navigation rows and the slowest resources with their count; Copy writes the rows as a tab-separated table; Clear clears and re-reads; Close and Escape close', () => {
    const copy = vi.fn();
    const clear = vi.fn();
    const onClose = vi.fn();
    const source = vi.fn(() => timings);
    render(<PageTiming onClose={onClose} timings={source} copy={copy} clear={clear} />);
    const dialog = screen.getByRole('dialog', { name: 'Page Performance Timing' });
    expect(within(dialog).getByText('Request to first byte').nextElementSibling?.textContent).toBe('210.6');
    expect(within(dialog).getByText('Load').nextElementSibling?.textContent).toBe('900.2');
    expect(within(dialog).getByText('/_next/static/chunks/main.js')).toBeTruthy();
    expect(within(dialog).getByText('script · 48 KB')).toBeTruthy();
    expect(within(dialog).getByText(/7 resources/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy' }));
    expect(copy).toHaveBeenCalledTimes(1);
    const text = String(copy.mock.calls[0][0]);
    expect(text.split('\n')[0]).toBe('Step\tms');
    expect(text).toContain('Request to first byte\t210.6');
    expect(text).toContain('/_next/static/chunks/main.js\t120\tscript · 48 KB');
    expect(source).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear' }));
    expect(clear).toHaveBeenCalledTimes(1);
    expect(source).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close Page Timing' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('readTimings answers empty where the browser has no timing API (jsdom), never throwing', () => {
    expect(readTimings()).toEqual({ navigation: [], resources: [], total: 0 });
  });

  it('readTimings shapes the browser’s entries: the navigation steps to one decimal, Load blank until it ends, the slowest eight resources with their path, kind and size', () => {
    const nav = { redirectStart: 0, redirectEnd: 0, domainLookupStart: 5, domainLookupEnd: 17.44, connectStart: 17.44, connectEnd: 47.4, requestStart: 48, responseStart: 258.66, responseEnd: 273.6, domInteractive: 480.04, domContentLoadedEventEnd: 495, loadEventEnd: 0 };
    const resource = (name: string, duration: number, initiatorType: string, transferSize: number) => ({ name, duration, initiatorType, transferSize });
    const resources = Array.from({ length: 10 }, (_, i) => resource(`http://localhost:3000/_next/static/chunks/c${i}.js`, 10 * (i + 1), 'script', 2048 * (i + 1)));
    resources.push(resource('https://api.example.com/v1/client', 500, 'fetch', 0));
    vi.stubGlobal('performance', { getEntriesByType: (type: string) => (type === 'navigation' ? [nav] : type === 'resource' ? resources : []), clearResourceTimings: vi.fn() });
    try {
      const t = readTimings();
      expect(t.navigation).toEqual([
        { label: 'Redirect', ms: 0 },
        { label: 'DNS', ms: 12.4 },
        { label: 'Connect', ms: 30 },
        { label: 'Request to first byte', ms: 210.7 },
        { label: 'Response', ms: 14.9 },
        { label: 'DOM interactive', ms: 480 },
        { label: 'DOM content loaded', ms: 495 },
        { label: 'Load', ms: null },
      ]);
      expect(t.total).toBe(11);
      expect(t.resources).toHaveLength(8);
      expect(t.resources[0]).toEqual({ label: 'api.example.com/v1/client', ms: 500, detail: 'fetch' });
      expect(t.resources[1]).toEqual({ label: '/_next/static/chunks/c9.js', ms: 100, detail: 'script · 20 KB' });
      expect(timingTable(t).split('\n')).toEqual(expect.arrayContaining(['Step\tms', 'Load\t', 'Resource\tms\tkind', 'api.example.com/v1/client\t500\tfetch']));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
