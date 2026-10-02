// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import type { ReactNode } from 'react';

// R18 PR E: the search box over the Roll of honour, mounted with the real view: typing hides the seasons that do not match,
// the decades left empty and their chips, the era row and its chip; the counts follow; an empty query restores everything.
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode; className?: string }) => <a href={href} {...rest}>{children}</a> }));

import { DataRegionHonours, type DataRegionViewProps } from './DataRegionViews';
import { matches } from './RollOfHonourSearch';

const season = (over: Record<string, string | number | boolean | null> = {}) => ({
  kind: 'season', year: 2025, driver: 'Leonardo Fornaroli', profile: '/drivers/leonardo-fornaroli', nationality: 'ITA', team: 'Invicta Racing', teamPage: '/teams/invicta-racing', points: 211, wins: 4, podiums: 9, margin: 36, runnerUp: 'Jak Crawford', runnerUpTeam: null, runnerUpPoints: 175, teamsChampion: 'Invicta Racing', teamsChampionPage: '/teams/invicta-racing', teamsTitles: 2, teamsRun: 2, driverTitles: 1, era: 'FIA Formula 2 Championship', decade: '2020s', rookie: true, name: null, titles: null, page: null, seriesName: 'Formula 2', colour: '#38bdf8', ...over,
});
const rows = [
  season(),
  season({ year: 2024, driver: 'Gabriel Bortoleto', profile: null, nationality: 'BRA', points: 214.5, podiums: null, margin: 22.5, runnerUp: 'Isack Hadjar', runnerUpPoints: 192, teamsTitles: 1, teamsRun: 1 }),
  season({ year: 2017, driver: 'Charles Leclerc', profile: null, nationality: 'MON', team: 'Prema Racing', teamPage: null, points: 282, wins: 7, podiums: 10, margin: 72, runnerUp: 'Artem Markelov', runnerUpPoints: 210, teamsChampion: 'Russian Time', teamsChampionPage: null, teamsTitles: 2, teamsRun: 1, decade: '2010s', rookie: true }),
  season({ year: 2016, driver: 'Pierre Gasly', profile: null, nationality: 'FRA', team: 'Prema Racing', teamPage: null, points: 219, wins: 4, podiums: 9, margin: 8, runnerUp: 'Antonio Giovinazzi', runnerUpPoints: 211, teamsChampion: 'Prema Racing', teamsChampionPage: null, teamsTitles: 1, teamsRun: 1, era: 'GP2 Series', decade: '2010s', rookie: false }),
];
// The view reads the heading, the level, the rows and the region alone; the props it never reads are left out here.
const view = (region = 'honours') => <DataRegionHonours {...({ heading: 'Every season', level: 'h2', rows, region } as unknown as DataRegionViewProps)} />;
const visible = (root: ParentNode = document) => [...root.querySelectorAll<HTMLElement>('[data-season]')].filter(s => !s.hidden).map(s => s.dataset.search?.slice(0, 4));
const hidden = (sel: string, root: ParentNode = document) => [...root.querySelectorAll<HTMLElement>(sel)].map(el => el.hidden);

describe('the Roll of honour’s search box (R18 PR E)', () => {
  afterEach(() => cleanup());

  it('matches every word of the query against the slugified haystack: accents and case fold, two words both count, nothing matches nothing', () => {
    const hay = '2017-charles-leclerc-prema-racing-artem-markelov-russian-time-mon-monaco-fia-formula-2-championship-2010s';
    expect(matches(hay, 'Théo')).toBe(false);
    expect(matches(hay, 'LECLERC')).toBe(true);
    expect(matches(hay, 'markelov leclerc')).toBe(true);
    expect(matches(hay, 'markelov gasly')).toBe(false);
    expect(matches(hay, '2017')).toBe(true);
    expect(matches(hay, 'Prema Racing')).toBe(true);
    expect(matches(hay, '   ')).toBe(false);
  });

  it('types a driver, a team, a year, an accented name: the seasons that do not match hide with their empty decades, chips and the era row; the counts follow; an empty query restores', () => {
    render(view());
    const box = screen.getByLabelText('Find a season or a driver') as HTMLInputElement;
    box.focus();
    expect(screen.getByRole('status').textContent).toBe('4 seasons');
    expect(hidden('[data-season], [data-decade], [data-era], [data-chip], [data-chip-era]').every(h => h === false)).toBe(true);
    fireEvent.change(box, { target: { value: 'gasly' } });
    expect(visible()).toEqual(['2016']);
    expect(hidden('[data-decade]')).toEqual([true, false]);
    expect(hidden('[data-chip]')).toEqual([true, false]);
    expect(hidden('[data-era], [data-chip-era]')).toEqual([true, true]);
    expect(screen.getByRole('status').textContent).toBe('1 of 4 seasons');
    expect([...document.querySelectorAll('[data-decade-count]')].map(c => c.textContent)).toEqual(['0 of 2 seasons', '1 of 2 seasons']);
    fireEvent.change(box, { target: { value: 'Prema' } });
    expect(visible()).toEqual(['2017', '2016']);
    fireEvent.change(box, { target: { value: '2024' } });
    expect(visible()).toEqual(['2024']);
    fireEvent.change(box, { target: { value: 'théo' } });
    expect(visible()).toEqual([]);
    expect(screen.getByRole('status').textContent).toBe('No season matches');
    expect((document.querySelector('[data-empty]') as HTMLElement).hidden).toBe(false);
    expect(hidden('[data-decade]')).toEqual([true, true]);
    fireEvent.change(box, { target: { value: 'hadjar' } });
    expect(visible()).toEqual(['2024']);
    fireEvent.change(box, { target: { value: 'monaco' } });
    expect(visible()).toEqual(['2017']);
    fireEvent.change(box, { target: { value: '' } });
    expect(visible()).toEqual(['2025', '2024', '2017', '2016']);
    expect(hidden('[data-decade], [data-era], [data-chip], [data-chip-era]').every(h => h === false)).toBe(true);
    expect((document.querySelector('[data-empty]') as HTMLElement).hidden).toBe(true);
    expect([...document.querySelectorAll('[data-decade-count]')].map(c => c.textContent)).toEqual(['2 seasons', '2 seasons']);
    expect(screen.getByRole('status').textContent).toBe('4 seasons');
    expect(document.activeElement).toBe(box);
  });

  it('two regions on one page stay apart: typing in one leaves the other whole', () => {
    render(
      <>
        {view('honours')}
        {view('again')}
      </>,
    );
    const [first, second] = screen.getAllByLabelText('Find a season or a driver');
    fireEvent.change(first, { target: { value: 'gasly' } });
    const roots = document.querySelectorAll('[data-honours]');
    expect(visible(roots[0])).toEqual(['2016']);
    expect(visible(roots[1])).toEqual(['2025', '2024', '2017', '2016']);
    expect(second).not.toBe(first);
  });

  it('hydrates over its own server markup without a warning, nothing hidden until a query', async () => {
    const html = renderToString(view());
    expect(html).not.toMatch(/data-(season|decade|era|chip|chip-era)=""[^>]*hidden=""/);
    expect(html).toMatch(/<p[^>]*data-empty=""[^>]*hidden=""/);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(container, view());
    });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    container.remove();
  });
});
