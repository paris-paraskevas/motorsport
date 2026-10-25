// Formula 1's weekend pages (slot O19, its second PR): the season at /series/<slug>/<season>/, each round's Overview at
// round-<n>/ and a page per session under it, as the operator approved them on Paddock Weekend Drafts (version 3) and
// full width (O27). Pure, as series.ts: the stored results and timetable, the weekend data the publisher keeps
// (lib/openf1/weekend.ts, lib/met-norway.ts) and the repository's content in, block markup out. The reader's times go
// out in UTC as `.pd-t[data-utc]`; the track's are written here, in the circuit's zone. What a page shows follows its
// data, never the hour it is written (a session with a result has run), so a page changes only when its data does.
// WordPress keeps no inline SVG and no inline style but width and custom properties: the Pit wall places its stints
// with --l and --w, and the theme's script (wp-theme/paddock/assets/js/paddock.js) draws the circuit from data-pd-map.

import { stepFor, symbolLabel, type ForecastStep } from '@/lib/met-norway';
import { isMap, type DriverStints, type SessionExtras } from '@/lib/openf1/weekend';
import { escapeHtml, isRaceLaps, seasonPath, seriesPath, sessionSlug, WEEKEND_PAGES, weekendPath, type CalendarEntry, type CalendarRound, type Page, type ResultRound, type SeriesData, type Table } from './render';
import { band, built, codeOf, col, colourOf, dates, htmlBlock, numberOf, outline, pointsTable, raceWins, sameDriver, seatOf, sprintWeekend, tabs, teamLabel, tick, weekendPoints, wk } from './series';

/** The rows a session's card leads with (the operator, 22 Oct): three in practice, ten in qualifying and sprint
 *  qualifying, the eight who score in a sprint; the race's ten lead its own section. */
const CARD_ROWS: Readonly<Record<string, number>> = { Sprint: 8, Qualifying: 10, 'Sprint Qualifying': 10 };
const RACE_ROWS = 10;
/** The Overview's Pit wall shows the race's top ten; a race's or a sprint's own page every driver. */
const PIT_WALL_ROWS = 10;
const UTC_WT = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const UTC_T = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const MONTH = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long' });
const COMPOUNDS: Readonly<Record<string, readonly [string, string, string]>> = {
  SOFT: ['pd-c-s', 'S', 'Soft'],
  MEDIUM: ['pd-c-m', 'M', 'Medium'],
  HARD: ['pd-c-h', 'H', 'Hard'],
  INTERMEDIATE: ['pd-c-i', 'I', 'Intermediate'],
  WET: ['pd-c-w', 'W', 'Wet'],
};

const esc = escapeHtml;
const byStart = (a: CalendarEntry, b: CalendarEntry): number => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);

const formats = new Map<string, Intl.DateTimeFormat>();
/** A formatter in the track's zone: the time, the day ("Friday 9 October"), the weekday, or the offset ("GMT+8"). */
function form(tz: string, kind: 'hm' | 'day' | 'wd' | 'off'): Intl.DateTimeFormat {
  const key = `${tz}|${kind}`;
  let f = formats.get(key);
  if (!f) {
    const o: Intl.DateTimeFormatOptions =
      kind === 'hm' ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : kind === 'day' ? { weekday: 'long', day: 'numeric', month: 'long' } : kind === 'wd' ? { weekday: 'short' } : { timeZoneName: 'shortOffset' };
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...o });
    formats.set(key, f);
  }
  return f;
}

/** The reader's own time of an instant: the theme's script writes it in their zone; without the script, UTC stands. */
function yours(iso: string, f: 't' | 'wt'): string {
  return `<span class="pd-t" data-utc="${esc(iso)}" data-f="${f}">${(f === 't' ? UTC_T : UTC_WT).format(new Date(iso))} UTC</span>`;
}

/** Minutes east of UTC in a zone at an instant ("GMT+8" → 480). */
function offsetOf(tz: string, iso: string): number {
  const name = form(tz, 'off').formatToParts(new Date(iso)).find(p => p.type === 'timeZoneName')?.value ?? '';
  const m = /GMT([+-])(\d{1,2})(?::(\d\d))?/.exec(name);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
}

function utcLabel(min: number): string {
  const a = Math.abs(min);
  return `UTC${min < 0 ? '−' : '+'}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, '0')}` : ''}`;
}

/** "9–11 October", or "30 October – 1 November" across two months. */
function longDates(from: string, to: string): string {
  const a = new Date(`${from}T12:00:00Z`);
  const b = new Date(`${to}T12:00:00Z`);
  if (from === to) return `${b.getUTCDate()} ${MONTH.format(b)}`;
  return from.slice(0, 7) === to.slice(0, 7) ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTH.format(b)}` : `${a.getUTCDate()} ${MONTH.format(a)} – ${b.getUTCDate()} ${MONTH.format(b)}`;
}

