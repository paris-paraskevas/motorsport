// Round 2's series pages on the Paddock theme (slots O13 to O17): the frame every series page shares, the
// Overview (O13) and Results (O15). Pure, as render.ts: the stored feeds and the repository's content in, block markup out.
// Every string from a feed or a content file passes escapeHtml, and every href is built here. A time is
// written in UTC as `.pd-t[data-utc]` and a weekend's label as `.pd-wk[data-from][data-to]`; the theme's
// script (wp-theme/paddock/assets/js/paddock.js) shows them in the reader's zone and names what is on now,
// so a page changes only when its data does. Inline style carries only `width` and `--t`, both of which
// WordPress keeps in post content (safecss_filter_attr, WordPress 6.1 onward).

import type { TitleRaceFile } from '@/lib/series-content';
import { slugify } from '@/lib/slug';
import type { Champion } from '@/lib/types';
import { calendarMonthPath, escapeHtml, seasonPath, seriesPath, sessionKind, WEEKEND_PAGES, weekendPath, type CalendarRound, type Page, type ResultRound, type ResultSession, type SeriesData, type SeriesTeam, type Table } from './render';

/** The series drawn in round 2's design; the others keep the plain pages until slot O18. */
export const ROUND2_SERIES: ReadonlySet<string> = new Set(['f1']);

const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const AT = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** Only a hex colour reaches a style attribute; anything else draws in the neutral grey. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const NEUTRAL = '#9aa3b2';

export const htmlBlock = (inner: string): string => `<!-- wp:html -->\n${inner}\n<!-- /wp:html -->`;
// en-GB writes September as "Sept"; round 2 writes "Sep".
export const dayLabel = (day: string): string => DAY.format(new Date(`${day}T12:00:00Z`)).replace('Sept', 'Sep');
const clock = (iso: string): string => `<span class="pd-t" data-utc="${escapeHtml(iso)}" data-f="wt">${AT.format(new Date(iso))} UTC</span>`;
export const col = (columns: string[], ...names: string[]): number => columns.findIndex(c => names.includes(c));

/** A series' weekend page for a round, when its weekends have pages (O19); null for the others. */
const weekendOf = (d: SeriesData, round: number): string | null => (WEEKEND_PAGES.has(d.slug) && d.season ? weekendPath(d.slug, d.season, round) : null);

/** "23–25 Oct", "30 Oct–1 Nov" across two months, or "25 Oct" for a one-day round. */
export function dates(from: string, to: string): string {
  if (from === to) return dayLabel(to);
  return from.slice(0, 7) === to.slice(0, 7) ? `${Number(from.slice(8))}–${dayLabel(to)}` : `${dayLabel(from)}–${dayLabel(to)}`;
}

/** A label the theme's script turns into `on` while the reader's own date is within the round's dates. */
export function wk(r: CalendarRound, off: string, on: string): string {
  return `<span class="pd-wk" data-from="${escapeHtml(r.startDate)}" data-to="${escapeHtml(r.endDate)}" data-on="${escapeHtml(on)}">${escapeHtml(off)}</span>`;
}

/** The host's outline, which the theme draws as a mask in the text's colour; nothing when it carries none. */
export function outline(key: string | null | undefined, extra = ''): string {
  return key && /^[a-z0-9-]+$/.test(key) ? `<i class="pd-ol pd-ol-${key}${extra}" aria-hidden="true"></i>` : '';
}

// ── Teams and drivers ────────────────────────────────────────────────────────

// The feeds write "Haas F1 Team" where drivers.json writes "Haas".
const plain = (team: string): string => team.toLowerCase().replace(/\s+f1 team$/, '').trim();
export const teamLabel = (team: string): string => team.replace(/ F1 Team$/, '');
const bare = (name: string): string => (name.split(' ').pop() ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function teamOf(d: SeriesData, team: string): SeriesTeam | undefined {
  const key = plain(team);
  return d.teams?.find(t => plain(t.name) === key);
}

export function colourOf(d: SeriesData, team: string): string {
  const c = teamOf(d, team)?.colour ?? '';
  return HEX.test(c) ? c : NEUTRAL;
}

/** A driver's three-letter code from drivers.json, matched by surname; else the surname's first three letters. */
export function codeOf(d: SeriesData, name: string): string {
  for (const t of d.teams ?? []) for (const x of t.drivers) if (x.code && bare(x.name) === bare(name)) return x.code;
  return bare(name).slice(0, 3).toUpperCase();
}

/** A driver's car number from drivers.json, matched by surname as codeOf is; null when it holds none. */
export function numberOf(d: SeriesData, name: string): number | null {
  for (const t of d.teams ?? []) for (const x of t.drivers) if (typeof x.number === 'number' && bare(x.name) === bare(name)) return x.number;
  return null;
}

/** A team's colour as a tick before a name: `--t` is one of the two inline styles WordPress keeps. */
export const tick = (d: SeriesData, team: string): string => `<i class="pd-tc" style="--t:${colourOf(d, team)}"></i>`;

// ── The season's races ───────────────────────────────────────────────────────

export interface RoundWin {
  round: number;
  /** The results feed's name, for a round rounds.json does not know. */
  title: string;
  date: string | null;
  winner: string;
  team: string;
  /** The winner's margin over second in seconds ("7.335"), or "" when second was lapped or out. */
  margin: string;
}

/** Each round's race, the last session in its running order that is not a sprint: the winner, the team and the
 *  margin. Sprints are not wins, and a sprint weekend's Saturday, when the round holds its Sprint alone, has no race. */
export function raceWins(d: SeriesData): Map<number, RoundWin> {
  const out = new Map<number, RoundWin>();
  for (const r of d.results ?? []) {
    if (r.round === null) continue;
    const race = r.sessions.find(s => s.label === 'Race') ?? [...r.sessions].reverse().find(s => !/^sprint/i.test(s.label));
    const t = race?.tables[0];
    const nameAt = t ? col(t.columns, 'Driver', 'Rider') : -1;
    if (!t || t.rows.length === 0 || nameAt < 0) continue;
    const teamAt = col(t.columns, 'Team');
    const timeAt = col(t.columns, 'Time');
    const second = timeAt >= 0 ? (t.rows[1]?.[timeAt] ?? '') : '';
    out.set(r.round, {
      round: r.round,
      title: r.name,
      date: r.date,
      winner: t.rows[0][nameAt],
      team: teamAt >= 0 ? t.rows[0][teamAt] : '',
      margin: /^\+\d[\d:.]*$/.test(second) ? second.slice(1) : '',
    });
  }
  return out;
}

const driverWins = (wins: Map<number, RoundWin>, name: string): number => [...wins.values()].filter(w => w.winner === name).length;
const teamWins = (wins: Map<number, RoundWin>, team: string): number => [...wins.values()].filter(w => plain(w.team) === plain(team)).length;
const winsLabel = (n: number): string => `${n} win${n === 1 ? '' : 's'}`;

// ── The frame: the band and the tabs ─────────────────────────────────────────

type SeriesTab = 'overview' | 'calendar' | 'standings' | 'results' | 'champions';

/** The pages built in round 2's design for a series beyond its Overview; every link to one waits for it, greyed. */
const BUILT: Readonly<Record<string, ReadonlySet<'standings' | 'results' | 'champions'>>> = { f1: new Set(['results', 'standings', 'champions']) };
export const built = (slug: string, tab: 'standings' | 'results' | 'champions'): boolean => Boolean(BUILT[slug]?.has(tab));

/** The five tabs, each a page at its own address; Calendar opens the site's Calendar showing only this series. A page
 *  below the tabs that none of them names (a season, O19) lights none. */
export function tabs(d: SeriesData, on: SeriesTab | null): string {
  const links: Array<[SeriesTab, string, string]> = [
    ['overview', 'Overview', seriesPath(d.slug)],
    ['calendar', 'Calendar', `/calendar/#${d.slug}`],
    ['standings', 'Standings', seriesPath(d.slug, 'standings')],
    ['results', 'Results', seriesPath(d.slug, 'results')],
    ['champions', 'Champions', seriesPath(d.slug, 'champions')],
  ];
  const ready = (tab: SeriesTab) => tab === 'overview' || tab === 'calendar' || Boolean(BUILT[d.slug]?.has(tab));
  const items = links.map(([tab, label, href]) =>
    ready(tab) ? `<a href="${escapeHtml(href)}"${tab === on ? ' aria-current="page"' : ''}>${label}</a>` : `<span class="is-off">${label}</span>`,
  );
  return `<nav class="pd-sr-tabs" aria-label="${escapeHtml(d.name)} pages"><div class="pd-sr-tabs-in">${items.join('')}</div></nav>`;
}

/** The series band: its name, the season in a line, a bar of its rounds, Follow (the theme's script) and Session emails. */
export function band(d: SeriesData, wins: Map<number, RoundWin>, current: CalendarRound | undefined): string {
  const rounds = d.rounds ?? [];
  const line = [d.season ? `${escapeHtml(String(d.season))} season` : '', `${rounds.length} rounds`, `${rounds.filter(r => wins.has(r.round)).length} run`].filter(Boolean).join(' · ');
  const next = current ? ` · ${wk(current, `next: round ${current.round}`, `round ${current.round} this weekend`)}` : '';
  const bar = rounds.map(r => `<i${wins.has(r.round) ? ' class="is-done"' : r === current ? ' class="is-now"' : ''}></i>`).join('');
  return (
    `<section class="pd-sr-band"><div class="pd-sr-band-in"><div class="pd-sr-ttl"><h1>${escapeHtml(d.name)}</h1><p>${line}${next}</p><span class="pd-sr-bar" aria-hidden="true">${bar}</span></div>` +
    `<div class="pd-sr-acts"><button type="button" class="pd-sr-follow" data-pd-follow="${escapeHtml(d.slug)}" hidden>Follow</button><a class="pd-sr-emails" href="/subscribe/">Session emails</a></div></div></section>`
  );
}

// ── The Overview ─────────────────────────────────────────────────────────────

/** The round to come: what is on now or next (the theme's script, from the round's sessions) and the race. A name
 *  rides in the list URI-encoded, since the feeds' names can hold its separators ("F3 | Sakhir | Race 1"). */
function nextCard(d: SeriesData, r: CalendarRound): string {
  const sessions = (d.calendar ?? []).filter(e => e.round === r.round && !e.dateOnly).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const race = [...sessions].reverse().find(e => /^race$/i.test(e.session)) ?? sessions[sessions.length - 1];
  const where = [r.venue ?? '', dates(r.startDate, r.endDate)].filter(Boolean).map(escapeHtml).join(' · ');
  const page = weekendOf(d, r.round);
  return (
    `<article class="pd-sr-card pd-sr-next" data-pd-ses="${escapeHtml(sessions.map(e => `${encodeURIComponent(e.session)}|${e.start}|${e.end}`).join(';'))}"><div class="pd-sr-card-in">` +
    `<p class="pd-sr-lab"><span class="pd-pill pd-pill-live" hidden>● Live</span><span>Round ${r.round} · ${wk(r, 'next', 'this weekend')}</span></p>` +
    `<h2>${page ? `<a href="${page}">${escapeHtml(r.name)}</a>` : escapeHtml(r.name)}</h2><p class="pd-mut">${where}</p>` +
    (race ? `<p class="pd-sr-line"><b class="pd-sr-ses"></b><span class="pd-sr-race">${escapeHtml(race.session)} ${clock(race.start)}</span></p>` : '') +
    `</div><i class="pd-sr-num" aria-hidden="true">${r.round}</i></article>`
  );
}

function lastCard(d: SeriesData, w: RoundWin, r: CalendarRound | undefined): string {
  const where = [r?.venue ?? '', w.date ? dayLabel(w.date) : ''].filter(Boolean).map(escapeHtml).join(' · ');
  const how = `${escapeHtml(teamLabel(w.team))}${w.margin ? ` · won by ${escapeHtml(w.margin)} s` : ''}`;
  const page = weekendOf(d, w.round);
  const name = escapeHtml(r?.name ?? w.title);
  return (
    `<article class="pd-sr-card"><div class="pd-sr-card-in"><p class="pd-sr-lab">Last race · Round ${w.round}</p><h2>${page ? `<a href="${page}">${name}</a>` : name}</h2><p class="pd-mut">${where}</p>` +
    `<p class="pd-sr-line"><span class="pd-sr-win" style="--t:${colourOf(d, w.team)}"><b>${escapeHtml(w.winner)}</b></span> <span class="pd-mut">${how}</span></p></div>` +
    `${outline(r?.outline, ' pd-ol-big')}</article>`
  );
}

/** A round's tile: its weekend page where the series has them (O19); else a finished round opens its line on the
 *  Results page, and a round to come its month on the Calendar. */
function tile(d: SeriesData, r: CalendarRound, w: RoundWin | undefined, current: CalendarRound | undefined): string {
  const head = `<small>R${r.round}</small><b>${escapeHtml(r.place ?? r.name)}</b>${outline(r.outline)}`;
  const page = weekendOf(d, r.round);
  if (w) {
    const won = `<span class="pd-sr-win" style="--t:${colourOf(d, w.team)}"><b>${escapeHtml(codeOf(d, w.winner))}</b>${w.date ? dayLabel(w.date) : ''}</span>`;
    return `<a class="pd-sr-tile" href="${page ?? `${seriesPath(d.slug, 'results')}#r${r.round}`}">${head}${won}</a>`;
  }
  const when = dates(r.startDate, r.endDate);
  const label = r === current ? wk(r, `Next · ${when}`, `This weekend · ${when}`) : escapeHtml(when);
  return `<a class="pd-sr-tile ${r === current ? 'is-now' : 'is-ahead'}" href="${page ?? `${calendarMonthPath(r.startDate.slice(0, 7))}#${escapeHtml(d.slug)}`}">${head}<span class="pd-sr-when">${label}</span></a>`;
}

/** The top of a standings table with points bars sized against the leader; the driver's wins, races only. */
function tableRows(d: SeriesData, t: Table, wins: Map<number, RoundWin>, limit: number, drivers: boolean): string {
  const posAt = col(t.columns, 'Pos');
  const nameAt = drivers ? col(t.columns, 'Driver', 'Rider') : col(t.columns, 'Constructor', 'Team', 'Manufacturer');
  const teamAt = drivers ? col(t.columns, 'Team') : nameAt;
  const ptsAt = col(t.columns, 'Pts', 'Points');
  if (nameAt < 0 || ptsAt < 0) return '';
  const lead = Number(t.rows[0]?.[ptsAt]) || 0;
  return t.rows
    .slice(0, limit)
    .map(row => {
      const pts = Number(row[ptsAt]) || 0;
      const team = teamAt >= 0 ? row[teamAt] : '';
      const width = lead > 0 ? Math.max(0, Math.min(100, (pts / lead) * 100)).toFixed(1) : '0';
      const who = drivers ? `<b>${escapeHtml(row[nameAt])}</b> <small>${escapeHtml(teamLabel(team))}</small>` : `<b>${escapeHtml(teamLabel(row[nameAt]))}</b>`;
      const n = drivers ? driverWins(wins, row[nameAt]) : teamWins(wins, row[nameAt]);
      return (
        `<li><span class="pd-p">${escapeHtml(posAt >= 0 ? row[posAt] : '')}</span><span class="pd-d">${who}<i class="pd-sr-pts"><i style="width:${width}%;--t:${colourOf(d, team)}"></i></i></span>` +
        `<span class="pd-pt">${escapeHtml(row[ptsAt])}</span><span class="pd-w">${drivers ? winsLabel(n) : n}</span></li>`
      );
    })
    .join('');
}

function standings(d: SeriesData, wins: Map<number, RoundWin>): string {
  const [drivers, teams] = d.standings ?? [];
  if (!drivers) return '';
  const head = (who: string, last: string) => `<div class="pd-sr-th"><span></span><span>${who}</span><span>Pts</span><span>${last}</span></div>`;
  const left =
    `<div><div class="pd-sh"><h2>${escapeHtml(drivers.title)}</h2><p>${BUILT[d.slug]?.has('standings') ? `<a href="${seriesPath(d.slug, 'standings')}">All ${drivers.rows.length} →</a>` : `<span class="is-off">All ${drivers.rows.length}</span>`}</p></div>` +
    `${head('Driver', 'Wins')}<ol class="pd-sr-tbl">${tableRows(d, drivers, wins, 10, true)}</ol></div>`;
  const right = teams
    ? `<div><div class="pd-sh"><h2>${escapeHtml(teams.title)}</h2></div>${head('Team', 'Wins')}<ol class="pd-sr-tbl">${tableRows(d, teams, wins, teams.rows.length, false)}</ol></div>`
    : '';
  return `<section class="pd-sr-sec pd-sr-two">${left}${right}</section>`;
}

/** overview.md as headings and paragraphs: "## " heads a section and "**…**" is bold; the rest is text. */
export function prose(md: string): string {
  const inline = (s: string): string => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  return md
    .split(/\r?\n\s*\r?\n/)
    .map(b => b.trim())
    .filter(Boolean)
    .map(b => (b.startsWith('## ') ? `<h3>${inline(b.slice(3))}</h3>` : `<p>${inline(b.replace(/\s*\r?\n\s*/g, ' '))}</p>`))
    .join('');
}

/** WordPress's slug for a category named as the series is ("Formula 1" → "formula-1"). */
export function categorySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** /series/<slug>/: the round on now or next and the last race, the season a tile a round, the standings' top,
 *  the series' newest posts (the theme's [pd_series_posts], nothing when the category has none) and About. */
