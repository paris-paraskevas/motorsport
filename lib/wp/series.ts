// Round 2's series pages on the Paddock theme (slots O13 to O17): the frame every series page shares, the
// Overview (O13) and Results (O15). Pure, as render.ts: the stored feeds and the repository's content in, block markup out.
// Every string from a feed or a content file passes escapeHtml, and every href is built here. A time is
// written in UTC as `.pd-t[data-utc]` and a weekend's label as `.pd-wk[data-from][data-to]`; the theme's
// script (wp-theme/paddock/assets/js/paddock.js) shows them in the reader's zone and names what is on now,
// so a page changes only when its data does. Inline style carries only `width` and `--t`, both of which
// WordPress keeps in post content (safecss_filter_attr, WordPress 6.1 onward).

import { calendarMonthPath, escapeHtml, seriesPath, sessionKind, WEEKEND_PAGES, weekendPath, type CalendarRound, type Page, type ResultRound, type ResultSession, type SeriesData, type SeriesTeam, type Table } from './render';

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
const BUILT: Readonly<Record<string, ReadonlySet<'standings' | 'results' | 'champions'>>> = { f1: new Set(['results', 'standings']) };
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
 *  so on a sprint weekend's Saturday the sprint is run and the race is not. */
export function pointsLeft(d: SeriesData): PointsLeft {
  const wins = raceWins(d);
  const stored = new Map((d.results ?? []).flatMap(r => (r.round === null ? [] : [[r.round, r] as const])));
  let races = 0;
  let sprints = 0;
  let sprintsRun = 0;
  for (const r of d.rounds ?? []) {
    if (!wins.has(r.round)) races++;
    if (!sprintWeekend(d, r.round, stored.get(r.round))) continue;
    if (sprintRun(stored.get(r.round))) sprintsRun++;
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

/** /series/<slug>/standings/: the drivers and Who can still win it beside the constructors, then the teammates. */
export function seriesStandings(d: SeriesData): Page {
  const wins = raceWins(d);
  const current = (d.rounds ?? []).find(r => !wins.has(r.round));
  const stored = new Map((d.results ?? []).flatMap(r => (r.round === null ? [] : [[r.round, r] as const])));
  const drivers = standingRows(d.standings?.[0], true);
  const teams = standingRows(d.standings?.[1], false);
  const left = pointsLeft(d);
  const head = standingsHead(d, wins, stored);
  const marks = marksOf(d);
  const lead = drivers[0]?.pts ?? 0;
  const inIt = stillIn(drivers, left.driver);
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
  const splits = teammates(d);
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
        .filter(s => plain(s.team) !== plain(x.team))
        .flatMap(s => [...s.pair, ...s.also].filter(m => m.name === x.name && m.points > 0).map(m => `${escapeHtml(surname(x.name))}'s ${escapeHtml(x.shown)} include ${m.points} for ${escapeHtml(teamLabel(s.team))}, in ${roundsText(m.rounds)}.`)),
    ),
  ].filter(Boolean);
  const leftCol = drivers.length
    ? `<div class="pd-st-left"><div class="pd-st-th"><span>Pos</span><span></span><span>Driver</span><span></span><span>Pts</span><span>Gap</span><span>Wins</span></div><ol class="pd-st-tbl">${driverRows}</ol>` +
      `${foot.length ? `<p class="pd-st-foot">${foot.join(' ')}</p>` : ''}</div>`
    : '<div class="pd-st-left"><p class="pd-mut">No standings yet this season.</p></div>';

  // Who can still win it: the leader, everyone who can still draw level, and the first driver who cannot.
  let who = '';
  if (drivers.length) {
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
    `<div class="pd-sr pd-s-${escapeHtml(d.slug)}">${band(d, wins, current)}${tabs(d, 'standings')}<div class="pd-sr-main">` +
    `<section class="pd-sr-sec pd-stp">${top}<div class="pd-st-cols">${leftCol}<div class="pd-st-right">${who}${cons}</div></div></section>${mates}</div></div>`;
  return { path: seriesPath(d.slug, 'standings'), title: `${d.name} standings`, body: htmlBlock(main), template: 'page-wide' };
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

/** A series' pages in round 2's design: the Overview, Results and Standings now (the weekend pages are weekend.ts's);
 *  Champions in its slot. */
export function seriesFamily(d: SeriesData): Page[] {
  return [seriesOverview(d), seriesResults(d), ...(built(d.slug, 'standings') ? [seriesStandings(d)] : [])];
}