/** A lap in seconds as "1:31.373". */
function lapLabel(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, '0')}`;
}

// ── A weekend and its data ───────────────────────────────────────────────────

interface Weekend {
  d: SeriesData;
  season: number;
  r: CalendarRound;
  /** The round's stored results, once any session has one. */
  result: ResultRound | undefined;
  /** Its timed sessions in running order, one per name. */
  sessions: CalendarEntry[];
  /** The track's zone (circuits.json), UTC when no circuit matched. */
  tz: string;
  path: string;
  /** Each driver's team as the round's official classifications give it (teamAt). */
  teams: ReadonlyMap<string, string>;
}

/** What a page drew from each source, for its credit line: from OpenF1 the weather, race control's marks, the tyres and
 *  a circuit's pole lap; MET Norway's forecast. */
interface Used {
  weather: boolean;
  marks: boolean;
  tyres: boolean;
  map: boolean;
  met: boolean;
}
const nothingUsed = (): Used => ({ weather: false, marks: false, tyres: false, map: false, met: false });

function weekendOf(d: SeriesData, season: number, r: CalendarRound): Weekend {
  const seen = new Set<string>();
  const sessions = (d.calendar ?? [])
    .filter(e => e.round === r.round && !e.dateOnly)
    .sort(byStart)
    .filter(e => {
      const slug = sessionSlug(e.session);
      if (!slug || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    });
  let tz = 'UTC';
  try {
    if (r.tz) {
      form(r.tz, 'hm');
      tz = r.tz;
    }
  } catch {
    // An unknown zone keeps UTC: the track's times then read as UTC, never wrong.
  }
  const result = (d.results ?? []).find(x => x.round === r.round);
  const teams = new Map<string, string>();
  for (const s of [...(result?.sessions ?? []), ...(result?.others ?? [])]) {
    const t = /^(race|sprint|qualifying)$/i.test(s.label) ? s.tables[0] : undefined;
    const c = t ? cols(t) : null;
    if (t && c && c.name >= 0 && c.team >= 0) for (const row of t.rows) if (row[c.team]) teams.set(row[c.name], row[c.team]);
  }
  return { d, season, r, result, sessions, tz, path: weekendPath(d.slug, season, r.round), teams };
}

const sessionPath = (w: Weekend, label: string): string => `${w.path}${sessionSlug(label)}/`;

/** A session's classification once it has one row; null before it has run. */
function tableOf(w: Weekend, label: string): Table | null {
  const s = [...(w.result?.sessions ?? []), ...(w.result?.others ?? [])].find(x => x.label === label);
  const t = s?.tables[0];
  return t && t.rows.length ? t : null;
}

const extrasOf = (w: Weekend, label: string): SessionExtras | undefined => w.d.weekend?.sessions?.[String(w.season)]?.[String(w.r.round)]?.[label];

/** The columns a classification is read by. */
function cols(t: Table): { pos: number; name: number; team: number; time: number; pts: number } {
  return { pos: col(t.columns, 'Pos'), name: col(t.columns, 'Driver'), team: col(t.columns, 'Team'), time: col(t.columns, 'Time'), pts: col(t.columns, 'Pts', 'Points') };
}

/** A row's team as the round's race, sprint or qualifying (Jolpica's) gives it: OpenF1's practices and sprint
 *  qualifying carry the roster's, wrong for a driver who swapped seats (Lawson at Red Bull in rounds 12 to 14). */
const teamAt = (w: Weekend, row: string[], c: { name: number; team: number }): string => w.teams.get(row[c.name] ?? '') ?? row[c.team] ?? '';

/** A row's best time: qualifying's last part a driver reached, else the time. */
function bestTime(t: Table, row: string[]): string {
  const parts = t.columns.map((c, i) => (/^S?Q\d$/.test(c) ? i : -1)).filter(i => i >= 0);
  if (parts.length) return [...parts].reverse().map(i => row[i]).find(Boolean) ?? '';
  const at = col(t.columns, 'Time');
  return at >= 0 ? (row[at] ?? '') : '';
}

const trackTime = (w: Weekend, iso: string): string => form(w.tz, 'hm').format(new Date(iso));
const trackWeekday = (w: Weekend, iso: string): string => form(w.tz, 'wd').format(new Date(iso));
const trackDay = (w: Weekend, iso: string): string => form(w.tz, 'day').format(new Date(iso));

// ── Weather and marks ────────────────────────────────────────────────────────

/** The weather OpenF1 measured through a session: the middle air and track readings and whether it rained. */
function measured(x: SessionExtras | undefined, used: Used): string {
  const w = x?.weather;
  if (!w) return '';
  used.weather = true;
  return `<span class="pd-wk-wx"><b>${w.air[1]}°</b><small>air · ${w.track ? `track ${w.track[1]}° · ` : ''}${w.rain ? 'rain' : 'dry'}</small></span>`;
}

/** MET Norway's forecast for a session's start (stepFor), while the publisher holds one for its circuit. */
function forecastStep(w: Weekend, iso: string): ForecastStep | null {
  const f = w.r.circuit ? w.d.weekend?.forecast?.[w.r.circuit] : undefined;
  return f ? stepFor(f.steps, iso) : null;
}

/** The forecast as a line: the air, the sky, and the rain over the hour a session starts in, or over the six hours it
 *  starts in further out. */
function forecast(w: Weekend, iso: string, used: Used): string {
  const s = forecastStep(w, iso);
  if (!s) return '';
  used.met = true;
  const what = [symbolLabel(s.symbol), s.mm === null ? '' : `${s.mm} mm${s.hours === 6 ? ' in 6 h' : ''}`].filter(Boolean).join(' · ');
  return `<span class="pd-wk-wx"><b>${s.air}°</b><small>${esc(what)}</small></span>`;
}

/** Race control's marks on a session: a late start, and each red flag with its lap and whether the session started again. */
function marks(w: Weekend, label: string, used: Used): string {
  const m = extrasOf(w, label)?.marks;
  if (!m) return '';
  const out: string[] = [];
  if (m.late) {
    const mins = Math.round((Date.parse(m.late.started) - Date.parse(m.late.planned)) / 60_000);
    if (mins > 0) out.push(`<em class="pd-wk-mark">Started ${mins} minute${mins === 1 ? '' : 's'} late</em>`);
  }
  for (const red of m.red ?? []) out.push(`<em class="pd-wk-mark is-red">Red flag${red.lap ? ` on lap ${red.lap}` : ''} · ${red.restarted ? 'restarted' : 'not restarted'}</em>`);
  if (!out.length) return '';
  used.marks = true;
  return `<span class="pd-wk-marks">${out.join('')}</span>`;
}

// ── The parts every page of a weekend shares ─────────────────────────────────

function weekendBand(w: Weekend): string {
  const { d, r } = w;
  const where = [r.venue ?? '', r.country ?? ''].filter(Boolean).map(esc).join(', ');
  const note = r.moved?.note ? r.moved.note.charAt(0).toUpperCase() + r.moved.note.slice(1) : '';
  const moved = note ? `<em class="pd-wk-tag">${esc(note)}${r.moved?.from && r.moved.to ? `, first set for ${longDates(r.moved.from, r.moved.to)}` : ''}</em>` : '';
  return (
    `<section class="pd-wk-band"><div class="pd-wk-band-in"><p class="pd-wk-crumb"><a href="${seriesPath(d.slug)}">${esc(d.name)}</a> › <a href="${seasonPath(d.slug, w.season)}">${w.season} season</a> › Round ${r.round} of ${(d.rounds ?? []).length}</p>` +
    `<h1>${esc(r.name)}</h1><p class="pd-wk-where">${where}${where ? ' · ' : ''}<span class="pd-wk-dt">${longDates(r.startDate, r.endDate)}</span></p>${moved}<span class="pd-wk-num" aria-hidden="true">${r.round}</span></div></section>`
  );
}

/** One bar for every page of a weekend: its Overview, then each session's page with its time (its real start when it
 *  ran late) and its winner once run, the page you are on lit, a session still to run dashed and said so. */
function weekendBar(w: Weekend, current: string | null): string {
  const here = (on: boolean) => (on ? ' aria-current="page"' : '');
  const items = [`<a href="${w.path}"${here(current === null)}>Overview<small>the weekend</small></a>`];
  for (const e of w.sessions) {
    const t = tableOf(w, e.session);
    const who = t ? ` · ${esc(codeOf(w.d, t.rows[0][cols(t).name] ?? ''))}` : '<span class="pd-vh"> · still to run</span>';
    const at = extrasOf(w, e.session)?.marks?.late?.started ?? e.start;
    items.push(`<a href="${sessionPath(w, e.session)}"${here(e.session === current)}${t ? '' : ' class="is-up"'}>${esc(e.session)}<small>${yours(at, 'wt')}${who}</small></a>`);
  }
  return `<nav class="pd-wb" aria-label="${esc(`${w.r.name}: its pages`)}">${items.join('')}</nav>`;
}

/** The strip under the band: Final with who won, once the race has a result; else the session on now or next (the
 *  theme's script, from the weekend's timetable) with its countdown, Session emails and Follow. */
function strip(w: Weekend): string {
  const follow = `<button type="button" class="pd-wk-btn" data-pd-follow="${esc(w.d.slug)}" data-off="${esc(`Follow ${w.d.name}`)}" data-on="${esc(`Following ${w.d.name} ✓`)}" hidden>Follow ${esc(w.d.name)}</button>`;
  const race = tableOf(w, 'Race');
  if (race) {
    const at = cols(race).name;
    const win = race.rows[0][at];
    const pole = tableOf(w, 'Qualifying')?.rows[0];
    const sprint = tableOf(w, 'Sprint')?.rows[0];
    const sprintName = sprint ? sprint[col(tableOf(w, 'Sprint')?.columns ?? [], 'Driver')] : '';
    const fromPole = pole && pole[col(tableOf(w, 'Qualifying')?.columns ?? [], 'Driver')] === win ? ' from pole' : '';
    const also = sprint ? `, and the sprint ${sprintName === win ? 'too' : `went to ${esc(sprintName)}`}` : '';
    return `<div class="pd-wk-strip"><div class="pd-wk-strip-in"><em class="pd-wk-pill is-fin">Final</em><span class="pd-wk-sum"><b>${esc(win)}</b> won${fromPole}${also}</span><span class="pd-wk-acts">${follow}</span></div></div>`;
  }
  const emails = '<a class="pd-wk-btn" href="/subscribe/">Session emails</a>';
  if (!w.sessions.length) {
    return `<div class="pd-wk-strip"><div class="pd-wk-strip-in"><span class="pd-wk-sum">The weekend's times are not published yet</span><span class="pd-wk-acts">${emails}${follow}</span></div></div>`;
  }
  const first = w.sessions.find(e => !tableOf(w, e.session)) ?? w.sessions[0];
  const ses = w.sessions.map(e => `${encodeURIComponent(e.session)}|${e.start}|${e.end}`).join(';');
  const count = `<span class="pd-wk-count" data-pd-target="${esc(first.start)}" hidden>in <b data-pd-cd="a"></b> <small data-pd-cdl="a"></small> <b data-pd-cd="b"></b> <small data-pd-cdl="b"></small></span>`;
  return (
    `<div class="pd-wk-strip"><div class="pd-wk-strip-in"><span class="pd-wk-nx" data-pd-ses="${esc(ses)}"><span class="pd-pill pd-pill-live" hidden>● Live</span><em class="pd-wk-pill is-next">Next</em>` +
    `<span class="pd-wk-sum"><b class="pd-sr-ses">${esc(first.session)} · ${yours(first.start, 'wt')}</b></span>${count}</span><span class="pd-wk-acts">${emails}${follow}</span></div></div>`
  );
}

