// Round 2's series pages on the Paddock theme (slots O13 to O17): the frame every series page shares, and
// the Overview (O13). Pure, as render.ts: the stored feeds and the repository's content in, block markup out.
// Every string from a feed or a content file passes escapeHtml, and every href is built here. A time is
// written in UTC as `.pd-t[data-utc]` and a weekend's label as `.pd-wk[data-from][data-to]`; the theme's
// script (wp-theme/paddock/assets/js/paddock.js) shows them in the reader's zone and names what is on now,
// so a page changes only when its data does. Inline style carries only `width` and `--t`, both of which
// WordPress keeps in post content (safecss_filter_attr, WordPress 6.1 onward).

import { calendarMonthPath, escapeHtml, seriesPath, type CalendarRound, type Page, type SeriesData, type SeriesTeam, type Table } from './render';

/** The series drawn in round 2's design; the others keep the plain pages until slot O18. */
export const ROUND2_SERIES: ReadonlySet<string> = new Set(['f1']);

const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const AT = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
/** Only a hex colour reaches a style attribute; anything else draws in the neutral grey. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const NEUTRAL = '#9aa3b2';

const htmlBlock = (inner: string): string => `<!-- wp:html -->\n${inner}\n<!-- /wp:html -->`;
// en-GB writes September as "Sept"; round 2 writes "Sep".
const dayLabel = (day: string): string => DAY.format(new Date(`${day}T12:00:00Z`)).replace('Sept', 'Sep');
const clock = (iso: string): string => `<span class="pd-t" data-utc="${escapeHtml(iso)}" data-f="wt">${AT.format(new Date(iso))} UTC</span>`;
const col = (columns: string[], ...names: string[]): number => columns.findIndex(c => names.includes(c));

/** "23–25 Oct", or "30 Oct–1 Nov" across two months. */
function dates(from: string, to: string): string {
  return from.slice(0, 7) === to.slice(0, 7) ? `${Number(from.slice(8))}–${dayLabel(to)}` : `${dayLabel(from)}–${dayLabel(to)}`;
}

/** A label the theme's script turns into `on` while the reader's own date is within the round's dates. */
function wk(r: CalendarRound, off: string, on: string): string {
  return `<span class="pd-wk" data-from="${escapeHtml(r.startDate)}" data-to="${escapeHtml(r.endDate)}" data-on="${escapeHtml(on)}">${escapeHtml(off)}</span>`;
}

/** The host's outline, which the theme draws as a mask in the text's colour; nothing when it carries none. */
function outline(key: string | null | undefined, extra = ''): string {
  return key && /^[a-z0-9-]+$/.test(key) ? `<i class="pd-ol pd-ol-${key}${extra}" aria-hidden="true"></i>` : '';
}

// ── Teams and drivers ────────────────────────────────────────────────────────