export function seriesOverview(d: SeriesData): Page {
  const wins = raceWins(d);
  const rounds = d.rounds ?? [];
  const current = rounds.find(r => !wins.has(r.round));
  const last = [...wins.values()].sort((a, b) => b.round - a.round)[0];
  const cards = [current ? nextCard(d, current) : '', last ? lastCard(d, last, rounds.find(r => r.round === last.round)) : ''].join('');
  const tiles =
    rounds.map(r => tile(d, r, wins.get(r.round), current)).join('') +
    (d.cancelled ?? [])
      .map(c => `<span class="pd-sr-tile is-off"><small>—</small><b><s>${escapeHtml(c.place ?? c.name)}</s></b><span class="pd-sr-when">Cancelled · was round ${c.round}</span></span>`)
      .join('');
  const season = rounds.length
    ? `<section class="pd-sr-sec"><div class="pd-sh"><h2>Season</h2><p><a href="/calendar/#${escapeHtml(d.slug)}">Full calendar →</a></p></div><div class="pd-sr-grid">${tiles}</div></section>`
    : '';
  const main =
    `<div class="pd-sr pd-s-${escapeHtml(d.slug)}">${band(d, wins, current)}${tabs(d, 'overview')}` +
    `<div class="pd-sr-main">${cards ? `<div class="pd-sr-cards">${cards}</div>` : ''}${season}${standings(d, wins)}</div></div>`;
  const posts = `<!-- wp:shortcode -->\n[pd_series_posts category="${categorySlug(d.name)}" title="${escapeHtml(d.name)}" series="${escapeHtml(d.slug)}"]\n<!-- /wp:shortcode -->`;
  const about = d.about?.trim()
    ? htmlBlock(`<section class="pd-sr-sec pd-sr-about"><div class="pd-sh"><h2>About ${escapeHtml(d.name)}</h2></div><div class="pd-sr-prose">${prose(d.about)}</div></section>`)
    : '';
  return { path: seriesPath(d.slug), title: d.name, body: [htmlBlock(main), posts, about].filter(Boolean).join('\n\n'), template: 'page-wide' };
}

// ── Results ──────────────────────────────────────────────────────────────────

/** The round's race: a sprint is never it (raceWins). */
export const raceOf = (r: ResultRound): ResultSession | undefined => r.sessions.find(s => s.label === 'Race') ?? [...r.sessions].reverse().find(s => !/^sprint/i.test(s.label));

/** A sprint weekend: a Sprint stored for the round, or timed for it. */
export const sprintWeekend = (d: SeriesData, round: number, r?: ResultRound): boolean =>
  (r?.sessions ?? []).some(s => /^sprint$/i.test(s.label)) || (d.calendar ?? []).some(e => e.round === round && /^sprint$/i.test(e.session));

export interface WeekendScore {
  name: string;
  team: string;
  /** The sprint's points, the race's and their total. */
  s: number;
  r: number;
  t: number;
  /** The race's finishing place; 99 for a driver who scored in the sprint alone. */
  pos: number;
}

/** Every driver who scored at a round: the sprint's points and the race's, by the weekend's total, equal totals by the
 *  race's result (the operator, 21 Oct: "points only in every fold"). */
export function weekendPoints(r: ResultRound): WeekendScore[] {
  const rows = new Map<string, WeekendScore>();
  const add = (t: Table | undefined, key: 's' | 'r') => {
    if (!t) return;
    const nameAt = col(t.columns, 'Driver');
    const teamAt = col(t.columns, 'Team');
    const ptsAt = col(t.columns, 'Pts', 'Points');
    const posAt = col(t.columns, 'Pos');
    if (nameAt < 0 || ptsAt < 0) return;
    for (const row of t.rows) {
      const x = rows.get(row[nameAt]) ?? { name: row[nameAt], team: teamAt >= 0 ? row[teamAt] : '', s: 0, r: 0, t: 0, pos: 99 };
      x[key] = Number.parseFloat(row[ptsAt]) || 0;
      if (key === 'r') x.pos = Number(posAt >= 0 ? row[posAt] : '') || 99;
      rows.set(x.name, x);
    }
  };
  add(r.sessions.find(s => s.label === 'Race')?.tables[0], 'r');
  add(r.sessions.find(s => /^sprint$/i.test(s.label))?.tables[0], 's');
  return [...rows.values()].map(x => ({ ...x, t: x.s + x.r })).filter(x => x.t > 0).sort((a, b) => b.t - a.t || a.pos - b.pos);
}

/** A round's points as a table: a sprint weekend's S, R and Total for every scorer, a standard one's Pos, Driver, Team
 *  and Pts. */
export function pointsTable(d: SeriesData, rows: WeekendScore[], sprint: boolean): string {
  const who = (x: WeekendScore) => `<td class="d">${tick(d, x.team)}<b>${escapeHtml(codeOf(d, x.name))}</b><span>${escapeHtml(x.name)}</span></td><td class="tm">${escapeHtml(teamLabel(x.team))}</td>`;
  const head = sprint
    ? '<tr><th class="d">Driver</th><th class="tm">Team</th><th class="n" title="Sprint">S</th><th class="n" title="Race">R</th><th class="n tot">Total</th></tr>'
    : '<tr><th class="p">Pos</th><th class="d">Driver</th><th class="tm">Team</th><th class="n tot">Pts</th></tr>';
  const body = rows
    .map(x => (sprint ? `<tr>${who(x)}<td class="n">${x.s || '–'}</td><td class="n">${x.r || '–'}</td><td class="n tot">${x.t}</td></tr>` : `<tr><td class="p">${x.pos === 99 ? '–' : x.pos}</td>${who(x)}<td class="n tot">${x.t}</td></tr>`))
    .join('');
  const note = sprint ? `Every driver who scored this weekend (${rows.length}), by the weekend's total; equal totals by the race result.` : rows.length === 1 ? 'The driver who scored.' : `The ${rows.length} drivers who scored.`;
  return rows.length ? `<table class="pd-wk-tbl pd-wk-pts"><thead>${head}</thead><tbody>${body}</tbody></table><p class="pd-wk-note">${note}</p>` : '';
}

/** A round as one row in its winner's colour (approved as drawn on Paddock Weekend Drafts): its number, its name, place
 *  and dates, its winner, and See weekend → to its weekend page; open, the weekend's points. */