/** The circuit, big: OpenF1's positions of a pole lap, which the theme's script draws from data-pd-map (its box, the
 *  points where sectors 2 and 3 begin, then the points), with the sector times beside it. North is up. */
function circuit(w: Weekend, used: Used): string {
  const key = w.r.circuit;
  const m = key ? w.d.weekend?.maps?.[key] : undefined;
  if (!isMap(m) || m.points.length < 50) return '';
  used.map = true;
  const who = m.year === w.season ? driverByNumber(w.d, m.driver) : null;
  const when = m.year === w.season ? 'in qualifying' : `in qualifying here in ${m.year}`;
  const data = `${m.w} ${m.h}|${m.split[0]} ${m.split[1]}|${m.points.map(([x, y]) => `${x},${y}`).join(' ')}`;
  const venue = w.r.venue ?? w.r.name;
  return (
    `<section class="pd-cm" aria-labelledby="pd-cm-h"><div class="pd-cm-h"><h2 id="pd-cm-h">The circuit</h2><p class="pd-wk-hint">${esc(venue)} · its three sectors and the start/finish line</p></div>` +
    `<div class="pd-cm-draw" role="img" aria-label="${esc(`${venue}, drawn from a pole lap, with its three sectors and the start/finish line`)}" data-pd-map="${esc(data)}"></div>` +
    `<div class="pd-cm-side"><dl><dt><i class="pd-cm-k1"></i>Sector 1</dt><dd>${m.sectors[0].toFixed(3)} s</dd><dt><i class="pd-cm-k2"></i>Sector 2</dt><dd>${m.sectors[1].toFixed(3)} s</dd>` +
    `<dt><i class="pd-cm-k3"></i>Sector 3</dt><dd>${m.sectors[2].toFixed(3)} s</dd><dt>The lap</dt><dd>${lapLabel(m.lap)}</dd></dl>` +
    `<p>Drawn from ${who ? `${esc(who)}'s` : 'the'} pole lap ${when}: the car's position as OpenF1 recorded it, split at that lap's sector times. The arrow shows the way the cars run; north is up.</p></div></section>`
  );
}

/** A car number's driver on this season's grid (drivers.json); null for a number it does not hold. */
function driverByNumber(d: SeriesData, n: number): string | null {
  for (const t of d.teams ?? []) for (const x of t.drivers) if (x.number === n) return x.name;
  return null;
}

/** The sources a page drew on, as their terms ask, naming only what it shows: OpenF1 (CC BY-NC-SA 4.0), MET Norway
 *  (CC BY 4.0). */
function credit(used: Used): string {
  const from = [used.weather ? 'the weather' : '', used.marks ? 'race control’s marks' : '', used.tyres ? 'the tyres' : '', used.map ? 'the circuit’s pole lap' : ''].filter(Boolean);
  const listed = from.length > 1 ? `${from.slice(0, -1).join(', ')} and ${from[from.length - 1]}` : (from[0] ?? '');
  const parts = [
    listed ? `${listed.charAt(0).toUpperCase()}${listed.slice(1)} from <a href="https://openf1.org/">OpenF1</a>` : '',
    used.met ? 'Forecasts: Data from <a href="https://www.met.no/en">MET Norway</a>' : '',
  ].filter(Boolean);
  return parts.length ? `<p class="pd-wk-credit">${parts.join(' · ')}</p>` : '';
}

// ── The Overview's parts ─────────────────────────────────────────────────────

function podium(w: Weekend, t: Table): string {
  const c = cols(t);
  const items = t.rows.slice(0, 3).map(
    row =>
      `<li style="--t:${colourOf(w.d, teamAt(w, row, c))}"><small>${row[c.pos] === '1' ? 'Winner' : `P${esc(row[c.pos] ?? '')}`}</small><b>${esc(row[c.name] ?? '')}</b>` +
      `<span>${esc(teamLabel(teamAt(w, row, c)))}</span><em>${esc(c.time >= 0 ? (row[c.time] ?? '') : '')}</em></li>`,
  );
  return `<ol class="pd-wk-podium">${items.join('')}</ol>`;
}

