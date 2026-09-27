// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

let followed: string[] | null = ['f1'];
vi.mock('@/lib/useFollowedSeries', () => ({ useFollowedSeries: () => ({ followed, hydrated: true, setFollowed: () => {}, clearFollowed: () => {} }) }));

import { FollowedRows, FollowedScope } from './FollowedRows';

describe('FollowedRows (P2.4)', () => {
  afterEach(cleanup);

  it('marks the rows of the reader’s followed series under its region after the page loads, and none when the reader follows everything (null)', () => {
    const { rerender } = render(
      <div id="region-t">
        <table>
          <tbody>
            <tr data-series="f1" data-testid="f1">
              <td>Italian Grand Prix</td>
            </tr>
            <tr data-series="wec" data-testid="wec">
              <td>Fuji</td>
            </tr>
            <tr data-testid="none">
              <td>—</td>
            </tr>
          </tbody>
        </table>
        <FollowedRows region="t" />
      </div>,
    );
    expect(document.querySelector('[data-testid="f1"]')?.hasAttribute('data-followed')).toBe(true);
    expect(document.querySelector('[data-testid="wec"]')?.hasAttribute('data-followed')).toBe(false);
    expect(document.querySelector('[data-testid="none"]')?.hasAttribute('data-followed')).toBe(false);
    followed = ['wec'];
    rerender(
      <div id="region-t">
        <table>
          <tbody>
            <tr data-series="f1" data-testid="f1">
              <td>Italian Grand Prix</td>
            </tr>
            <tr data-series="wec" data-testid="wec">
              <td>Fuji</td>
            </tr>
          </tbody>
        </table>
        <FollowedRows region="t" />
      </div>,
    );
    expect(document.querySelector('[data-testid="f1"]')?.hasAttribute('data-followed')).toBe(false);
    expect(document.querySelector('[data-testid="wec"]')?.hasAttribute('data-followed')).toBe(true);
    followed = null;
    rerender(
      <div id="region-t">
        <table>
          <tbody>
            <tr data-series="f1" data-testid="f1">
              <td>Italian Grand Prix</td>
            </tr>
          </tbody>
        </table>
        <FollowedRows region="t" />
      </div>,
    );
    expect(document.querySelector('[data-testid="f1"]')?.hasAttribute('data-followed')).toBe(false);
    // The component draws nothing of its own.
    expect(document.getElementById('region-t')?.querySelectorAll('tr').length).toBe(1);
  });
});

describe('FollowedScope (P2.5 PR C)', () => {
  afterEach(cleanup);

  it('for a reader who follows series: Everything and Yours only above the rows, Yours only first, hiding every row of another series under the region; Everything shows them all', () => {
    followed = ['f1'];
    render(
      <div id="region-t">
        <FollowedScope region="t" />
        <a data-series="f1" data-testid="f1" href="https://www.example.com/1">
          One
        </a>
        <a data-series="wec" data-testid="wec" href="https://www.example.com/2">
          Two
        </a>
        <a data-testid="none" href="https://www.example.com/3">
          Three
        </a>
      </div>,
    );
    expect(screen.getByRole('button', { name: 'Yours only' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Everything' }).getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('[data-testid="wec"]')?.hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('[data-testid="f1"]')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[data-testid="none"]')?.hasAttribute('hidden')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Everything' }));
    expect(screen.getByRole('button', { name: 'Everything' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-testid="wec"]')?.hasAttribute('hidden')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Yours only' }));
    expect(document.querySelector('[data-testid="wec"]')?.hasAttribute('hidden')).toBe(true);
  });

  it('a pick in the address wins: the scope starts at Everything when the address carries a filter, so a series picked outside the follows shows', () => {
    followed = ['f1'];
    window.history.replaceState({}, '', '/news?filter=seriesName.in%3AMotoGP');
    try {
      render(
        <div id="region-t">
          <FollowedScope region="t" />
          <a data-series="motogp" data-testid="motogp" href="https://www.example.com/4">
            Four
          </a>
        </div>,
      );
      expect(screen.getByRole('button', { name: 'Everything' }).getAttribute('aria-pressed')).toBe('true');
      expect(document.querySelector('[data-testid="motogp"]')?.hasAttribute('hidden')).toBe(false);
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('says so when Yours only leaves no row, and the note goes with Everything', () => {
    followed = ['f1'];
    render(
      <div id="region-t">
        <FollowedScope region="t" />
        <a data-series="wec" data-testid="wec" href="https://www.example.com/2">
          Two
        </a>
      </div>,
    );
    const note = screen.getByText('No stories from the series you follow; Everything shows the rest.');
    expect(note.hidden).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Everything' }));
    expect(note.hidden).toBe(true);
    expect(document.querySelector('[data-testid="wec"]')?.hasAttribute('hidden')).toBe(false);
  });

  it('draws nothing and hides nothing for a reader following everything (null)', () => {
    followed = null;
    render(
      <div id="region-t">
        <FollowedScope region="t" />
        <a data-series="wec" data-testid="wec" href="https://www.example.com/2">
          Two
        </a>
      </div>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('[data-testid="wec"]')?.hasAttribute('hidden')).toBe(false);
  });
});