function resultRow(d: SeriesData, r: ResultRound & { round: number }, race: ResultSession, w: RoundWin | undefined, open: boolean): string {
  const cr = d.rounds?.find(x => x.round === r.round);
  const name = cr?.name ?? r.name;
  const sprint = sprintWeekend(d, r.round, r);
  const st = r.sessions.find(s => /^sprint$/i.test(s.label))?.tables[0];
  const sprintWin = st?.rows[0]?.[col(st.columns, 'Driver')];
  const when = cr ? dates(cr.startDate, cr.endDate) : w?.date ? dayLabel(w.date) : r.date ? dayLabel(r.date) : '';
  const where = [cr?.place ?? '', when].filter(Boolean).map(escapeHtml).join(' · ');
  const page = weekendOf(d, r.round);
  const also = sprintWin && w ? (sprintWin === w.winner ? ' · won the sprint too' : ` · sprint: ${escapeHtml(sprintWin)}`) : '';
  const winner = w
    ? `<span class="pd-rs-win">${tick(d, w.team)}<b>${escapeHtml(w.winner)}</b><small>${escapeHtml(teamLabel(w.team))}${also}</small></span>`
    : '<span class="pd-rs-win"></span>';
  const summary =
    `<summary><span class="pd-rs-n">${r.round}</span><span class="pd-rs-name"><b>${escapeHtml(name)}</b><small>${where}${sprint ? ' · <em>Sprint</em>' : ''}</small></span>` +
    `${winner}${page ? `<a class="pd-rs-go" href="${page}">See weekend →</a>` : '<span></span>'}</summary>`;
  const all = race.tables[0]?.rows.length ?? 0;
  const more = page ? `<a class="pd-rs-all" href="${page}">All ${all} and every session on the weekend page →</a>` : '';
  return `<details class="pd-rs-row" id="r${r.round}" style="--t:${w ? colourOf(d, w.team) : NEUTRAL}"${open ? ' open' : ''}>${summary}<div class="pd-rs-fold">${pointsTable(d, weekendPoints(r), sprint)}${more}</div></details>`;
}

/** /series/<slug>/results/: a row a round that has raced, the latest first and open. */
export function seriesResults(d: SeriesData): Page {
  const wins = raceWins(d);
  const current = (d.rounds ?? []).find(r => !wins.has(r.round));
  const raced = (d.results ?? [])
    .flatMap(r => {
      const race = raceOf(r);
      return r.round !== null && race ? [{ r: r as ResultRound & { round: number }, race }] : [];
    })
    .sort((a, b) => b.r.round - a.r.round);
  const line = [d.season ? String(d.season) : '', `${wins.size} of ${(d.rounds ?? []).length || wins.size} rounds run`, 'the latest first'].filter(Boolean).join(' · ');
  const list = raced.length
    ? `<div class="pd-rs">${raced.map(({ r, race }, i) => resultRow(d, r, race, wins.get(r.round), i === 0)).join('')}</div>`
    : '<p class="pd-mut">No results yet this season.</p>';
  const main =
    `<div class="pd-sr pd-s-${escapeHtml(d.slug)}">${band(d, wins, current)}${tabs(d, 'results')}` +
    `<div class="pd-sr-main"><section class="pd-sr-sec pd-rs-page"><div class="pd-sh"><h2>Results</h2><p>${escapeHtml(line)}</p></div>${list}</section></div></div>`;
  return { path: seriesPath(d.slug, 'results'), title: `${d.name} results`, body: htmlBlock(main), template: 'page-wide' };
}

// ── Standings (O16) ──────────────────────────────────────────────────────────
//
// As approved on The Paddock Drafts with the operator's answers of 22 Oct: the drivers with bars against the leader,
// the gaps and race wins, the leader tinted and a dashed line under the last driver who can still draw level; Who can
// still win it; the constructors; the points each driver scored for each team. The theme's script adds the switch
// (Drivers, Constructors, Both) and sets data-show; without it both tables stand.

/** Formula 1's 2026 scales (content/series/f1/rules.md, Points): a Grand Prix pays 25 and 18 to its first two, a sprint
 *  8 and 7, and there is no fastest-lap point. A team can take at most its two cars' first two places. */
const GP = [25, 18] as const;
const SPRINT = [8, 7] as const;

export interface PointsLeft {
  races: number;
  sprints: number;
  /** Sprints already run, for "the sprints all run". */
  sprintsRun: number;
  /** The most a driver, and a team, can still score. */
  driver: number;
  team: number;
}

const sprintRun = (r: ResultRound | undefined): boolean => (r?.sessions ?? []).some(s => /^sprint$/i.test(s.label) && (s.tables[0]?.rows.length ?? 0) > 0);

/** The points still to be won. A Grand Prix counts as run once its result is stored (raceWins) and a sprint likewise,
 *  so on a sprint weekend's Saturday the sprint is run and the race is not; a round whose race is stored has run its
 *  sprint, whether or not the sprint's result arrived. */
export function pointsLeft(d: SeriesData): PointsLeft {
  const wins = raceWins(d);
  const stored = new Map((d.results ?? []).flatMap(r => (r.round === null ? [] : [[r.round, r] as const])));
  let races = 0;
  let sprints = 0;
  let sprintsRun = 0;
  for (const r of d.rounds ?? []) {
    if (!wins.has(r.round)) races++;
    if (!sprintWeekend(d, r.round, stored.get(r.round))) continue;
    if (wins.has(r.round) || sprintRun(stored.get(r.round))) sprintsRun++;
    else sprints++;
  }
  return { races, sprints, sprintsRun, driver: races * GP[0] + sprints * SPRINT[0], team: races * (GP[0] + GP[1]) + sprints * (SPRINT[0] + SPRINT[1]) };
}

interface Standing {
  pos: string;
  name: string;
  team: string;
  pts: number;
  /** The points as the table writes them. */
  shown: string;
}

function standingRows(t: Table | undefined, drivers: boolean): Standing[] {
  if (!t) return [];
  const posAt = col(t.columns, 'Pos');
  const nameAt = drivers ? col(t.columns, 'Driver', 'Rider') : col(t.columns, 'Constructor', 'Team', 'Manufacturer');
  const teamAt = drivers ? col(t.columns, 'Team') : nameAt;
  const ptsAt = col(t.columns, 'Pts', 'Points');
  if (nameAt < 0 || ptsAt < 0) return [];
  return t.rows.map(row => ({
    pos: (posAt >= 0 ? row[posAt] : '') ?? '',
    name: row[nameAt] ?? '',
    team: (teamAt >= 0 ? row[teamAt] : '') ?? '',
    pts: Number.parseFloat(row[ptsAt] ?? '') || 0,
    shown: row[ptsAt] ?? '',
  }));
}

/** The stored results the official table counts. The standings and the results are fetched apart, so the table can lag the
 *  results by a session: the last point in the running order where the points awarded so far equal the table's total marks
 *  what it counts, and the page is written as of there. When none does (a deduction outside any race), every result. */
function counted(d: SeriesData, drivers: Standing[]): SeriesData {
  const total = drivers.reduce((n, x) => n + x.pts, 0);
  const rounds = (d.results ?? []).filter(r => r.round !== null).sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  let sum = 0;
  let at: { round: number; sessions: number } | null = null;
  for (const r of rounds) {
    for (const [i, s] of r.sessions.entries()) {
      const t = s.tables[0];
      const ptsAt = t ? col(t.columns, 'Pts', 'Points') : -1;
      if (t && ptsAt >= 0) for (const row of t.rows) sum += Number.parseFloat(row[ptsAt] ?? '') || 0;
      if (Math.abs(sum - total) < 1e-6) at = { round: r.round ?? 0, sessions: i + 1 };
    }
  }
  if (!drivers.length || !at) return d;
  const { round, sessions } = at;
  return { ...d, results: (d.results ?? []).flatMap(r => (r.round === null || r.round < round ? [r] : r.round === round ? [{ ...r, sessions: r.sessions.slice(0, sessions) }] : [])) };
}

/** How many of a table, from the top, can still draw level with the leader on points: on paper, with no countback. */
export function stillIn(rows: readonly { pts: number }[], left: number): number {
  const lead = rows[0]?.pts ?? 0;
  const out = rows.findIndex(x => lead - x.pts > left);
  return out < 0 ? rows.length : out;
}

export interface Mate {
  name: string;
  points: number;
  rounds: number[];
}

export interface TeamSplit {
  team: string;
  /** The two race seats, the higher scorer first. */
  pair: Mate[];
  /** Anyone else who raced for the team: a stand-in. */
  also: Mate[];
  total: number;
}

/** Each team's points by the drivers who scored them for it, from every race and sprint stored, the teams in the
 *  constructors' order. The pair is the first two of the team's drivers in drivers.json who raced for it (its seats; a
 *  stand-in is listed after them, as Tsunoda is for his car number), else the two who raced for it most. */
export function teammates(d: SeriesData): TeamSplit[] {
  const by = new Map<string, { team: string; mates: Map<string, Mate> }>();
  for (const r of d.results ?? []) {
    if (r.round === null) continue;
    for (const s of r.sessions) {
      const t = s.tables[0];
      if (!t) continue;
      const nameAt = col(t.columns, 'Driver');
      const teamAt = col(t.columns, 'Team');
      const ptsAt = col(t.columns, 'Pts', 'Points');
      if (nameAt < 0 || teamAt < 0) continue;
      for (const row of t.rows) {
        const name = row[nameAt] ?? '';
        const team = row[teamAt] ?? '';
        if (!name || !plain(team)) continue;
        const entry = by.get(plain(team)) ?? { team, mates: new Map<string, Mate>() };
        const m = entry.mates.get(name) ?? { name, points: 0, rounds: [] };
        m.points += ptsAt >= 0 ? Number.parseFloat(row[ptsAt] ?? '') || 0 : 0;
        if (!m.rounds.includes(r.round)) m.rounds.push(r.round);
        entry.mates.set(name, m);
        by.set(plain(team), entry);
      }
    }
  }
  const drivers = standingRows(d.standings?.[0], true);
  const place = (name: string) => {
    const i = drivers.findIndex(x => x.name === name);
    return i < 0 ? drivers.length : i;
  };
  const order = standingRows(d.standings?.[1], false).map(x => plain(x.name));
  const keys = [...order.filter(k => by.has(k)), ...[...by.keys()].filter(k => !order.includes(k))];
  return keys.flatMap(key => {
    const entry = by.get(key);
    if (!entry) return [];
    const all = [...entry.mates.values()];
    const seats = (teamOf(d, entry.team)?.drivers ?? []).flatMap(x => all.filter(m => bare(m.name) === bare(x.name)));
    const most = [...all].sort((a, b) => b.rounds.length - a.rounds.length || b.points - a.points || place(a.name) - place(b.name));
    const pair = [...new Set([...seats, ...most])].slice(0, 2).sort((a, b) => b.points - a.points || place(a.name) - place(b.name));
    const also = all.filter(m => !pair.includes(m)).sort((a, b) => Math.min(...a.rounds) - Math.min(...b.rounds));
    return [{ team: entry.team, pair, also, total: all.reduce((n, m) => n + m.points, 0) }];
  });
}

