// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

let followed: string[] | null = ['f1'];
vi.mock('@/lib/useFollowedSeries', () => ({ useFollowedSeries: () => ({ followed, hydrated: true, setFollowed: () => {}, clearFollowed: () => {} }) }));

import { FollowedRows } from './FollowedRows';

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
