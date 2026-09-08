// @vitest-environment jsdom
//
// The alive search placeholder: the header's field carries the text message on
// the first paint, cycles through the hints a minute apart afterwards, wraps,
// and holds still for a person who prefers reduced motion.

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';

vi.mock('next/navigation', () => ({ usePathname: () => '/calendar' }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: unknown; children: React.ReactNode }) => <a href={String(href)}>{children}</a>,
}));

import { NavPanel } from './NavPanel';

let reduced = false;
function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduced-motion') ? reduced : true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

const field = () => screen.getByRole('combobox') as HTMLInputElement;

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  stubMatchMedia();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the search field’s hints', () => {
  it('shows the label first, then the hints a minute apart, wrapping round', () => {
    render(<NavPanel seriesList={[]} bettingEnabled={false} searchLabel="Browse the site, or search it" searchHints={['When is the next race?', 'Who leads F1?']} />);
    expect(field().placeholder).toBe('Browse the site, or search it');
    act(() => vi.advanceTimersByTime(60_000));
    expect(field().placeholder).toBe('When is the next race?');
    act(() => vi.advanceTimersByTime(60_000));
    expect(field().placeholder).toBe('Who leads F1?');
    act(() => vi.advanceTimersByTime(60_000));
    expect(field().placeholder).toBe('When is the next race?');
    expect(field().getAttribute('aria-label')).toBe('Browse the site, or search it');
  });

  it('keeps the label with no hints, and for a person who prefers reduced motion', () => {
    render(<NavPanel seriesList={[]} bettingEnabled={false} searchLabel="Browse the site, or search it" />);
    act(() => vi.advanceTimersByTime(120_000));
    expect(field().placeholder).toBe('Browse the site, or search it');
    cleanup();
    reduced = true;
    stubMatchMedia();
    render(<NavPanel seriesList={[]} bettingEnabled={false} searchLabel="Browse the site, or search it" searchHints={['When is the next race?']} />);
    act(() => vi.advanceTimersByTime(120_000));
    expect(field().placeholder).toBe('Browse the site, or search it');
  });
});