/** A day as "11 October", or a weekday as "Sunday", at the track (its IANA zone; UTC when it is unknown or bad). */
function atTrack(iso: string, tz: string | undefined, part: 'day' | 'weekday'): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return '';
  const o: Intl.DateTimeFormatOptions = part === 'day' ? { day: 'numeric', month: 'long' } : { weekday: 'long' };
  try {
    return new Intl.DateTimeFormat('en-GB', { ...o, timeZone: tz || 'UTC' }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { ...o, timeZone: 'UTC' }).format(at);
  }
}
/** "11 October" for a stored YYYY-MM-DD; '' when it is not one. */
const longDay = (day: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(day) ? atTrack(`${day}T12:00:00Z`, 'UTC', 'day') : '');
const surname = (name: string): string => name.trim().split(/\s+/).pop() ?? '';
/** "A. Kimi Antonelli", the phone's name for "Andrea Kimi Antonelli". */
function initialled(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${Array.from(parts[0])[0]}. ${parts.slice(1).join(' ')}` : name;
}
const pointsText = (n: number): string => `${n} point${n === 1 ? '' : 's'}`;
const gapText = (n: number): string => (n > 0 ? `−${n}` : '0');
const inWords = (n: number): string => NUMBER_WORDS[n] ?? String(n);
const andList = (items: string[]): string => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : (items[0] ?? ''));

function roundsText(rounds: number[]): string {
  const r = [...rounds].sort((a, b) => a - b);
  if (r.length === 1) return `round ${r[0]}`;
  return r.every((x, i) => i === 0 || x === r[i - 1] + 1) ? `rounds ${r[0]} to ${r[r.length - 1]}` : `rounds ${andList(r.map(String))}`;
}

/** Each driver's change in points from the season's rulings, by surname as codeOf matches names. */
function marksOf(d: SeriesData): Map<string, number> {
  const out = new Map<string, number>();
  for (const n of d.standingsNotes ?? []) {
    for (const [name, delta] of Object.entries(n.drivers ?? {})) if (Number.isFinite(delta) && delta !== 0) out.set(bare(name), (out.get(bare(name)) ?? 0) + delta);
  }
  return out;
}

/** A source as a link named by its host ("fia.com"); only an https address is one. */
function sourceLink(src: string): string {
  try {
    const u = new URL(src);
    return u.protocol === 'https:' ? `<a href="${escapeHtml(u.href)}">${escapeHtml(u.hostname.replace(/^www\./, ''))}</a>` : '';
  } catch {
    return '';
  }
}

/** "Standings after round 17" and "Singapore Grand Prix, 11 October" with when the next points are scored, the line as
 *  markup. */
function standingsHead(d: SeriesData, wins: Map<number, RoundWin>, stored: Map<number, ResultRound>): { title: string; line: string } {
  const scored = [...stored.values()].filter(r => r.sessions.some(s => (s.tables[0]?.rows.length ?? 0) > 0)).sort((a, b) => (b.round ?? 0) - (a.round ?? 0))[0];
  if (!scored || scored.round === null) return { title: 'Standings', line: 'No race has run yet this season.' };
  const n = scored.round;
  const cr = d.rounds?.find(r => r.round === n);
  const name = escapeHtml(cr?.name ?? scored.name);
  const timed = (round: number, session: RegExp) => (d.calendar ?? []).find(e => e.round === round && !e.dateOnly && session.test(e.session));
  let title: string;
  let line: string;
  if (wins.has(n)) {
    title = `Standings after round ${n}`;
    line = [name, longDay(wins.get(n)?.date ?? cr?.endDate ?? '')].filter(Boolean).join(', ');
  } else {
    const sprint = timed(n, /^sprint$/i);
    title = `Standings after the round ${n} sprint`;
    line = [`${name} sprint`, sprint ? atTrack(sprint.start, cr?.tz, 'day') : ''].filter(Boolean).join(', ');
  }
  // The next points: a sprint weekend's sprint while it is still to run, else the round's Grand Prix.
  const next = (d.rounds ?? []).find(r => !wins.has(r.round));
  if (next) {
    const sprint = sprintWeekend(d, next.round, stored.get(next.round)) && !sprintRun(stored.get(next.round));
    const at = timed(next.round, sprint ? /^sprint$/i : /^race$/i);
    const day = at ? atTrack(at.start, next.tz, 'weekday') : '';
    if (day) line += `<span class="pd-st-next"> · next update after ${day}'s ${escapeHtml(next.name)}${sprint ? ' sprint' : ''}</span>`;
  }
  return { title, line };
}

/** /series/<slug>/standings/: the drivers and Who can still win it beside the constructors, then the teammates. The band
 *  counts every stored result, as on the series' other pages; the rest is written as of what the table counts. */
export function seriesStandings(d: SeriesData): Page {
  const all = raceWins(d);
  const current = (d.rounds ?? []).find(r => !all.has(r.round));
  const drivers = standingRows(d.standings?.[0], true);
  const teams = standingRows(d.standings?.[1], false);
  const asOf = counted(d, drivers);
  const wins = raceWins(asOf);
  const stored = new Map((asOf.results ?? []).flatMap(r => (r.round === null ? [] : [[r.round, r] as const])));
  const left = pointsLeft(asOf);
  const head = standingsHead(asOf, wins, stored);
  const marks = marksOf(d);
  const lead = drivers[0]?.pts ?? 0;
  // Without the season's rounds the points left are unknown: no line, and no one named in or out.
  const known = (d.rounds ?? []).length > 0;
  const inIt = known ? stillIn(drivers, left.driver) : drivers.length;
  const cut = inIt > 0 && inIt < drivers.length ? inIt - 1 : -1;

  // WordPress keeps no aria-pressed in a page; the script sets it with the view.
  const seg = teams.length
    ? '<div class="pd-st-seg" role="group" aria-label="Show" hidden><button type="button" data-pd-st="drivers">Drivers</button>' +
      '<button type="button" data-pd-st="constructors">Constructors</button><button type="button" class="both" data-pd-st="both">Both</button></div>'
    : '';
  const top = `<div class="pd-st-head"><div><h2 class="pd-st-h">${escapeHtml(head.title)}</h2><p>${head.line}</p></div>${seg}</div>`;

  const driverRows = drivers
    .map((x, i) => {
      const cls = [i === 0 ? 'lead' : '', i === cut ? 'cut' : ''].filter(Boolean).join(' ');
      const width = lead > 0 ? Math.max(0, Math.min(100, (x.pts / lead) * 100)).toFixed(1) : '0.0';
      const mark = marks.get(bare(x.name));
      const sup = mark ? `<sup>${mark > 0 ? '+' : '−'}${Math.abs(mark)}</sup>` : '';
      const n = driverWins(wins, x.name);
      return (
        `<li${cls ? ` class="${cls}"` : ''} style="--t:${colourOf(d, x.team)}"><span class="p">${escapeHtml(x.pos)}</span><i class="tb"></i>` +
        `<span class="d"><b><span class="fn">${escapeHtml(x.name)}</span><span class="sn">${escapeHtml(initialled(x.name))}</span>${sup}</b><small>${escapeHtml(teamLabel(x.team))}</small></span>` +
        `<i class="bar"><i style="width:${width}%"></i></i><span class="pt">${escapeHtml(x.shown)}</span><span class="g">${i === 0 ? '—' : gapText(lead - x.pts)}</span><span class="w">${n || ''}</span></li>`
      );
    })
    .join('');

  // The line under the drivers: the season's rulings with their sources, the dashed line, and every driver whose total
  // holds points scored for a team other than the one the table names.
  const splits = teammates(asOf);
  const notes = (d.standingsNotes ?? []).filter(n => Object.keys(n.drivers ?? {}).some(k => drivers.some(x => bare(x.name) === bare(k))));
  const foot = [
    notes.length
      ? `Small numbers next to a name: points changed ${notes
          .map(n => {
            const links = (n.sources ?? []).map(sourceLink).filter(Boolean);
            const on = longDay(n.decided);
            return `when ${escapeHtml(n.note)}${on ? ` on ${on}` : ''}${links.length ? ` (${links.join(', ')})` : ''}`;
          })
          .join(', and ')}.`
      : '',
    cut >= 0 ? 'The dashed line marks the last driver who can still mathematically win.' : '',
    ...drivers.flatMap(x =>
      splits
        .filter(s => plain(x.team) !== '' && plain(s.team) !== plain(x.team))
        .flatMap(s => [...s.pair, ...s.also].filter(m => m.name === x.name && m.points > 0).map(m => `${escapeHtml(surname(x.name))}'s ${escapeHtml(x.shown)} include ${m.points} for ${escapeHtml(teamLabel(s.team))}, in ${roundsText(m.rounds)}.`)),
    ),
  ].filter(Boolean);
  const leftCol = drivers.length
    ? `<div class="pd-st-left"><div class="pd-st-th"><span>Pos</span><span></span><span>Driver</span><span></span><span>Pts</span><span>Gap</span><span>Wins</span></div><ol class="pd-st-tbl">${driverRows}</ol>` +
      `${foot.length ? `<p class="pd-st-foot">${foot.join(' ')}</p>` : ''}</div>`
    : '<div class="pd-st-left"><p class="pd-mut">No standings yet this season.</p></div>';

  // Who can still win it: the leader, everyone who can still draw level, and the first driver who cannot.
  let who = '';
  if (drivers.length && known) {
    const bar = (gap: number) => (left.driver > 0 ? Math.min(100, (gap / left.driver) * 100) : gap > 0 ? 100 : 0).toFixed(1);
    const out = drivers[inIt];
    const items = [
      `<li class="ld" style="--t:${colourOf(d, drivers[0].team)}"><b>${escapeHtml(surname(drivers[0].name))}</b><span class="lab">Leader</span><span class="v">${escapeHtml(drivers[0].shown)}</span></li>`,
      ...drivers.slice(1, inIt).map(x => `<li style="--t:${colourOf(d, x.team)}"><b>${escapeHtml(surname(x.name))}</b><i class="wb"><i style="width:${bar(lead - x.pts)}%"></i></i><span class="v">${gapText(lead - x.pts)}</span></li>`),
      out ? `<li class="out" style="--t:${colourOf(d, out.team)}"><b>${escapeHtml(surname(out.name))}</b><i class="wb"><i style="width:100.0%"></i></i><span class="v">${gapText(lead - out.pts)}</span></li>` : '',
    ].join('');
    const scales = [
      left.races ? `${inWords(left.races).toLowerCase()} Grand${left.races === 1 ? '' : 's'} Prix at ${GP[0]}` : '',
      left.sprints ? `${inWords(left.sprints).toLowerCase()} sprint${left.sprints === 1 ? '' : 's'} at ${SPRINT[0]}` : left.sprintsRun ? 'the sprints all run' : '',
    ].filter(Boolean);
    const intro = left.driver > 0 ? `${left.driver} points left: ${scales.join(', ')}. A bar is how much of that a driver needs just to draw level.` : 'No points left: the season is over.';
    const alive = teams.slice(1, stillIn(teams, left.team)).map(x => escapeHtml(teamLabel(x.name)));
    const sum = [
      inIt > 1 ? `${inWords(inIt)} drivers are still in it on paper.` : `Only ${escapeHtml(surname(drivers[0].name))} can still win it.`,
      out ? `${escapeHtml(surname(out.name))} is out by ${pointsText(lead - out.pts - left.driver)}.` : '',
      teams.length ? `Constructors: ${left.team} left, ${alive.length ? `so ${andList(alive)} ${alive.length === 1 ? 'is' : 'are'} still alive` : `so only ${escapeHtml(teamLabel(teams[0].name))} can still win it`}.` : '',
    ].filter(Boolean);
    who = `<section class="pd-st-who"><h3>Who can still win it</h3><p>${intro}</p><ol>${items}</ol><p class="pd-st-sum">${sum.join(' ')}</p></section>`;
  }

  const teamLead = teams[0]?.pts ?? 0;
  const cons = teams.length
    ? `<div class="pd-st-cons"><h3 class="pd-st-ch">Constructors</h3><div class="pd-st-th c"><span>Pos</span><span></span><span>Constructor</span><span>Pts</span><span>Gap</span><span>Wins</span></div><ol class="pd-st-tbl c">` +
      teams
        .map((x, i) => {
          const n = teamWins(wins, x.name);
          return (
            `<li${i === 0 ? ' class="lead"' : ''} style="--t:${colourOf(d, x.name)}"><span class="p">${escapeHtml(x.pos)}</span><i class="tb"></i><span class="d"><b>${escapeHtml(teamLabel(x.name))}</b></span>` +
            `<span class="pt">${escapeHtml(x.shown)}</span><span class="g">${i === 0 ? '—' : gapText(teamLead - x.pts)}</span><span class="w">${n || ''}</span></li>`
          );
        })
        .join('') +
      '</ol></div>'
    : '';

  const mates = splits.length
    ? `<section class="pd-sr-sec pd-st-mates"><div class="pd-sh"><h2>Teammates</h2><p>Points split inside each team</p></div><div class="pd-st-grid">${splits
        .map(s => {
          const [a, b] = s.pair;
          const width = s.total > 0 && a ? ((a.points / s.total) * 100).toFixed(1) : '0.0';
          const line = (m: Mate | undefined, k: 'a' | 'b') => (m ? `<p class="${k}"><b>${escapeHtml(surname(m.name))}</b><span>${m.points}</span></p>` : '');
          const also = s.also.map(m => `<p class="c">Also ${escapeHtml(surname(m.name))}: ${pointsText(m.points)} in ${roundsText(m.rounds)}</p>`).join('');
          const name = teams.find(x => plain(x.name) === plain(s.team))?.name ?? s.team;
          return `<article class="pd-st-mate" style="--t:${colourOf(d, s.team)}"><h3>${escapeHtml(teamLabel(name))}</h3>${line(a, 'a')}<i class="split"><i style="width:${width}%"></i></i>${line(b, 'b')}${also}</article>`;
        })
        .join('')}</div></section>`
    : '';

  const main =
    `<div class="pd-sr pd-s-${escapeHtml(d.slug)}">${band(d, all, current)}${tabs(d, 'standings')}<div class="pd-sr-main">` +
    `<section class="pd-sr-sec pd-stp">${top}<div class="pd-st-cols">${leftCol}<div class="pd-st-right">${who}${cons}</div></div></section>${mates}</div></div>`;
  return { path: seriesPath(d.slug, 'standings'), title: `${d.name} standings`, body: htmlBlock(main), template: 'page-wide' };
}

