// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PageTiming, readTimings, type Timings } from './PageTiming';

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
});