// The feeds write "Haas F1 Team" where drivers.json writes "Haas".
const plain = (team: string): string => team.toLowerCase().replace(/\s+f1 team$/, '').trim();
const teamLabel = (team: string): string => team.replace(/ F1 Team$/, '');
const bare = (name: string): string => (name.split(' ').pop() ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function teamOf(d: SeriesData, team: string): SeriesTeam | undefined {
  const key = plain(team);
  return d.teams?.find(t => plain(t.name) === key);
}

function colourOf(d: SeriesData, team: string): string {
  const c = teamOf(d, team)?.colour ?? '';
  return HEX.test(c) ? c : NEUTRAL;
}

/** A driver's three-letter code from drivers.json, matched by surname; else the surname's first three letters. */
function codeOf(d: SeriesData, name: string): string {
  for (const t of d.teams ?? []) for (const x of t.drivers) if (x.code && bare(x.name) === bare(name)) return x.code;
  return bare(name).slice(0, 3).toUpperCase();
}

// ── The season's races ───────────────────────────────────────────────────────

interface RoundWin {
  round: number;
  /** The results feed's name, for a round rounds.json does not know. */
  title: string;
  date: string | null;
  winner: string;
  team: string;
  /** The winner's margin over second in seconds ("7.335"), or "" when second was lapped or out. */
  margin: string;
}

/** Each round's race, the last session in its running order: the winner, the team and the margin. Sprints are not wins. */
function raceWins(d: SeriesData): Map<number, RoundWin> {
  const out = new Map<number, RoundWin>();
  for (const r of d.results ?? []) {
    if (r.round === null) continue;
    const race = r.sessions.find(s => s.label === 'Race') ?? r.sessions[r.sessions.length - 1];
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

/** The five tabs, each a page at its own address; Calendar opens the site's Calendar showing only this series. */
function tabs(d: SeriesData, on: SeriesTab): string {
  const links: Array<[SeriesTab, string, string]> = [
    ['overview', 'Overview', seriesPath(d.slug)],
    ['calendar', 'Calendar', `/calendar/#${d.slug}`],
    ['standings', 'Standings', seriesPath(d.slug, 'standings')],
    ['results', 'Results', seriesPath(d.slug, 'results')],
    ['champions', 'Champions', seriesPath(d.slug, 'champions')],
  ];
  const items = links.map(([tab, label, href]) => `<a href="${escapeHtml(href)}"${tab === on ? ' aria-current="page"' : ''}>${label}</a>`);
  return `<nav class="pd-sr-tabs" aria-label="${escapeHtml(d.name)} pages"><div class="pd-sr-tabs-in">${items.join('')}</div></nav>`;
}

/** The series band: its name, the season in a line, a bar of its rounds, Follow (the theme's script) and Session emails. */
function band(d: SeriesData, wins: Map<number, RoundWin>, current: CalendarRound | undefined): string {
  const rounds = d.rounds ?? [];
  const line = [d.season ? `${d.season} season` : '', `${rounds.length} rounds`, `${rounds.filter(r => wins.has(r.round)).length} run`].filter(Boolean).join(' · ');
  const next = current ? ` · ${wk(current, `next: round ${current.round}`, `round ${current.round} this weekend`)}` : '';
  const bar = rounds.map(r => `<i${wins.has(r.round) ? ' class="is-done"' : r === current ? ' class="is-now"' : ''}></i>`).join('');
  return (
    `<section class="pd-sr-band"><div class="pd-sr-band-in"><div class="pd-sr-ttl"><h1>${escapeHtml(d.name)}</h1><p>${line}${next}</p><span class="pd-sr-bar" aria-hidden="true">${bar}</span></div>` +
    `<div class="pd-sr-acts"><button type="button" class="pd-sr-follow" data-pd-follow="${escapeHtml(d.slug)}" hidden>Follow</button><a class="pd-sr-emails" href="/subscribe/">Session emails</a></div></div></section>`
  );
}

// ── The Overview ─────────────────────────────────────────────────────────────

/** The round to come: what is on now or next (the theme's script, from the round's sessions) and the race. */
function nextCard(d: SeriesData, r: CalendarRound): string {
  const sessions = (d.calendar ?? []).filter(e => e.round === r.round && !e.dateOnly).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const race = [...sessions].reverse().find(e => /^race$/i.test(e.session)) ?? sessions[sessions.length - 1];
  const where = [r.venue ?? '', dates(r.startDate, r.endDate)].filter(Boolean).map(escapeHtml).join(' · ');
  return (
    `<article class="pd-sr-card pd-sr-next" data-pd-ses="${escapeHtml(sessions.map(e => `${e.session}|${e.start}|${e.end}`).join(';'))}"><div class="pd-sr-card-in">` +
    `<p class="pd-sr-lab"><span class="pd-pill pd-pill-live" hidden>● Live</span><span>Round ${r.round} · ${wk(r, 'next', 'this weekend')}</span></p>` +
    `<h2>${escapeHtml(r.name)}</h2><p class="pd-mut">${where}</p>` +
    (race ? `<p class="pd-sr-line"><b class="pd-sr-ses"></b><span class="pd-sr-race">${escapeHtml(race.session)} ${clock(race.start)}</span></p>` : '') +
    `</div><i class="pd-sr-num" aria-hidden="true">${r.round}</i></article>`
  );
}

function lastCard(d: SeriesData, w: RoundWin, r: CalendarRound | undefined): string {
  const where = [r?.venue ?? '', w.date ? dayLabel(w.date) : ''].filter(Boolean).map(escapeHtml).join(' · ');
  const how = `${escapeHtml(teamLabel(w.team))}${w.margin ? ` · won by ${escapeHtml(w.margin)} s` : ''}`;
  return (
    `<article class="pd-sr-card"><div class="pd-sr-card-in"><p class="pd-sr-lab">Last race · Round ${w.round}</p><h2>${escapeHtml(r?.name ?? w.title)}</h2><p class="pd-mut">${where}</p>` +
    `<p class="pd-sr-line"><span class="pd-sr-win" style="--t:${colourOf(d, w.team)}"><b>${escapeHtml(w.winner)}</b></span> <span class="pd-mut">${how}</span></p></div>` +
    `${outline(r?.outline, ' pd-ol-big')}</article>`
  );
}

/** A round's tile: a finished round opens its line on the Results page, a round to come its month on the Calendar. */
function tile(d: SeriesData, r: CalendarRound, w: RoundWin | undefined, current: CalendarRound | undefined): string {
  const head = `<small>R${r.round}</small><b>${escapeHtml(r.place ?? r.name)}</b>${outline(r.outline)}`;
  if (w) {
    const won = `<span class="pd-sr-win" style="--t:${colourOf(d, w.team)}"><b>${escapeHtml(codeOf(d, w.winner))}</b>${w.date ? dayLabel(w.date) : ''}</span>`;
    return `<a class="pd-sr-tile" href="${seriesPath(d.slug, 'results')}#r${r.round}">${head}${won}</a>`;
  }
  const when = dates(r.startDate, r.endDate);
  const label = r === current ? wk(r, `Next · ${when}`, `This weekend · ${when}`) : escapeHtml(when);
  return `<a class="pd-sr-tile ${r === current ? 'is-now' : 'is-ahead'}" href="${calendarMonthPath(r.startDate.slice(0, 7))}#${escapeHtml(d.slug)}">${head}<span class="pd-sr-when">${label}</span></a>`;
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
    `<div><div class="pd-sh"><h2>${escapeHtml(drivers.title)}</h2><p><a href="${seriesPath(d.slug, 'standings')}">All ${drivers.rows.length} →</a></p></div>` +
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

/** A series' pages in round 2's design: the Overview now; Results, Standings and Champions in their slots. */
export function seriesFamily(d: SeriesData): Page[] {
  return [seriesOverview(d)];
}