// ── Champions (O17) ──────────────────────────────────────────────────────────
//
// /series/<slug>/champions/, as approved on The Paddock Drafts (21 Oct): the reigning champion in the team's colour, the
// jump bar with the search, a table a decade (cards on a phone), the row where the teams' title begins, the team tallies,
// the three records and the doorways. Every figure is champions.json's, points as counted at the time; a margin is derived,
// never stored. The script adds the search and shows a phone one decade at a time; without it every decade stands.

const ORDINAL_WORDS = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];

/** 1st, 2nd, 3rd, 4th; 11th to 13th. */
export const ordinal = (n: number): string => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
const nthWord = (n: number): string => ORDINAL_WORDS[n] ?? ordinal(n);
const article = (word: string): string => (/^(?:[aeiou]|8|11|18)/i.test(word) ? 'an' : 'a');
const seasonsText = (n: number): string => `${n} season${n === 1 ? '' : 's'}`;
/** Lower case without accents, so the search finds Räikkönen typed as "raikkonen" (the script folds the query alike). */
const fold = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** The pages a doorway may link beyond a series' own; any other stays greyed, "Coming", until it is listed (the operator,
 *  23 Oct). A series page counts once BUILT holds it. */
const LIVE_PAGES: ReadonlySet<string> = new Set(['/calendar/', '/series/', '/about/']);
function isLive(href: string): boolean {
  const m = /^\/series\/([^/]+)\/(standings|results|champions)\/$/.exec(href);
  return LIVE_PAGES.has(href) || (m !== null && built(m[1], m[2] as 'standings' | 'results' | 'champions'));
}

/** A season's team as champions.json writes it. `constructor` is checked as a string: a row without one would otherwise
 *  read Object's own constructor. */
const teamIn = (s: Champion): string => (typeof s.constructor === 'string' ? s.constructor : '');
const marginOf = (s: Champion): number | null => (typeof s.points === 'number' && typeof s.runnerUpPoints === 'number' ? s.points - s.runnerUpPoints : null);

/** A champion's team colour: the roster's; then the roster's under team-names.json's newest season, for a name the feeds
 *  wrote differently ("Red Bull" for Red Bull Racing); then the heritage colour of a team no longer racing; else grey. */
export function championColour(d: SeriesData, team: string): string {
  const own = teamOf(d, team)?.colour;
  if (own && HEX.test(own)) return own;
  const names = d.champions?.names ?? {};
  const newest = Object.keys(names).filter(k => /^\d{4}$/.test(k)).sort().pop();
  const lines = newest ? names[newest] : undefined;
  const alias = lines && typeof lines === 'object' ? lines[team] : undefined;
  const aliased = alias ? teamOf(d, alias)?.colour : undefined;
  if (aliased && HEX.test(aliased)) return aliased;
  const old = d.champions?.historic[slugify(team)]?.color;
  return old && HEX.test(old) ? old : NEUTRAL;
}

/** Dark enough that the reigning card's text turns light (WCAG relative luminance under 0.18). */
function darkColour(hex: string): boolean {
  const h = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : hex;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.18;
}

export interface TitleMarks {
  /** The driver's nth drivers' title, counted from the first season. */
  nth: number;
  /** The constructors' champion's nth title; null before the teams' title began. */
  teamNth: number | null;
}

/** Each season's ×n and its constructors' champion's nth title, counted in season order. */
export function titleCounts(seasons: readonly Champion[]): Map<number, TitleMarks> {
  const drivers = new Map<string, number>();
  const teams = new Map<string, number>();
  const out = new Map<number, TitleMarks>();
  for (const s of [...seasons].sort((a, b) => a.year - b.year)) {
    const nth = (drivers.get(s.driver) ?? 0) + 1;
    drivers.set(s.driver, nth);
    let teamNth: number | null = null;
    if (s.constructorChampion) {
      teamNth = (teams.get(s.constructorChampion) ?? 0) + 1;
      teams.set(s.constructorChampion, teamNth);
    }
    out.set(s.year, { nth, teamNth });
  }
  return out;
}

/** The teams by titles won, drivers' (by the champion's team) or constructors'; level teams in the order they reached it. */
export function teamTallies(seasons: readonly Champion[], kind: 'drivers' | 'constructors'): { name: string; count: number }[] {
  const by = new Map<string, { count: number; last: number }>();
  for (const s of [...seasons].sort((a, b) => a.year - b.year)) {
    const team = kind === 'drivers' ? teamIn(s) : (s.constructorChampion ?? '');
    if (!team) continue;
    by.set(team, { count: (by.get(team)?.count ?? 0) + 1, last: s.year });
  }
  return [...by]
    .sort((a, b) => b[1].count - a[1].count || a[1].last - b[1].last || a[0].localeCompare(b[0]))
    .map(([name, t]) => ({ name, count: t.count }));
}

/** The three records: the most drivers' titles (the top five and everyone level with the fifth, in the order they reached
 *  the count), and the five closest and the five biggest title margins, level margins newest first. */
export function recordLists(seasons: readonly Champion[]): { most: { name: string; titles: Champion[] }[]; closest: Champion[]; biggest: Champion[] } {
  const by = new Map<string, Champion[]>();
  for (const s of [...seasons].sort((a, b) => a.year - b.year)) by.set(s.driver, [...(by.get(s.driver) ?? []), s]);
  const ranked = [...by]
    .map(([name, titles]) => ({ name, titles }))
    .sort((a, b) => b.titles.length - a.titles.length || a.titles[a.titles.length - 1].year - b.titles[b.titles.length - 1].year);
  const fifth = ranked[4]?.titles.length ?? 0;
  const margins = seasons.flatMap(s => {
    const m = marginOf(s);
    return m === null ? [] : [{ s, m }];
  });
  const pick = (sign: 1 | -1) => [...margins].sort((a, b) => sign * (a.m - b.m) || b.s.year - a.s.year).slice(0, 5).map(x => x.s);
  return { most: ranked.filter((x, i) => i < 5 || x.titles.length === fifth), closest: pick(1), biggest: pick(-1) };
}

/** A note's first sentence: up to the first full stop, ! or ? after a word (not an initial) that a capital follows. */
export function firstSentence(text: string): string {
  const t = text.trim();
  const m = /^([\s\S]*?[a-z0-9)’'”"][.!?])\s+(?=[A-Z‘“"'])/.exec(t);
  return m ? m[1] : t;
}

function reigningCard(d: SeriesData, s: Champion, marks: Map<number, TitleMarks>, seasons: readonly Champion[]): string {
  const team = teamIn(s);
  const colour = championColour(d, team);
  const m = marginOf(s);
  const tiles = [
    typeof s.points === 'number' ? `<span><b>${s.points}</b>Points</span>` : '',
    typeof s.wins === 'number' ? `<span><b>${s.wins}</b>Wins</span>` : '',
    m !== null && s.runnerUp ? `<span><b>+${m}</b>Over ${escapeHtml(surname(s.runnerUp))}</span>` : '',
  ].join('');
  const chips = `${team ? `<b>${escapeHtml(team)}</b>` : ''}<b>${nthWord(marks.get(s.year)?.nth ?? 1)} title</b>`;
  let teams = '';
  if (s.constructorChampion) {
    let streak = 1;
    while (seasons.find(x => x.year === s.year - streak)?.constructorChampion === s.constructorChampion) streak++;
    const word = streak > 1 ? nthWord(streak).toLowerCase() : '';
    const which = streak > 1 ? `${article(word)} ${word} title in a row` : `its ${ordinal(marks.get(s.year)?.teamNth ?? 1)} title`;
    teams = `Teams' champion: <b>${escapeHtml(s.constructorChampion)}</b>, ${which}.`;
  }
  const note = d.champions?.notes?.[String(s.year)]?.note;
  const txt = [teams, note ? escapeHtml(firstSentence(note)) : ''].filter(Boolean).join(' ');
  const season = d.season;
  // The champion's own season's title race once it has a page (O29); until then this season's Standings.
  const button = titleRacesOf(d).some(t => t.season === s.year)
    ? `<div class="pd-ch-acts"><a href="${seasonPath(d.slug, s.year)}">${s.year} title race →</a></div>`
    : typeof season === 'number' && built(d.slug, 'standings')
      ? `<div class="pd-ch-acts"><a href="${seriesPath(d.slug, 'standings')}">${season} ${s.year >= season ? 'final standings' : 'title race'} →</a></div>`
      : '';
  return (
    `<section class="pd-ch-reign${darkColour(colour) ? ' is-dark' : ''}" style="--t:${colour}"><div class="pd-ch-rin">` +
    `<p class="pd-ch-lab"><span>Reigning champion</span> ${s.year} season</p><h3>${escapeHtml(s.driver)}</h3><p class="pd-ch-sub">${chips}</p>` +
    `${tiles ? `<div class="pd-ch-tiles">${tiles}</div>` : ''}${txt ? `<p class="pd-ch-txt">${txt}</p>` : ''}</div>` +
    `${button}<i class="pd-ch-big" aria-hidden="true">${s.year}</i></section>`
  );
}

/** A doorway to another page; one whose page does not exist yet is greyed, with no link. */
function door(href: string, label: string, title: string, line: string, live: boolean): string {
  const inner = `<small>${escapeHtml(label)}</small><b>${escapeHtml(title)}</b><span>${line}</span>`;
  return live ? `<a class="pd-ch-door" href="${escapeHtml(href)}">${inner}<em>Open →</em></a>` : `<span class="pd-ch-door is-off">${inner}<em>Coming</em></span>`;
}