/** A classification as a table: every column after the team; qualifying's parts but the last are hidden on a phone. */
function classTable(w: Weekend, t: Table, limit = Infinity): string {
  const c = cols(t);
  const figures = t.columns.map((_, i) => i).filter(i => i !== c.pos && i !== c.name && i !== c.team);
  const parts = figures.filter(i => /^S?Q\d$/.test(t.columns[i]));
  const kind = (i: number): string => (t.columns[i] === 'Pts' || t.columns[i] === 'Points' ? 'pt' : parts.length && parts.includes(i) && i !== parts[parts.length - 1] ? 't q' : t.columns[i] === 'Laps' ? 'n' : 't');
  const head = `<tr><th class="p">Pos</th><th class="d">Driver</th><th class="tm">Team</th>${figures.map(i => `<th class="${kind(i)}">${esc(t.columns[i])}</th>`).join('')}</tr>`;
  const body = t.rows
    .slice(0, limit)
    .map(
      row =>
        `<tr><td class="p">${esc(row[c.pos] ?? '')}</td><td class="d">${tick(w.d, teamAt(w, row, c))}<b>${esc(codeOf(w.d, row[c.name] ?? ''))}</b><span>${esc(row[c.name] ?? '')}</span></td>` +
        `<td class="tm">${esc(teamLabel(teamAt(w, row, c)))}</td>${figures.map(i => `<td class="${kind(i)}">${esc(row[i] ?? '') || '–'}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<div class="pd-wk-scroll"><table class="pd-wk-tbl"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/** Pit wall: each driver's tyres and stops, lap by lap, a line every five laps; a stint names its laps and its pit lap
 *  on hover, focus or a tap (the theme's script). The stints are OpenF1's, keyed by car number. */
function pitWall(w: Weekend, label: string, limit: number, used: Used): string {
  const t = tableOf(w, label);
  const stints = extrasOf(w, label)?.stints;
  if (!t || !stints?.length) return '';
  const total = Math.max(...stints.flatMap(([, list]) => list.map(s => s[2])));
  if (!(total > 0)) return '';
  used.tyres = true;
  // OpenF1 keeps a stint that ends before it starts (a set fitted and changed before a lap was run; Monaco's and
  // Sepang's races hold some): no lap to draw and no stop to count.
  const run = (list: DriverStints[1]): DriverStints[1] => list.filter(([, a, b]) => b >= a);
  const byCar = new Map(stints.map(([car, list]) => [car, run(list)] as const));
  const c = cols(t);
  const pct = (v: number): string => `${((v / total) * 100).toFixed(2)}%`;
  const rows = t.rows.slice(0, limit).map(row => {
    const name = row[c.name] ?? '';
    const code = codeOf(w.d, name);
    const n = numberOf(w.d, name);
    const mine = n === null ? [] : (byCar.get(n) ?? []);
    const out = /retired|did not|dnf|dns|dsq|disqualified/i.test(c.time >= 0 ? (row[c.time] ?? '') : '');
    const segs = mine
      .map(([compound, a, b], i) => {
        // OpenF1 writes UNKNOWN for a stint whose tyre it did not record (Norris's third in round 11's race).
        const [cls, letter, word] = COMPOUNDS[compound] ?? ['pd-c-u', '?', 'Tyre not recorded'];
        const laps = a === b ? `lap ${a}` : `laps ${a}–${b}`;
        const end = i < mine.length - 1 ? `pitted at the end of lap ${b}` : out ? `out on lap ${b}` : 'to the flag';
        const tip = `${code} · ${word} · ${laps} · ${end}`;
        return `<i class="${cls}" role="img" data-tip="${esc(tip)}" aria-label="${esc(tip)}" style="--l:${pct(a - 1)};--w:${pct(b - a + 1)}">${letter}</i>`;
      })
      .join('');
    const stops = Math.max(0, mine.length - 1);
    // No stints (a driver the roster gives no number), or none for the first laps: said, never counted as no stop.
    const note = out ? 'out' : !mine.length ? 'no data' : mine[0][1] > 1 ? 'partial' : `${stops} stop${stops === 1 ? '' : 's'}`;
    return `<div class="pd-pw-row"><span class="pd-pw-d">${tick(w.d, teamAt(w, row, c))}<b>${esc(code)}</b></span><span class="pd-pw-bar">${segs}<span class="pd-pw-g" style="--n:${total}"></span></span><span class="pd-pw-n">${note}</span></div>`;
  });
  const fives: number[] = [];
  for (let l = 5; l < total; l += 5) fives.push(l);
  const ticks = [
    '<span class="is-first" style="--l:0%">1</span>',
    ...fives.map(l => `<span${l % 10 ? ' class="o"' : ''} style="--l:${pct(l)}">${l}</span>`),
    total - (fives[fives.length - 1] ?? 0) >= 4 ? `<span class="is-last" style="--l:100%">${total}</span>` : '',
  ].join('');
  const keys = Object.keys(COMPOUNDS)
    .filter(k => [...byCar.values()].some(list => list.some(s => s[0] === k)))
    .map(k => `<span><i class="${COMPOUNDS[k][0]}"></i>${COMPOUNDS[k][2]}</span>`)
    .join('');
  return (
    `<div class="pd-pw"><span class="pd-pw-tip" role="status" hidden></span><div class="pd-pw-axis"><span class="pd-pw-d">Lap · ${total}</span><span class="pd-pw-scale">${ticks}</span><span></span></div>` +
    `${rows.join('')}<p class="pd-pw-key">${keys}<span>Point at a stint, or tap it, for its laps</span></p></div>`
  );
}

// ── The lap chart (O28) ──────────────────────────────────────────────────────

/** A classification's Time cell for a car that took the flag: a time, a gap ("+7.335", "+1 Lap") or Lapped. */
const TOOK_FLAG = /^(?:\+|\d)|^lapped$/i;
const NOT_STARTED = /did not start|^dns$|withdr/i;
const DISQUALIFIED = /disqualified|^dsq$/i;
const LAPS_CREDIT = 'Laps: Jolpica F1 · CC BY-NC-SA 4.0';

/** A driver's line: the store's places, the page's classification for the rest. */
interface LapLine {
  name: string;
  code: string;
  team: string;
  colour: string;
  /** A team's second driver, or a stand-in, by drivers.json's order: dashed. */
  second: boolean;
  /** Its row at lap 0: the grid slot, or after the last car on the grid from the pit lane. */
  start: number;
  pitLane: boolean;
  /** Its place at the end of each lap it ran. */
  places: number[];
  /** Its place in the classification; null for a driver the classification does not name. */
  fin: number | null;
  /** How the line ends: at the flag (a lapped car on its last lap), with a cross where the car stopped, or disqualified. */
  end: 'flag' | 'out' | 'dsq';
  /** The laps it pitted on (Jolpica's pit stops, none at a red flag's lap); null when the store holds none for the race. */
  stops: number[] | null;
}

const flagPlace = (l: LapLine): number | undefined => l.places[l.places.length - 1];
/** Crossed the line in one place and classified in another (a penalty after the flag): the dotted step and the †. */
const placedDifferently = (l: LapLine): boolean => l.end === 'flag' && l.fin !== null && l.places.length > 0 && flagPlace(l) !== l.fin;

/** The race's places lap by lap, joined to the page's own classification by name, else by surname as codeOf matches:
 *  the classification gives the team, the finish and how a line ends, so a ruling after the race (Monaco's appeal moved
 *  Gasly weeks later) lands by itself. A driver who did not start has no line; one the classification does not name is
 *  drawn without a finish. Null until the store holds the whole race. */
function lapLines(w: Weekend): { laps: number; rows: number; lines: LapLine[]; unjoined: string[] } | null {
  const t = tableOf(w, 'Race');
  const got = w.d.weekend?.laps?.[String(w.season)]?.[String(w.r.round)];
  if (!t || !isRaceLaps(got) || !(got.laps > 0)) return null;
  const c = cols(t);
  // Jolpica lists a tyre change under a red flag as a stop (21 of them on Monza's lap 3, 2026): race control's red
  // flags take them out.
  const reds = new Set((extrasOf(w, 'Race')?.marks?.red ?? []).map(r => r.lap));
  const unjoined: string[] = [];
  const lines: LapLine[] = [];
  for (const [name, grid, dotted, pitted] of got.drivers) {
    const row = t.rows.find(r => r[c.name] === name) ?? t.rows.find(r => sameDriver(r[c.name] ?? '', name));
    const status = row && c.time >= 0 ? (row[c.time] ?? '') : '';
    if (NOT_STARTED.test(status)) continue;
    if (!row) unjoined.push(name);
    const places = dotted ? dotted.split('.').map(Number) : [];
    const team = row ? teamAt(w, row, c) : '';
    const pos = row ? Number(row[c.pos]) : NaN;
    lines.push({
      name,
      code: codeOf(w.d, name),
      team,
      colour: colourOf(w.d, team),
      second: false,
      start: grid,
      pitLane: !(grid > 0),
      places,
      fin: Number.isInteger(pos) && pos > 0 ? pos : null,
      end: DISQUALIFIED.test(status) ? 'dsq' : !row || TOOK_FLAG.test(status) || (!status && places.length === got.laps) ? 'flag' : 'out',
      stops: typeof pitted === 'string' ? (pitted ? pitted.split('.').map(Number) : []).filter(lap => !reds.has(lap)) : null,
    });
  }
  const lastSlot = Math.max(0, ...lines.filter(l => !l.pitLane).map(l => l.start));
  let slot = lastSlot;
  for (const l of lines) if (l.pitLane) l.start = ++slot;
  const byTeam = new Map<string, LapLine[]>();
  for (const l of lines) if (l.team) byTeam.set(l.team, [...(byTeam.get(l.team) ?? []), l]);
  for (const [team, mates] of byTeam) [...mates].sort((a, b) => seatOf(w.d, team, a.name) - seatOf(w.d, team, b.name)).slice(1).forEach(l => (l.second = true));
  lines.sort((a, b) => (a.fin ?? Infinity) - (b.fin ?? Infinity) || a.start - b.start);
  const rows = Math.max(lines.length, ...lines.map(l => Math.max(l.start, l.fin ?? 0, ...l.places)));
  return { laps: got.laps, rows, lines, unjoined };
}

/** A name or a team for data-pd-laps, its separators taken out. */
const field = (s: string): string => s.replace(/[|;,]/g, ' ').trim();

/** The lap chart, on a race's page between the Classification and Pit wall (the operator's answers of 23 and 25 Oct):
 *  the theme's script draws it from data-pd-laps (the laps and rows, the safety car spans, then each driver: code,
 *  colour, dashed, start, from the pit lane, finish, how the line ends, places, stops, name, team) on Pit wall's lap
 *  scale. The key names only the marks the race has; without the script, the places stand as a table. */
function lapChart(w: Weekend, used: Used): string {
  const chart = lapLines(w);
  if (!chart?.lines.length) return '';
  const { laps, rows, lines } = chart;
  const spans = (extrasOf(w, 'Race')?.marks?.neutral ?? []).filter(s => s.from >= 1 && s.from <= laps && s.to >= s.from).map(s => ({ ...s, to: Math.min(s.to, laps) }));
  if (spans.length) used.marks = true;
  const ends = { flag: 'f', out: 'x', dsq: 'd' } as const;
  const data = [
    `${laps} ${rows}`,
    spans.map(s => `${s.kind} ${s.from} ${s.to}`).join(','),
    lines
      .map(l =>
        [field(l.code), l.colour, l.second ? 1 : 0, l.start, l.pitLane ? 1 : 0, l.fin ?? '', ends[l.end], l.places.join('.'), l.stops === null ? '-' : l.stops.join('.'), field(l.name), field(teamLabel(l.team))].join(','),
      )
      .join(';'),
  ].join('|');
  const key = [
    lines.some(l => l.stops?.length) ? '<span class="pd-lc-k"><i class="pd-lc-kp"></i>Pit stop</span>' : '',
    lines.some(l => l.end === 'out') ? '<span class="pd-lc-k"><i class="pd-lc-kx"></i>Out of the race</span>' : '',
    spans.some(s => s.kind === 'SC') ? '<span class="pd-lc-k"><i class="pd-lc-kb">SC</i>Safety car</span>' : '',
    spans.some(s => s.kind === 'VSC') ? '<span class="pd-lc-k"><i class="pd-lc-kb">VSC</i>Virtual safety car</span>' : '',
    lines.some(l => l.second) ? '<span class="pd-lc-k"><i class="pd-lc-kd"></i>The team’s second driver</span>' : '',
    lines.some(placedDifferently) ? '<span class="pd-lc-k"><b>†</b> placed differently in the result than at the flag</span>' : '',
  ].join('');
  // Every tenth lap, so Monaco's 78 fit, then the flag; a car out of the race reads "out" once.
  const tens: number[] = [];
  for (let l = 10; l < laps; l += 10) tens.push(l);
  const withStops = lines.some(l => l.stops !== null);
  const head =
    `<tr><th class="p">Finish</th><th class="d">Code</th><th class="dn">Driver</th><th class="tm">Team</th><th class="n">Grid</th>${tens.map((l, i) => `<th class="n">${i ? '' : 'Lap '}${l}</th>`).join('')}` +
    `<th class="n">Flag</th>${withStops ? '<th class="n">Stops on lap</th>' : ''}</tr>`;
  const body = lines
    .map(l => {
      let said = false;
      const at = (lap: number): string => {
        if (lap <= l.places.length) return String(l.places[lap - 1]);
        if (l.end !== 'out' || said) return '–';
        said = true;
        return 'out';
      };
      const fin = l.end === 'dsq' ? 'DSQ' : l.fin === null ? '–' : `${l.fin}${placedDifferently(l) ? '†' : ''}`;
      const cells = tens.map(at);
      const flag = l.end === 'out' ? at(laps) : String(flagPlace(l) ?? '–');
      const stops = l.stops === null ? '–' : l.stops.length ? l.stops.join(', ') : 'none';
      return (
        `<tr><td class="p">${fin}</td><td class="d">${tick(w.d, l.team)}<b>${esc(l.code)}</b></td><td class="dn">${esc(l.name)}</td><td class="tm">${esc(teamLabel(l.team))}</td>` +
        `<td class="n">${l.pitLane ? 'PL' : l.start}</td>${cells.map(v => `<td class="n">${v}</td>`).join('')}<td class="n">${flag}</td>${withStops ? `<td class="n">${stops}</td>` : ''}</tr>`
      );
    })
    .join('');
  const label = `Lap chart of the ${w.r.name}: each driver’s place at the end of each of its ${laps} laps. Arrow keys follow a driver; the table below holds the same places.`;
  return section(
    'Lap chart',
    'Each driver’s place at the end of every lap',
    `<div class="pd-lc"><p class="pd-lc-read" role="status" hidden></p><div class="pd-lc-draw" role="img" aria-label="${esc(label)}" data-pd-laps="${esc(data)}"></div>` +
      `<p class="pd-lc-key">${key}<span class="pd-lc-credit">${LAPS_CREDIT}</span></p>` +
      `<details class="pd-lc-tbl"><summary>Places as a table</summary><div class="pd-wk-scroll"><table class="pd-wk-tbl pd-lc-t"><thead>${head}</thead><tbody>${body}</tbody></table></div></details></div>`,
    'lap-chart',
  );
}

/** Each race's lap chart notes for the publisher's log: the drivers placed differently in the result than at the flag,
 *  which from Austin on are marked from the two tables alone (the operator's answer B, 25 Oct), and the names the
 *  classification does not hold. */
export function lapChartNotes(d: SeriesData): { round: number; differs: string[]; unjoined: string[] }[] {
  const season = d.season;
  if (!WEEKEND_PAGES.has(d.slug) || !season) return [];
  return (d.rounds ?? []).flatMap(r => {
    const chart = lapLines(weekendOf(d, season, r));
    const differs = (chart?.lines ?? []).filter(placedDifferently).map(l => `${l.code} P${flagPlace(l)}→P${l.fin}`);
    return chart && (differs.length || chart.unjoined.length) ? [{ round: r.round, differs, unjoined: chart.unjoined }] : [];
  });
}

/** A session's card: its time (yours and the track's), its weather, any mark, its leading results, a way to its page. */
function sessionCard(w: Weekend, e: CalendarEntry, used: Used): string {
  const t = tableOf(w, e.session);
  const x = extrasOf(w, e.session);
  const n = CARD_ROWS[e.session] ?? 3;
  const at = x?.marks?.late?.started ?? e.start;
  const c = t ? cols(t) : null;
  const rows =
    t && c
      ? t.rows
          .slice(0, n)
          .map(
            row =>
              `<li><span class="p">${esc(row[c.pos] ?? '')}</span>${tick(w.d, teamAt(w, row, c))}<b>${esc(codeOf(w.d, row[c.name] ?? ''))}</b><span class="nm">${esc(row[c.name] ?? '')}</span>` +
              `<span class="tt">${esc(bestTime(t, row))}</span>${c.pts >= 0 ? `<span class="pp">${esc(row[c.pts] ?? '')}</span>` : ''}</li>`,
          )
          .join('')
      : '';
  const wx = t ? measured(x, used) : forecast(w, e.start, used);
  return (
    `<article class="pd-sc${n === 3 ? ' is-sm' : ''}"><header><div><h3>${esc(e.session)}</h3><p>${yours(at, 'wt')} your time · ${trackWeekday(w, at)} ${trackTime(w, at)} at the track</p>${marks(w, e.session, used)}</div>${wx}</header>` +
    `${rows ? `<ol class="pd-sc-rows">${rows}</ol>` : ''}<a class="pd-sc-go" href="${sessionPath(w, e.session)}">${t ? `All ${t.rows.length} on its page` : 'Its page'} →</a></article>`
  );
}

/** Sessions still to run, by the track's day: your time and the track's, the forecast, a way to each page. */
function weekendRows(w: Weekend, list: CalendarEntry[], used: Used): string {
  const days = new Map<string, CalendarEntry[]>();
  for (const e of list) {
    const day = trackDay(w, e.start);
    days.set(day, [...(days.get(day) ?? []), e]);
  }
  return [...days]
    .map(
      ([day, es]) =>
        `<h3 class="pd-wk-day">${esc(day)}</h3><div class="pd-wk-rows">` +
        es
          .map(
            e =>
              `<a class="pd-wk-row" href="${sessionPath(w, e.session)}"><span class="pd-wk-when"><b>${yours(e.start, 'wt')}</b><small>Track ${trackTime(w, e.start)}</small></span>` +
              `<span class="pd-wk-name">${esc(e.session)}</span>${forecast(w, e.start, used) || '<span class="pd-wk-wx"></span>'}<span class="pd-wk-go"><span class="t">Its page</span> →</span></a>`,
          )
          .join('') +
        '</div>',
    )
    .join('');
}

interface Standing {
  name: string;
  team: string;
  pts: number;
}

/** The drivers' championship after a round: the official table after the latest round raced (it carries any
 *  penalty), else the points summed from the stored races and sprints, drivers level on points split on their Grand
 *  Prix finishes (countback; sprints not counted). */
function championship(d: SeriesData, after: number): Standing[] {
  const raced = [...raceWins(d).keys()];
  const official = d.standings?.[0];
  if (official && raced.length && after >= Math.max(...raced)) {
    const name = col(official.columns, 'Driver');
    const team = col(official.columns, 'Team');
    const pts = col(official.columns, 'Pts', 'Points');
    if (name >= 0 && pts >= 0) return official.rows.map(row => ({ name: row[name], team: team >= 0 ? row[team] : '', pts: Number.parseFloat(row[pts]) || 0 }));
  }
  const pts = new Map<string, number>();
  const team = new Map<string, string>();
  const places = new Map<string, number[]>();
  for (const r of d.results ?? []) {
    if (r.round === null || r.round > after) continue;
    for (const s of r.sessions) {
      const t = s.tables[0];
      if (!t) continue;
      const c = cols(t);
      if (c.name < 0 || c.pts < 0) continue;
      for (const row of t.rows) {
        pts.set(row[c.name], (pts.get(row[c.name]) ?? 0) + (Number.parseFloat(row[c.pts]) || 0));
        if (c.team >= 0) team.set(row[c.name], row[c.team]);
        const p = Number(row[c.pos]);
        if (s.label === 'Race' && p > 0) {
          const list = places.get(row[c.name]) ?? [];
          list[p] = (list[p] ?? 0) + 1;
          places.set(row[c.name], list);
        }
      }
    }
  }
  const countback = (a: string, b: string): number => {
    const x = places.get(a) ?? [];
    const y = places.get(b) ?? [];
    for (let p = 1; p <= 30; p++) {
      const diff = (y[p] ?? 0) - (x[p] ?? 0);
      if (diff) return diff;
    }
    return 0;
  };
  return [...pts.entries()].map(([name, p]) => ({ name, team: team.get(name) ?? '', pts: p })).sort((a, b) => b.pts - a.pts || countback(a.name, b.name));
}

function nextRound(w: Weekend): string {
  const rounds = w.d.rounds ?? [];
  const next = rounds.find(x => x.round === w.r.round + 1);
  const prev = rounds.find(x => x.round === w.r.round - 1);
  const card = next
    ? `<a class="pd-wk-next" href="${weekendPath(w.d.slug, w.season, next.round)}"><small>Next round · ${next.round}</small><b>${esc(next.name)}</b><span>${next.place ? `${esc(next.place)} · ` : ''}${longDates(next.startDate, next.endDate)}</span>${outline(next.outline, ' pd-wk-ol')}</a>`
    : '';
  const back = prev ? `<a class="pd-wk-prev" href="${weekendPath(w.d.slug, w.season, prev.round)}">‹ Round ${prev.round} · ${esc(prev.name)}</a>` : '';
  return card + back;
}

/** The side: the championship before or after the round, the track (its zone beside the reader's), the next round. */
function aside(w: Weekend, raced: boolean): string {
  // A round further off than the next shows the table as it stands, after the latest round raced.
  const latest = Math.max(0, ...raceWins(w.d).keys());
  const after = raced ? w.r.round : Math.min(w.r.round - 1, latest);
  const title = raced || after < w.r.round - 1 ? `after round ${after}` : `before round ${w.r.round}`;
  const top = after > 0 ? championship(w.d, after).slice(0, 5) : [];
  const lead = top[0]?.pts ?? 0;
  const more = built(w.d.slug, 'standings') ? `<a class="pd-wk-more" href="${seriesPath(w.d.slug, 'standings')}">Full standings →</a>` : '<span class="pd-wk-more is-off">Full standings →</span>';
  const champ = top.length
    ? `<section class="pd-wk-box pd-wk-champ"><h3>Championship ${title}</h3><ol>${top
        .map(
          (s, i) =>
            `<li><span class="p">${i + 1}</span>${tick(w.d, s.team)}<span class="d"><b>${esc(s.name)}</b><small>${esc(teamLabel(s.team))}</small></span><span class="g">${i ? `−${Math.round((lead - s.pts) * 10) / 10}` : 'Leader'}</span><b class="pt">${s.pts}</b></li>`,
        )
        .join('')}</ol>${more}</section>`
    : '';
  // The track's offset, and the reader's in the script, both at the weekend's first session: a change of clocks between
  // today and the weekend (Europe's on 25 October) must not shift the hours between them.
  const at = w.sessions[0]?.start ?? `${w.r.startDate}T12:00:00Z`;
  const off = offsetOf(w.tz, at);
  const zone = w.tz === 'UTC' && !w.r.tz ? '' : `<dt>Track time</dt><dd>${utcLabel(off)}<span class="pd-wk-ahead" data-pd-ahead="${off}" data-pd-at="${esc(at)}"></span></dd>`;
  const track =
    `<section class="pd-wk-box"><h3>At the track</h3><dl>${w.r.venue ? `<dt>Circuit</dt><dd>${esc(w.r.venue)}</dd>` : ''}${w.r.country ? `<dt>Country</dt><dd>${esc(w.r.country)}</dd>` : ''}` +
    `${zone}<dt>Format</dt><dd>${sprintWeekend(w.d, w.r.round, w.result) ? 'Sprint weekend' : 'Standard weekend'}</dd></dl></section>`;
  return `<aside class="pd-wk-aside">${champ}${track}${nextRound(w)}</aside>`;
}

const section = (title: string, hint: string, body: string, id?: string): string =>
  `<section class="pd-wk-sec"${id ? ` id="${id}"` : ''}><div class="pd-wk-sh"><h2>${title}</h2>${hint ? `<p class="pd-wk-hint">${hint}</p>` : ''}</div>${body}</section>`;

// ── The pages ────────────────────────────────────────────────────────────────

/** A round's Overview: after its race, the result, Pit wall, the weekend's points (sprint weekends) and the earlier
 *  sessions' cards; before it, the sessions run so far as cards and the rest by day with their forecasts. */
function overviewPage(w: Weekend): Page {
  const used = nothingUsed();
  const race = tableOf(w, 'Race');
  const run = w.sessions.filter(e => tableOf(w, e.session));
  const ahead = w.sessions.filter(e => !tableOf(w, e.session));
  const parts: string[] = [];
  if (race) {
    const x = extrasOf(w, 'Race');
    const e = w.sessions.find(s => s.session === 'Race');
    const at = x?.marks?.late?.started ?? e?.start;
    const wx = x?.weather;
    if (wx) used.weather = true;
    const hint = [at ? `${yours(at, 't')} your time` : '', wx ? `air ${wx.air[1]}°${wx.track ? `, track ${wx.track[1]}°` : ''}, ${wx.rain ? 'rain' : 'dry'}` : ''].filter(Boolean).join(' · ');
    // The lap chart lives on the race's page; the Overview links it once the race's laps are stored (O28).
    const chart = lapLines(w)?.lines.length ? `<a class="pd-wk-link" href="${sessionPath(w, 'Race')}#lap-chart">Lap chart</a>` : '';
    const links = `<p class="pd-wk-links"><a class="pd-wk-link" href="${sessionPath(w, 'Race')}">All ${race.rows.length} on the race's page</a>${chart}</p>`;
    parts.push(section('Race result', hint, `${marks(w, 'Race', used)}${podium(w, race)}${classTable(w, race, RACE_ROWS)}${links}`));
    const wall = pitWall(w, 'Race', PIT_WALL_ROWS, used);
    if (wall) parts.push(section('Pit wall', 'Each driver’s tyres and stops, lap by lap', wall));
    const points = sprintWeekend(w.d, w.r.round, w.result) && w.result ? pointsTable(w.d, weekendPoints(w.result), true) : '';
    if (points) parts.push(section('The weekend’s points', '', points));
    const earlier = run.filter(e2 => e2.session !== 'Race');
    if (earlier.length) parts.push(section('Earlier in the weekend', 'Each session’s leading results, in the order they ran', `<div class="pd-sc-grid">${earlier.map(e2 => sessionCard(w, e2, used)).join('')}</div>`));
  } else {
    if (run.length) parts.push(section('Done so far', 'Each finished session’s leading results', `<div class="pd-sc-grid">${run.map(e => sessionCard(w, e, used)).join('')}</div>`));
    if (ahead.length) {
      const rows = weekendRows(w, ahead, used);
      const note =
        '<p class="pd-wk-note">A session’s forecast is for its start while it is within ten days: the rain over that hour, or over six hours when it is further off. After it, the weather measured at the track; each session’s results join this page as it ends.</p>';
      parts.push(section(run.length ? 'Still to come' : 'The weekend', 'The track’s days: your time, the track’s underneath', rows + note));
    }
    if (!w.sessions.length) parts.push(section('The weekend', '', '<p class="pd-wk-empty">The weekend’s session times are not published yet; they appear here as soon as they are.</p>'));
  }
  const body =
    `<div class="pd-wkp pd-s-${esc(w.d.slug)}">${weekendBand(w)}${strip(w)}${weekendBar(w, null)}` +
    `<div class="pd-wk-main"><div class="pd-wk-col">${parts.join('')}</div>${aside(w, Boolean(race))}</div>${circuit(w, used)}${credit(used)}</div>`;
  return { path: w.path, title: `${w.r.name} ${w.season}`, body: htmlBlock(body), template: 'page-wide' };
}

/** A session's own page: its classification (every driver, every part), race control's marks, Pit wall for a race or
 *  a sprint, and the weather measured through it, or its forecast before it runs. */
function sessionPage(w: Weekend, e: CalendarEntry): Page {
  const used = nothingUsed();
  const t = tableOf(w, e.session);
  const x = extrasOf(w, e.session);
  const at = x?.marks?.late?.started ?? e.start;
  const band =
    `<section class="pd-ss-band"><div class="pd-ss-band-in"><p class="pd-wk-crumb"><a href="${seriesPath(w.d.slug)}">${esc(w.d.name)}</a> › <a href="${seasonPath(w.d.slug, w.season)}">${w.season}</a> › ` +
    `<a href="${w.path}">Round ${w.r.round} · ${esc(w.r.name)}</a></p><h1>${esc(e.session)}</h1><p class="pd-ss-sub">${esc(trackDay(w, at))} · ${trackTime(w, at)} at the track, ${yours(at, 'wt')} your time</p></div></section>`;
  const parts: string[] = [];
  if (t) {
    const hint = /^S?Q\d$/.test(t.columns[t.columns.length - 1] ?? '') ? `All ${t.rows.length}, as classified; each driver’s best time in each part` : `All ${t.rows.length}, as classified`;
    parts.push(section('Classification', hint, `${marks(w, e.session, used)}${classTable(w, t)}`));
    const chart = e.session === 'Race' ? lapChart(w, used) : '';
    if (chart) parts.push(chart);
    if (/^(race|sprint)$/i.test(e.session)) {
      const wall = pitWall(w, e.session, Infinity, used);
      if (wall) parts.push(section('Pit wall', 'Each driver’s tyres and stops, lap by lap', wall));
    }
  } else {
    parts.push(section('Classification', '', `${marks(w, e.session, used)}<p class="pd-wk-empty">Not run yet. Its results join this page when it ends.</p>`));
  }
  const wx = x?.weather;
  let weather = '';
  if (t && wx) {
    used.weather = true;
    weather =
      `<section class="pd-wk-box"><h3>Weather at the track</h3><dl><dt>Air</dt><dd>${wx.air[0]}–${wx.air[2]} °C</dd>${wx.track ? `<dt>Track</dt><dd>${wx.track[0]}–${wx.track[2]} °C</dd>` : ''}` +
      `${wx.humidity ? `<dt>Humidity</dt><dd>${wx.humidity[0]}–${wx.humidity[1]} %</dd>` : ''}<dt>Rain</dt><dd>${wx.rain ? 'Yes' : 'None'}</dd></dl><p class="pd-wk-src">Measured through the session</p></section>`;
  } else if (!t) {
    const f = forecast(w, e.start, used);
    const src = forecastStep(w, e.start)?.hours === 6 ? 'The sky and rain over the six hours it starts in' : 'For the hour it starts';
    if (f) weather = `<section class="pd-wk-box"><h3>Forecast for its start</h3><div class="pd-wk-fc">${f}</div><p class="pd-wk-src">${src}</p></section>`;
  }
  const body =
    `<div class="pd-wkp pd-s-${esc(w.d.slug)}">${band}${weekendBar(w, e.session)}` +
    `<div class="pd-wk-main"><div class="pd-wk-col">${parts.join('')}</div><aside class="pd-wk-aside">${weather}${nextRound(w)}</aside></div>${credit(used)}</div>`;
  return { path: sessionPath(w, e.session), title: `${w.r.name} ${w.season}: ${e.session}`, body: htmlBlock(body), template: 'page-wide' };
}

/** The season: a tile a weekend in date order, each opening its weekend page; a moved round also where it was first
 *  set, and a round called off, struck through. */
function seasonPage(d: SeriesData, season: number): Page {
  const wins = raceWins(d);
  const rounds = d.rounds ?? [];
  const current = rounds.find(r => !wins.has(r.round));
  const tiles: { at: string; html: string }[] = [];
  for (const r of rounds) {
    const w = wins.get(r.round);
    const page = weekendPath(d.slug, season, r.round);
    const state = w
      ? `<span>${tick(d, w.team)}${esc(w.winner)}</span>`
      : r === current
        ? `<span class="pd-sn-next">${wk(r, 'Next', 'This weekend')}</span>`
        : '<span></span>';
    tiles.push({
      at: r.startDate,
      html: `<a class="pd-sn-t${r === current ? ' is-now' : ''}" href="${page}"${w ? ` style="--t:${colourOf(d, w.team)}"` : ''}><small>Round ${r.round} · ${dates(r.startDate, r.endDate)}</small><b>${esc(r.name)}</b>${state}${outline(r.outline)}</a>`,
    });
    if (r.moved?.from && r.moved.to) {
      tiles.push({
        at: r.moved.from,
        html: `<a class="pd-sn-t is-moved" href="${page}"><small>Was ${dates(r.moved.from, r.moved.to)}</small><b>${esc(r.name)}</b><span>Moved to round ${r.round}${r.place ? `: ${esc(r.place)}` : ''}, ${dates(r.startDate, r.endDate)}</span></a>`,
      });
    }
  }
  for (const c of d.cancelled ?? []) {
    tiles.push({
      at: c.from ?? '',
      html: `<span class="pd-sn-t is-off"><small>Called off${c.from && c.to ? ` · was ${dates(c.from, c.to)}` : ''}</small><b>${esc(c.name)}</b><span>${esc(c.reason ?? `Round ${c.round}`)}</span></span>`,
    });
  }
  tiles.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const main =
    `<div class="pd-sr pd-s-${esc(d.slug)}">${band(d, wins, current)}${tabs(d, null)}<div class="pd-sr-main"><section class="pd-sr-sec">` +
    `<div class="pd-sh"><h2>The ${season} season</h2><p>${rounds.length} rounds · ${wins.size} run</p></div><div class="pd-sn">${tiles.map(t => t.html).join('')}</div></section></div></div>`;
  return { path: seasonPath(d.slug, season), title: `${d.name} ${season}`, body: htmlBlock(main), template: 'page-wide' };
}

/** A series' weekend pages (O19): its season, each round's Overview and each timed session's page; none for a series
 *  without them or without a season. */
export function weekendPages(d: SeriesData): Page[] {
  if (!WEEKEND_PAGES.has(d.slug) || !d.season || !d.rounds?.length) return [];
  const pages: Page[] = [seasonPage(d, d.season)];
  for (const r of d.rounds) {
    const w = weekendOf(d, d.season, r);
    pages.push(overviewPage(w), ...w.sessions.map(e => sessionPage(w, e)));
  }
  return pages;
}