/** /series/<slug>/champions/: the roll of honour. */
export function seriesChampions(d: SeriesData): Page {
  const all = raceWins(d);
  const current = (d.rounds ?? []).find(r => !all.has(r.round));
  const path = seriesPath(d.slug, 'champions');
  const title = `${d.name} champions`;
  const frame = (inner: string) => htmlBlock(`<div class="pd-sr pd-s-${escapeHtml(d.slug)}">${band(d, all, current)}${tabs(d, 'champions')}<div class="pd-sr-main">${inner}</div></div>`);
  const seasons = [...(d.champions?.seasons ?? [])].sort((a, b) => b.year - a.year);
  if (!seasons.length) return { path, title, body: frame('<section class="pd-sr-sec pd-chp"><p class="pd-mut">No champions recorded yet.</p></section>'), template: 'page-wide' };

  const marks = titleCounts(seasons);
  const first = seasons[seasons.length - 1].year;
  const firstTeams = [...seasons].reverse().find(s => s.constructorChampion)?.year;
  const name = escapeHtml(d.name);
  const champs = new Set(seasons.map(s => s.driver)).size;
  const mast =
    `<header class="pd-ch-mast"><p class="pd-ch-kick">${name} · Roll of honour</p><h2 class="pd-ch-h">${name} champions</h2>` +
    `<p class="pd-ch-intro">Every drivers' champion since ${first}${firstTeams ? ` and every constructors' champion since ${firstTeams}` : ''}, year by year: ` +
    `${seasonsText(seasons.length)}, ${champs} different driver${champs === 1 ? '' : 's'}.</p></header>`;

  const decade = (y: number) => Math.floor(y / 10) * 10;
  const decades = [...new Set(seasons.map(s => decade(s.year)))];
  const jump =
    `<nav class="pd-ch-jump" aria-label="Jump to"><span class="lab">Jump to</span>` +
    decades.map((x, i) => `<a href="#pd-ch-${x}s" data-dec="${x}s"${i === 0 ? ' class="on"' : ''}>${x}s</a>`).join('') +
    (firstTeams ? `<a href="#pd-ch-${firstTeams}" data-dec="${decade(firstTeams)}s">${firstTeams}: teams' title</a>` : '') +
    `<span class="pd-ch-find" hidden></span><span class="pd-ch-count" data-of="${seasons.length}">${seasonsText(seasons.length)}</span></nav>`;
  const decs = decades
    .map(x => {
      const list = seasons.filter(s => decade(s.year) === x);
      const rows: string[] = [];
      const cards: string[] = [];
      for (const s of list) {
        const team = teamIn(s);
        const colour = championColour(d, team);
        const mk = marks.get(s.year);
        const sup = mk && mk.nth > 1 ? `<sup>×${mk.nth}</sup>` : '';
        const m = marginOf(s);
        const close = m !== null && m <= 5;
        const margin = m === null ? '' : `+${m}`;
        const find = escapeHtml(fold([s.year, s.driver, team, s.runnerUp, s.constructorChampion].filter(Boolean).join(' ')));
        const teamsCell = s.constructorChampion ? `<b>${escapeHtml(s.constructorChampion)}</b><small>${ordinal(mk?.teamNth ?? 1)} title</small>` : '<small>—</small>';
        rows.push(
          `<tr data-find="${find}"><td class="yr">${s.year}</td><td class="ch"><i class="tb" style="--t:${colour}"></i><b>${escapeHtml(s.driver)}${sup}</b><small>${escapeHtml(team)}</small></td>` +
            `<td class="pt">${s.points ?? ''}</td><td class="w">${s.wins ?? ''}</td><td class="mg${close ? ' close' : ''}">${margin}</td>` +
            `<td class="ru">${s.runnerUp ? `<b>${escapeHtml(s.runnerUp)}</b>${typeof s.runnerUpPoints === 'number' ? `<small>${s.runnerUpPoints} pts</small>` : ''}` : ''}</td><td class="tc">${teamsCell}</td></tr>`,
        );
        const facts = [typeof s.points === 'number' ? `${s.points} pts` : '', typeof s.wins === 'number' ? `${s.wins} win${s.wins === 1 ? '' : 's'}` : '', margin].filter(Boolean).join(' · ');
        cards.push(
          `<li data-find="${find}"><p class="top"><b class="yr">${s.year}</b><span${close ? ' class="close"' : ''}>${facts}</span></p>` +
            `<p class="nm" style="--t:${colour}"><b>${escapeHtml(s.driver)}${sup}</b><small>${escapeHtml(team)}</small></p>` +
            (s.runnerUp ? `<p class="kv"><span>Runner-up</span><span><b>${escapeHtml(s.runnerUp)}</b>${typeof s.runnerUpPoints === 'number' ? ` · ${s.runnerUpPoints} pts` : ''}</span></p>` : '') +
            (s.constructorChampion ? `<p class="kv"><span>Teams'</span><span><b>${escapeHtml(s.constructorChampion)}</b> · ${ordinal(mk?.teamNth ?? 1)} title</span></p>` : '') +
            '</li>',
        );
        if (s.year === firstTeams) {
          rows.push(`<tr class="era" id="pd-ch-${firstTeams}"><td colspan="7"><b>${firstTeams}</b> The constructors' championship begins: from here the last column names the teams' champion.</td></tr>`);
        }
      }
      return (
        `<section class="pd-ch-dec" id="pd-ch-${x}s" data-dec="${x}s"><h2>${x}s <small>${list.length} season${list.length === 1 ? '' : 's'}</small></h2>` +
        `<table class="pd-ch-tbl"><thead><tr><th>Year</th><th>Champion</th><th>Pts</th><th>Wins</th><th>Margin</th><th>Runner-up</th><th>Constructors' champion</th></tr></thead>` +
        `<tbody>${rows.join('')}</tbody></table><ol class="pd-ch-cards">${cards.join('')}</ol></section>`
      );
    })
    .join('');
  const foot =
    '<p class="pd-ch-foot">Points as counted at the time: until 1990 only a driver\'s best results counted towards the title, and races stopped early paid half points (hence Lauda\'s 0.5 in 1984). ×2, ×3: the driver\'s second, third title. Orange margin: five points or fewer.</p>';

  const squares = (colours: string[]) => `<span class="sq">${colours.map(c => `<i style="--t:${c}"></i>`).join('')}</span>`;
  const tally = (heading: string, list: { name: string; count: number }[]) =>
    `<div class="pd-ch-tally"><h3>${heading}</h3><ol>${list
      .slice(0, 5)
      .map(t => `<li><b>${escapeHtml(t.name)}</b>${squares(Array(t.count).fill(championColour(d, t.name)))}<span class="n">${t.count}</span></li>`)
      .join('')}</ol>${list.length > 5 ? `<p class="more">+ ${list.length - 5} more teams</p>` : ''}</div>`;
  const teamsSec =
    `<section class="pd-ch-teams"><h2>Most successful teams</h2><p class="pd-mut">Drivers' titles since ${first}, counted by the champion's team${firstTeams ? `; constructors' titles since ${firstTeams}` : ''}.</p>` +
    `<div class="pd-ch-two">${tally("Drivers' titles", teamTallies(seasons, 'drivers'))}${firstTeams ? tally("Constructors' titles", teamTallies(seasons, 'constructors')) : ''}</div></section>`;

  const rec = recordLists(seasons);
  const lead = d.champions?.records?.drivers?.lead?.trim();
  const fights = (heading: string, list: Champion[]) =>
    `<div class="pd-ch-rec"><h3>${heading}</h3><ol class="pd-ch-fights">${list
      .map(s => `<li><span class="yr">${s.year}</span><span class="who"><b>${escapeHtml(surname(s.driver))}</b> <small>over ${escapeHtml(surname(s.runnerUp ?? ''))}</small></span><span class="n">${marginOf(s)}</span></li>`)
      .join('')}</ol></div>`;
  const recs =
    `<section class="pd-ch-recs"><div class="pd-ch-rec"><h3>Most drivers' titles</h3><ol>${rec.most
      .map(x => `<li><b>${escapeHtml(x.name)}</b>${squares(x.titles.map(s => championColour(d, teamIn(s))))}<span class="n">${x.titles.length}</span></li>`)
      .join('')}</ol><blockquote>${lead ? `<b>${escapeHtml(/[.!?]$/.test(lead) ? lead : `${lead}.`)}</b> ` : ''}One square per title, in that season's team colour.</blockquote></div>` +
    `${fights('Closest title fights', rec.closest)}${fights('Biggest winning margins', rec.biggest)}</section>`;

  // The doorways' lines come from the data at publish time.
  const drivers = standingRows(d.standings?.[0], true);
  const left = pointsLeft(counted(d, drivers)).driver;
  const rounds = (d.rounds ?? []).length;
  let standLine = 'Both tables, and who can still win it.';
  if (drivers.length > 1) {
    const gap = drivers[0].pts - drivers[1].pts;
    standLine =
      gap > 0
        ? `${escapeHtml(surname(drivers[0].name))} leads by ${gap}${rounds && left > 0 ? ` with ${left} points left` : ''}.`
        : `${escapeHtml(surname(drivers[0].name))} and ${escapeHtml(surname(drivers[1].name))} are level on ${escapeHtml(drivers[0].shown)}.`;
  }
  const category = `/category/${categorySlug(d.name)}/`;
  const more = [
    door(seriesPath(d.slug), seriesPath(d.slug), d.name, `The season at a glance: next race, last race${rounds > 1 ? `, all ${rounds} rounds` : ''}.`, true),
    built(d.slug, 'standings') ? door(seriesPath(d.slug, 'standings'), seriesPath(d.slug, 'standings'), `${d.name} standings`, standLine, true) : '',
    built(d.slug, 'results') ? door(seriesPath(d.slug, 'results'), seriesPath(d.slug, 'results'), `${d.name} results`, "Every round's weekend, session by session.", true) : '',
    door(`/calendar/#${d.slug}`, `/calendar/#${d.slug}`, `${d.name} on the calendar`, 'Every session in your own time zone.', true),
    door(category, 'From the blog', `${d.name} posts`, 'Our race reports and analysis, newest first.', true),
  ].join('');
  // Around the site, as the operator chose it on 21 Oct; a page the new site does not have yet waits greyed.
  const around = [
    ['/calendar/', 'Calendar', 'Every session of fifteen championships in your time zone.'],
    ['/series/', 'All series', 'Fifteen championships, each with its next event.'],
    ['/series/f2/champions/', 'Formula 2 champions', 'Since 2005, including the GP2 years.'],
    ['/learn/', 'Learn', 'Motorsport, explained.'],
    ['/news/', 'News', 'Our stories, then the wire.'],
    ['/about/', 'About', 'Who makes Paddock, and how.'],
  ]
    .map(([href, label, line]) => door(href, href, label, line, isLive(href)))
    .join('');
  const doors =
    `<section class="pd-ch-more"><h2>More ${name}</h2><div class="pd-ch-doors">${more}</div></section>` +
    `<section class="pd-ch-more pd-ch-around"><h2>Around the site</h2><div class="pd-ch-doors">${around}</div></section>`;
  const call =
    `<section class="pd-ch-call"><div><b>Every ${escapeHtml(d.short ?? d.name)} session in your time zone</b><span>Follow the ${typeof d.season === 'number' ? `${d.season} ` : ''}season on the calendar. No account needed.</span></div>` +
    `<a href="/calendar/#${escapeHtml(d.slug)}">Open calendar</a></section>`;

  const inner = `<div class="pd-sr-sec pd-chp">${mast}${reigningCard(d, seasons[0], marks, seasons)}${jump}<div class="pd-ch-decs">${decs}</div>${foot}${teamsSec}${recs}${doors}${call}</div>`;
  return { path, title, body: frame(inner), template: 'page-wide' };
}

// ── The title race (O29) ─────────────────────────────────────────────────────
//
// /series/<slug>/<season>/ for a finished season with a title-race file (lib/series-content.ts loadTitleRaces), as drafted
// on Paddock 2025 Title Race (version 5) and answered on 25 Oct: a band naming the page that leads with the champion,
// then the margin (the page's subject outranks the series' frame); the final three; the points behind the leader round
// by round, drawn by the theme's script from data-pd-race, the same numbers as a table without it; the turning points;
// the decider; More Formula 1. Only the words are the file's own; every figure is its rounds' or champions.json's.

/** The title races with a page here: every finished season's but the current one, whose address is its weekends'
 *  season page (O19). */
const titleRacesOf = (d: SeriesData): TitleRaceFile[] => (d.titleRaces ?? []).filter(t => t.season !== d.season);

/** A name in data-pd-race, without its separators. */
const raceText = (s: string): string => s.replace(/[|;~]/g, ' ').trim();

export function seriesTitleRace(d: SeriesData, t: TitleRaceFile): Page {
  const n = t.rounds.length;
  const three = t.drivers;
  const seasons = d.champions?.seasons ?? [];
  const champ = seasons.find(s => s.year === t.season);
  const colour = (team: string) => championColour(d, team);
  const tick = (team: string) => `<i class="pd-tc" style="--t:${colour(team)}"></i>`;
  const winsTo = (name: string, round: number) => t.rounds.filter(r => r.round <= round && r.winner === name).length;
  // The three after the i-th round by points, level ones by wins so far, the standings' first tie-break.
  const ranked = (i: number) =>
    three.map((x, k) => ({ x, k, pts: x.points[i], wins: winsTo(x.name, t.rounds[i].round) })).sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.k - b.k);
  // A teammate drawn after another of his team's is dashed, as on the lap chart.
  const dashed = (k: number) => three.slice(0, k).some(y => plain(y.team) === plain(three[k].team));
  const name = escapeHtml(d.name);

  const winner = champ?.driver ?? three[0].name;
  const winnerTeam = champ ? teamIn(champ) : three[0].team;
  const pts = champ?.points ?? three[0].points[n - 1];
  const runnerUp = champ?.runnerUp ?? three[1].name;
  const runnerPts = champ?.runnerUpPoints ?? three[1].points[n - 1];
  const nth = titleCounts(seasons).get(t.season)?.nth ?? 1;
  const panel =
    `<div class="pd-tr-champ"><p class="lab">${t.season} champion</p><p class="name">${escapeHtml(winner)}</p>` +
    `<p class="team">${winnerTeam ? `${escapeHtml(winnerTeam)} · ` : ''}his ${nthWord(nth).toLowerCase()} title</p>` +
    (typeof pts === 'number' && typeof runnerPts === 'number'
      ? `<p class="by">by <b>${pointsText(pts - runnerPts)}</b></p><p class="who">${pts} to ${escapeHtml(runnerUp)}&#39;s ${runnerPts}</p>`
      : '') +
    '</div>';
  // A dark team colour (as the reigning card's is-dark) turns the panel's label white: navy reads poorly on black.
  const band =
    `<section class="pd-tr-band${darkColour(colour(winnerTeam)) ? ' is-dark' : ''}" style="--t:${colour(winnerTeam)}"><div class="pd-tr-band-in"><div class="pd-tr-ttl"><p class="pd-tr-kick">${name} · ${t.season} season</p>` +
    `<h1>The ${t.season} title race</h1>${t.intro ? `<p class="pd-tr-intro">${escapeHtml(t.intro)}</p>` : ''}</div>${panel}` +
    `<div class="pd-sr-acts"><button type="button" class="pd-sr-follow" data-pd-follow="${escapeHtml(d.slug)}" hidden>Follow</button><a class="pd-sr-emails" href="/subscribe/">Session emails</a></div></div></section>`;

  const last = t.rounds[n - 1];
  const finalThree =
    `<ol class="pd-tr-three" aria-label="Final standings">${three
      .map((x, k) => {
        const total = x.points[n - 1];
        const led = t.rounds.filter(r => r.leader === x.name).length;
        return (
          `<li${k === 0 ? ' class="lead"' : ''} style="--t:${colour(x.team)}"><span class="p">${k + 1}</span><span class="nm"><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.team)}</small></span>` +
          `<span class="pts"><b>${total}</b>${last.lead - total > 0 ? `<small class="gap">${pointsText(last.lead - total)} behind</small>` : '<small>points</small>'}</span>` +
          `<span class="ex"><b>${winsLabel(winsTo(x.name, last.round))}</b> · ${led ? `led after ${led} round${led === 1 ? '' : 's'}` : 'never led'}</span></li>`
        );
      })
      .join('')}</ol>`;

  // data-pd-race: the rounds; the turning points' rounds; each driver (code, surname, colour, dashed, his total after
  // each round); each round (short name, day, winner, its leader as one of the three or by name, the leader's points).
  const turns = (t.turns ?? []).filter(x => t.rounds.some(r => r.round === x.round)).sort((a, b) => a.round - b.round);
  const data = [
    String(n),
    turns.map(x => x.round).join(' '),
    // Commas, not dots: a half point (2021's Belgian Grand Prix) must not split a total.
    three.map((x, k) => [raceText(x.code), raceText(surname(x.name)), colour(x.team), dashed(k) ? 1 : 0, x.points.join(',')].join('~')).join(';'),
    t.rounds
      .map(r => {
        const k = three.findIndex(x => x.name === r.leader);
        return [raceText(r.name.replace(/ Grand Prix\b/, ' GP')), dayLabel(r.date), raceText(surname(r.winner)), k >= 0 ? k : raceText(surname(r.leader)), r.lead].join('~');
      })
      .join(';'),
  ].join('|');
  const key =
    three.map((x, k) => `<span><i class="kl${dashed(k) ? ' is-dashed' : ''}" style="--t:${colour(x.team)}"></i>${escapeHtml(surname(x.name))}, ${escapeHtml(x.team)}</span>`).join('') +
    (turns.length ? '<span><i class="km">1</i>A turning point, told below</span>' : '') +
    '<span class="credit">Points: Jolpica F1, checked against formula1.com</span>';
  const table =
    `<details class="pd-tr-table" open><summary>Round by round, as a table</summary><div class="pd-tr-tw"><table><thead><tr><th>Round</th><th class="l">Grand Prix</th><th class="l">Date</th><th class="l">Winner</th>` +
    `${three.map(x => `<th>${escapeHtml(surname(x.name))}</th>`).join('')}<th class="l">Leader</th></tr></thead><tbody>${t.rounds
      .map(
        (r, i) =>
          `<tr><td class="n">${r.round}</td><td class="gp">${escapeHtml(r.name)}</td><td class="dt">${dayLabel(r.date)}</td><td class="wn">${r.winner ? `${tick(r.team)}${escapeHtml(surname(r.winner))}` : ''}</td>` +
          `${three.map(x => `<td${x.name === r.leader ? ' class="on"' : ''}>${x.points[i]}</td>`).join('')}<td class="ld">${escapeHtml(surname(r.leader))}</td></tr>`,
      )
      .join('')}</tbody></table></div></details>`;
  // The theme's script shows the switch, the drawing, the readout and the key, and folds the table away.
  const chart =
    `<section class="pd-tr-chart"><div class="pd-tr-chart-head"><div><h2 class="pd-tr-ct">Points behind the leader</h2><p>After each of the ${n} rounds${t.sprints ? ', sprints included' : ''}</p></div>` +
    '<div class="pd-tr-seg" role="group" aria-label="Show" hidden><button type="button" data-pd-tr="gap">Behind the leader</button><button type="button" data-pd-tr="pts">Points</button></div></div>' +
    `<div class="pd-tr-draw" data-pd-race="${escapeHtml(data)}" hidden></div><p class="pd-tr-read" aria-live="polite" hidden></p><div class="pd-tr-key" hidden>${key}</div>${table}</section>`;

  const turnsSec = turns.length
    ? `<section class="pd-tr-tp"><div class="pd-sh"><h2>${inWords(turns.length)} turning point${turns.length === 1 ? '' : 's'}</h2><p>Numbered as on the chart</p></div><ol class="pd-tr-turns">${turns
        .map((x, j) => {
          const i = t.rounds.findIndex(r => r.round === x.round);
          const r = t.rounds[i];
          const after = ranked(i).map(({ x: y, pts: p }) => `<span>${tick(y.team)}${escapeHtml(surname(y.name))} <b>${p}</b></span>`).join('');
          return (
            `<li class="pd-tr-turn"><header><span class="n">${j + 1}</span><div><b>${escapeHtml(r.name)}</b><small>Round ${r.round} · ${dayLabel(r.date)}</small></div></header>` +
            `<p>${escapeHtml(x.text)}</p><p class="pd-tr-after"><span class="lab">After it</span>${after}</p></li>`
          );
        })
        .join('')}</ol></section>`
    : '';

  // Only a season decided at its last round has a decider in its file.
  let decider = '';
  if (n > 1 && t.decider) {
    const lead = t.rounds[n - 2].lead;
    const going = ranked(n - 2)
      .map(({ x, pts: p }, j) => `<li style="--t:${colour(x.team)}"><span class="k">${j + 1}</span><i></i><b>${escapeHtml(surname(x.name))}</b><span class="v">${p}${lead - p > 0 ? ` <small>${lead - p} behind</small>` : ''}</span></li>`)
      .join('');
    const needed = (t.decider?.needed ?? [])
      .map(x => {
        const y = three.find(z => z.name === x.driver);
        return `<div style="--t:${y ? colour(y.team) : NEUTRAL}"><dt>${escapeHtml(surname(x.driver))}</dt><dd>${escapeHtml(x.text)}</dd></div>`;
      })
      .join('');
    const happened = three
      .map((x, k) => ({ x, k }))
      .sort((a, b) => (a.x.last ?? 99) - (b.x.last ?? 99))
      .map(({ x }) => {
        const champion = x.name === winner;
        return `<li${champion ? ' class="champ"' : ''} style="--t:${colour(x.team)}"><span class="k">${x.last ?? '–'}</span><i></i><b>${escapeHtml(surname(x.name))}</b><span class="v">${x.points[n - 1]} <small>${champion ? 'champion' : 'in all'}</small></span></li>`;
      })
      .join('');
    decider =
      `<section class="pd-tr-final"><div class="pd-sh"><h2>The decider</h2><p>${escapeHtml(last.name)} · ${longDay(last.date)}</p></div><div class="pd-tr-fin">` +
      `<div class="pd-tr-box"><h3>Going in</h3><ol>${going}</ol>${t.decider?.going ? `<p>${escapeHtml(t.decider.going)}</p>` : ''}</div>` +
      (needed
        ? `<div class="pd-tr-box"><h3>What each needed</h3><dl class="pd-tr-need">${needed}</dl>${t.decider?.neededNote ? `<p class="pd-tr-src">${escapeHtml(t.decider.neededNote)}</p>` : ''}</div>`
        : '') +
      `<div class="pd-tr-box"><h3>What happened</h3><ol>${happened}</ol><p>The three in the race&#39;s order, with each one&#39;s points for the season.${t.decider?.after ? ` ${escapeHtml(t.decider.after)}` : ''}</p></div></div></section>`;
  }

  const season = d.season;
  const more = [
    door(seriesPath(d.slug, 'champions'), seriesPath(d.slug, 'champions'), `${d.name} champions`, 'Every champion, year by year.', built(d.slug, 'champions')),
    door(seriesPath(d.slug, 'standings'), seriesPath(d.slug, 'standings'), `${d.name} standings`, typeof season === 'number' ? `The ${season} title race, as it stands.` : 'Both tables, and who can still win it.', built(d.slug, 'standings')),
    typeof season === 'number' && WEEKEND_PAGES.has(d.slug) ? door(seasonPath(d.slug, season), seasonPath(d.slug, season), `The ${season} season`, `Every ${season} weekend, round by round.`, true) : '',
  ].join('');
  const doors = `<section class="pd-ch-more"><h2>More ${name}</h2><div class="pd-ch-doors">${more}</div></section>`;

  const main = `<div class="pd-sr pd-s-${escapeHtml(d.slug)}">${band}${tabs(d, null)}<div class="pd-sr-main"><div class="pd-sr-sec pd-trp">${finalThree}${chart}${turnsSec}${decider}${doors}</div></div></div>`;
  return { path: seasonPath(d.slug, t.season), title: `${d.name} ${t.season} title race`, body: htmlBlock(main), template: 'page-wide' };
}

// ── The series list (slot O21) ───────────────────────────────────────────────
//
// Round 2's "All series", answered on The Paddock Drafts (v13 to v16): the championships still racing, then the
// completed ones in gold, each split by type, a type's group as wide as its cards. A round is run once it has a race
// result or its dates are past on the publish day, and a one-race series is finished once its champion is written;
// the theme's script names this weekend, fills Racing this weekend and runs the switch, the chips and the +.

/** The type chips, in round 2's order: meta.json's category and its label. */
const TYPES: ReadonlyArray<readonly [string, string]> = [
  ['formula', 'Open-wheel'],
  ['endurance', 'Endurance'],
  ['gt', 'GT'],
  ['motorcycle', 'Motorcycles'],
  ['rally', 'Rally'],
  ['stock', 'Stock cars'],
];
/** Round 2's order inside a type, where its screenshots show it; the rest by each series' calendar order. */
const LIST_ORDER = ['f1', 'f2', 'f3', 'formula-e', 'indycar', 'adac-ravenol-24h'];
const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const MONTH = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long' });

/** A round on a Saturday or Sunday reads This weekend from that weekend's Friday, as Racing this weekend counts it. */
function weekendFrom(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const back = [2, 0, 0, 0, 0, 0, 1][d.getUTCDay()];
  return back ? new Date(d.getTime() - back * 864e5).toISOString().slice(0, 10) : day;
}

interface ListEntry {
  d: SeriesData;
  rounds: CalendarRound[];
  ran: ReadonlySet<number>;
  next: CalendarRound | undefined;
  over: boolean;
}

/** A round counts as run once its last race is over. With a result in the feed, when the last race the calendar times
 *  for it has ended: a weekend's Saturday race alone never closes a round raced again on the Sunday (DTM, WorldSBK).
 *  Without one, from the UTC day after that race ended, since a feed can lag its season (IMSA's stored results stop at
 *  round 5 of 11) and a past round must never read as Next. A round the calendar does not time goes by its dates. */
function listEntry(d: SeriesData, now: Date): ListEntry {
  const today = now.toISOString().slice(0, 10);
  const rounds = d.rounds ?? [];
  const raced = new Set((d.results ?? []).filter(r => r.round !== null && raceOf(r)).map(r => r.round as number));
  const lastRaceEnd = (r: CalendarRound): number | null => {
    const ends = (d.calendar ?? [])
      .filter(e => e.round === r.round && !e.dateOnly && sessionKind(e.session) === 'race')
      .map(e => Date.parse(e.end))
      .filter(t => !Number.isNaN(t));
    return ends.length ? Math.max(...ends) : null;
  };
  const isRun = (r: CalendarRound): boolean => {
    const end = lastRaceEnd(r);
    if (end === null) return raced.has(r.round) ? r.endDate <= today : r.endDate < today;
    return raced.has(r.round) ? end <= now.getTime() : end < Date.parse(`${today}T00:00:00Z`);
  };
  const ran = new Set(rounds.filter(isRun).map(r => r.round));
  const next = rounds.find(r => !ran.has(r.round));
  return { d, rounds, ran, next, over: rounds.length ? !next : Boolean(d.champion) };
}

function listCard(e: ListEntry): string {
  const { d, rounds, ran, next, over } = e;
  const label = TYPES.find(t => t[0] === d.category)?.[1] ?? '';
  const colour = HEX.test(d.colour ?? '') ? d.colour : NEUTRAL;
  const built = BUILT[d.slug];
  const name = built ? `<a href="${seriesPath(d.slug)}">${escapeHtml(d.name)}</a>` : escapeHtml(d.name);
  const bar = rounds.length ? `<span class="pd-sx-bar" aria-hidden="true">${rounds.map(r => `<i${ran.has(r.round) ? ' class="is-done"' : r === next ? ' class="is-next"' : ''}></i>`).join('')}</span>` : '';
  const run = rounds.length ? `<p class="pd-sx-run"><span>${rounds.filter(r => ran.has(r.round)).length} of ${rounds.length} rounds run</span><span>${escapeHtml(String(d.season ?? ''))}</span></p>` : '';
  let state: string;
  if (!rounds.length) {
    const first = (d.calendar ?? []).map(c => c.start).sort()[0];
    const when = first ? ` · ${MONTH.format(new Date(first))}` : '';
    state = `<p class="pd-sx-st"><em class="pd-sx-tag">One race a year${when}</em></p>${d.champion ? `<p class="pd-sx-ev"><b>${escapeHtml(String(d.season ?? ''))} winners: ${escapeHtml(d.champion)}</b></p>` : ''}`;
  } else if (next) {
    state =
      `<p class="pd-sx-st"><em class="pd-sx-pill">${wk({ ...next, startDate: weekendFrom(next.startDate) }, 'Next', 'This weekend')}</em>` +
      `<span class="pd-sx-in" data-pd-days="${escapeHtml(next.startDate)}" hidden></span></p>` +
      `<p class="pd-sx-ev"><b>Round ${next.round} · ${escapeHtml(next.name)}</b><span>${dates(next.startDate, next.endDate)}</span></p>`;
  } else {
    const who = d.champion ? `${escapeHtml(String(d.season ?? ''))} champion: ${escapeHtml(d.champion)}` : `All ${rounds.length} rounds run`;
    state = `<p class="pd-sx-st"><em class="pd-sx-tag">Season complete</em></p><p class="pd-sx-ev"><b>${who}</b></p>`;
  }
  const page = (tab: 'standings' | 'results' | 'champions', text: string) => (built?.has(tab) ? `<a href="${seriesPath(d.slug, tab)}">${text}</a>` : `<span class="is-off">${text}</span>`);
  const links = `<nav class="pd-sx-links" aria-label="${escapeHtml(d.name)}"><a href="/calendar/#${escapeHtml(d.slug)}">Calendar</a>${page('standings', 'Standings')}${page('results', 'Results')}${page('champions', 'Champions')}</nav>`;
  return (
    `<article class="pd-sx-card${over ? ' is-over' : ''}" data-type="${escapeHtml(d.category ?? '')}" data-s="${escapeHtml(d.slug)}" style="--t:${colour}">` +
    `<header class="pd-sx-head"><small>${label}</small><b>${name}</b><button type="button" class="pd-sx-fol" data-pd-follow="${escapeHtml(d.slug)}" data-on="✓" data-off="+" aria-label="Follow ${escapeHtml(d.name)}" hidden>+</button></header>` +
    `<div class="pd-sx-body">${bar}${run}${state}${links}</div></article>`
  );
}

/** A status's section, split by type: each type a group as wide as its cards, up to the row's four. */
function listSection(title: string, note: string, list: ListEntry[], over: boolean): string {
  if (!list.length) return '';
  const groups = TYPES.map(([key, label]) => {
    const cards = list.filter(e => e.d.category === key);
    const n = Math.min(cards.length, 4);
    return cards.length ? `<div class="pd-sx-type pd-sx-span-${n}" data-type="${key}"><h3>${label} <small>${cards.length}</small></h3><div class="pd-sx-grid pd-sx-cols-${n}">${cards.map(listCard).join('')}</div></div>` : '';
  }).join('');
  return `<section class="pd-sx-sec${over ? ' is-over' : ''}"><div class="pd-sh"><h2>${title}</h2><p>${note}</p></div><div class="pd-sx-groups">${groups}</div></section>`;
}

/** Racing this weekend: every series' next round, hidden; the script shows those within the reader's own Friday to
 *  Sunday, and the section with them. Each card opens the Calendar showing its series (the operator, 22 Oct: "taking
 *  you to the weekend thats coming up") until the weekend pages exist. */
function weekendCards(list: ListEntry[]): string {
  const cards = list
    .filter(e => e.next)
    .map(({ d, next }) => {
      const r = next as CalendarRound;
      const name = r.name.replace(/ Grand Prix\b/, ' GP');
      // A series with weekend pages (O19) opens its weekend; the others open the Calendar showing that series.
      const page = weekendOf(d, r.round);
      const where = page ? 'its weekend page' : 'on the Calendar';
      return (
        `<article class="pd-sx-wk" data-from="${escapeHtml(r.startDate)}" data-to="${escapeHtml(r.endDate)}" style="--t:${HEX.test(d.colour ?? '') ? d.colour : NEUTRAL}" hidden>` +
        `<header><b>${escapeHtml(d.name)}</b><small>Round ${r.round}</small></header>` +
        `<div><a href="${page ?? `/calendar/#${escapeHtml(d.slug)}`}" aria-label="${escapeHtml(`${d.name}, round ${r.round}: ${name}, ${where}`)}"><b>${escapeHtml(name)}</b></a><span>${dates(r.startDate, r.endDate)}</span></div></article>`
      );
    })
    .join('');
  return cards ? `<section class="pd-sx-sec pd-sx-weekend" hidden><div class="pd-sh"><h2>Racing this weekend</h2><p data-pd-sx-count></p></div><div class="pd-sx-wks">${cards}</div></section>` : '';
}

/** /series/: every championship, still racing then completed, each split by type (the operator, 21 Oct). */
export function seriesList(all: SeriesData[], now: Date): Page {
  const rank = (d: SeriesData) => (LIST_ORDER.includes(d.slug) ? LIST_ORDER.indexOf(d.slug) : 50 + (d.order ?? 99));
  const typeAt = (d: SeriesData) => {
    const i = TYPES.findIndex(t => t[0] === d.category);
    return i < 0 ? TYPES.length : i;
  };
  const list = [...all].sort((a, b) => typeAt(a) - typeAt(b) || rank(a) - rank(b) || a.name.localeCompare(b.name)).map(d => listEntry(d, now));
  const racing = list.filter(e => !e.over);
  const done = list.filter(e => e.over);
  const season = all.find(d => d.season)?.season;
  const counted = (n: number) => `${n} championship${n === 1 ? '' : 's'}`;
  const chips = TYPES.map(([key, label]) => [key, label, list.filter(e => e.d.category === key).length] as const)
    .filter(([, , n]) => n > 0)
    .map(([key, label, n]) => `<button type="button" data-pd-sx-type="${key}">${label} <small>${n}</small></button>`)
    .join('');
  const head =
    `<h1 class="pd-sx-h1">${NUMBER_WORDS[list.length] ?? list.length} championships</h1>` +
    `<p class="pd-sx-sub">The ${season ?? ''} season, every series. Follow the ones you care about.</p>` +
    `<div class="pd-sx-ctl" hidden><div class="pd-sx-sw"><button type="button" data-pd-sx-show="all">All</button><button type="button" data-pd-sx-show="following">Following <small data-pd-sx-following></small></button></div>` +
    `<div class="pd-sx-chips"><button type="button" data-pd-sx-type="all">All <small>${list.length}</small></button>${chips}</div></div>` +
    '<p class="pd-sx-none" hidden>Nothing followed yet: follow a championship with the + on its card.</p>';
  const main =
    `<div class="pd-sx">${head}${weekendCards(list)}` +
    listSection('Still racing', counted(racing.length), racing, false) +
    listSection('Completed', `${counted(done.length)}${season ? ` · the ${season} season over` : ''}`, done, true) +
    '</div>';
  return { path: '/series/', title: 'Series', body: htmlBlock(main), template: 'page-wide' };
}

/** A series' pages in round 2's design: the Overview, Results, Standings and Champions (the weekend pages are weekend.ts's). */
export function seriesFamily(d: SeriesData): Page[] {
  return [
    seriesOverview(d),
    seriesResults(d),
    ...(built(d.slug, 'standings') ? [seriesStandings(d)] : []),
    ...(built(d.slug, 'champions') ? [seriesChampions(d)] : []),
    ...titleRacesOf(d).map(t => seriesTitleRace(d, t)),
  ];
}
