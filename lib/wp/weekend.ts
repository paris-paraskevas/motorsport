// Formula 1's weekend pages (slot O19, its second PR): the season at /series/<slug>/<season>/, each round's Overview at
// round-<n>/ and a page per session under it, as the operator approved them on Paddock Weekend Drafts (version 3) and
// full width (O27). Pure, as series.ts: the stored results and timetable, the weekend data the publisher keeps
// (lib/openf1/weekend.ts, lib/met-norway.ts) and the repository's content in, block markup out. The reader's times go
// out in UTC as `.pd-t[data-utc]`; the track's are written here, in the circuit's zone. What a page shows follows its
// data, never the hour it is written (a session with a result has run), so a page changes only when its data does.
// WordPress keeps no inline SVG and no inline style but width and custom properties: the Pit wall places its stints
// with --l and --w, and the theme's script (wp-theme/paddock/assets/js/paddock.js) draws the circuit from data-pd-map.

import { stepFor, symbolLabel } from '@/lib/met-norway';
import { isMap, type SessionExtras } from '@/lib/openf1/weekend';
import { escapeHtml, seasonPath, seriesPath, sessionSlug, WEEKEND_PAGES, weekendPath, type CalendarEntry, type CalendarRound, type Page, type ResultRound, type SeriesData, type Table } from './render';
import { band, built, codeOf, col, colourOf, dates, htmlBlock, numberOf, outline, pointsTable, raceWins, sprintWeekend, tabs, teamLabel, tick, weekendPoints, wk } from './series';

/** The rows a session's card leads with (the operator, 22 Oct): three in practice, ten in qualifying and sprint
 *  qualifying, the eight who score in a sprint, ten in the race. */
const CARD_ROWS: Readonly<Record<string, number>> = { Race: 10, Sprint: 8, Qualifying: 10, 'Sprint Qualifying': 10 };
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
}

/** Which sources a page drew on, for its credit line: OpenF1's measured data, MET Norway's forecast. */
interface Used {
  of1: boolean;
  met: boolean;
}

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
  return { d, season, r, result: (d.results ?? []).find(x => x.round === r.round), sessions, tz, path: weekendPath(d.slug, season, r.round) };
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
  used.of1 = true;
  return `<span class="pd-wk-wx"><b>${w.air[1]}°</b><small>air · ${w.track ? `track ${w.track[1]}° · ` : ''}${w.rain ? 'rain' : 'dry'}</small></span>`;
}

/** MET Norway's forecast for the hour a session starts in, while the publisher holds one for its circuit. */
function forecast(w: Weekend, iso: string, used: Used): string {
  const f = w.r.circuit ? w.d.weekend?.forecast?.[w.r.circuit] : undefined;
  const s = f ? stepFor(f.steps, iso) : null;
  if (!s) return '';
  used.met = true;
  const what = [symbolLabel(s.symbol), s.mm === null ? '' : `${s.mm} mm`].filter(Boolean).join(' · ');
  return `<span class="pd-wk-wx"><b>${s.air}°</b><small>${esc(what)}</small></span>`;
}

/** Race control's marks on a session: a late start, and each red flag with its lap and whether the session started again. */
function marks(w: Weekend, label: string): string {
  const m = extrasOf(w, label)?.marks;
  if (!m) return '';
  const out: string[] = [];
  if (m.late) {
    const mins = Math.round((Date.parse(m.late.started) - Date.parse(m.late.planned)) / 60_000);
    if (mins > 0) out.push(`<em class="pd-wk-mark">Started ${mins} minute${mins === 1 ? '' : 's'} late</em>`);
  }
  for (const red of m.red ?? []) out.push(`<em class="pd-wk-mark is-red">Red flag${red.lap ? ` on lap ${red.lap}` : ''} · ${red.restarted ? 'restarted' : 'not restarted'}</em>`);
  return out.length ? `<span class="pd-wk-marks">${out.join('')}</span>` : '';
}

// ── The parts every page of a weekend shares ─────────────────────────────────

function weekendBand(w: Weekend): string {
  const { d, r } = w;
  const where = [r.venue ?? '', r.country ?? ''].filter(Boolean).map(esc).join(', ');
  const note = r.moved?.note ? r.moved.note.charAt(0).toUpperCase() + r.moved.note.slice(1) : '';
  const moved = note ? `<em class="pd-wk-tag">${esc(note)}${r.moved?.from && r.moved.to ? `, first set for ${longDates(r.moved.from, r.moved.to)}` : ''}</em>` : '';
  return (
    `<section class="pd-wk-band"><div class="pd-wk-band-in"><p class="pd-wk-crumb"><a href="${seriesPath(d.slug)}">${esc(d.name)}</a> › <a href="${seasonPath(d.slug, w.season)}">${w.season} season</a> › Round ${r.round} of ${(d.rounds ?? []).length}</p>` +
    `<h1>${esc(r.name)}</h1><p class="pd-wk-where">${where}${where ? ' · ' : ''}${longDates(r.startDate, r.endDate)}</p>${moved}<span class="pd-wk-num" aria-hidden="true">${r.round}</span></div></section>`
  );
}

/** One bar for every page of a weekend: its Overview, then each session's page with its time (and its winner once
 *  run), the page you are on lit, a session still to run dashed. */
function weekendBar(w: Weekend, current: string | null): string {
  const here = (on: boolean) => (on ? ' aria-current="page"' : '');
  const items = [`<a href="${w.path}"${here(current === null)}>Overview<small>the weekend</small></a>`];
  for (const e of w.sessions) {
    const t = tableOf(w, e.session);
    const who = t ? ` · ${esc(codeOf(w.d, t.rows[0][cols(t).name] ?? ''))}` : '';
    items.push(`<a href="${sessionPath(w, e.session)}"${here(e.session === current)}${t ? '' : ' class="is-up"'}>${esc(e.session)}<small>${yours(e.start, 'wt')}${who}</small></a>`);
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
  used.of1 = true;
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

/** The sources a page drew on, as their terms ask: OpenF1 (CC BY-NC-SA 4.0), MET Norway (CC BY 4.0). */
function credit(used: Used): string {
  const parts = [
    used.of1 ? 'Weather, race control, tyres and the circuit’s lap from <a href="https://openf1.org/">OpenF1</a>' : '',
    used.met ? 'Forecasts: Data from <a href="https://www.met.no/en">MET Norway</a>' : '',
  ].filter(Boolean);
  return parts.length ? `<p class="pd-wk-credit">${parts.join(' · ')}</p>` : '';
}

// ── The Overview's parts ─────────────────────────────────────────────────────

function podium(w: Weekend, t: Table): string {
  const c = cols(t);
  const items = t.rows.slice(0, 3).map(
    row =>
      `<li style="--t:${colourOf(w.d, row[c.team] ?? '')}"><small>${row[c.pos] === '1' ? 'Winner' : `P${esc(row[c.pos] ?? '')}`}</small><b>${esc(row[c.name] ?? '')}</b>` +
      `<span>${esc(teamLabel(row[c.team] ?? ''))}</span><em>${esc(c.time >= 0 ? (row[c.time] ?? '') : '')}</em></li>`,
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
        `<tr><td class="p">${esc(row[c.pos] ?? '')}</td><td class="d">${tick(w.d, row[c.team] ?? '')}<b>${esc(codeOf(w.d, row[c.name] ?? ''))}</b><span>${esc(row[c.name] ?? '')}</span></td>` +
        `<td class="tm">${esc(teamLabel(row[c.team] ?? ''))}</td>${figures.map(i => `<td class="${kind(i)}">${esc(row[i] ?? '') || '–'}</td>`).join('')}</tr>`,
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
  used.of1 = true;
  const byCar = new Map(stints);
  const c = cols(t);
  const pct = (v: number): string => `${((v / total) * 100).toFixed(2)}%`;
  const rows = t.rows.slice(0, limit).map(row => {
    const name = row[c.name] ?? '';
    const code = codeOf(w.d, name);
    const n = numberOf(w.d, name);
    const mine = n === null ? [] : (byCar.get(n) ?? []);
    const out = /retired|dnf|dns|dsq|disqualified/i.test(c.time >= 0 ? (row[c.time] ?? '') : '');
    const segs = mine
      .map(([compound, a, b], i) => {
        // OpenF1 writes UNKNOWN for a stint whose tyre it did not record (Norris's third in round 11's race).
        const [cls, letter, word] = COMPOUNDS[compound] ?? ['pd-c-u', '?', 'Tyre not recorded'];
        const laps = a === b ? `lap ${a}` : `laps ${a}–${b}`;
        const end = i < mine.length - 1 ? `pitted at the end of lap ${b}` : out ? `out on lap ${b}` : 'to the flag';
        const tip = `${code} · ${word} · ${laps} · ${end}`;
        return `<i class="${cls}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" style="--l:${pct(a - 1)};--w:${pct(b - a + 1)}">${letter}</i>`;
      })
      .join('');
    const stops = Math.max(0, mine.length - 1);
    const note = !mine.length ? '' : out ? 'out' : `${stops} stop${stops === 1 ? '' : 's'}`;
    return `<div class="pd-pw-row"><span class="pd-pw-d">${tick(w.d, row[c.team] ?? '')}<b>${esc(code)}</b></span><span class="pd-pw-bar">${segs}<span class="pd-pw-g" style="--n:${total}"></span></span><span class="pd-pw-n">${note}</span></div>`;
  });
  const fives: number[] = [];
  for (let l = 5; l < total; l += 5) fives.push(l);
  const ticks = [
    '<span class="is-first" style="--l:0%">1</span>',
    ...fives.map(l => `<span${l % 10 ? ' class="o"' : ''} style="--l:${pct(l)}">${l}</span>`),
    total - (fives[fives.length - 1] ?? 0) >= 4 ? `<span class="is-last" style="--l:100%">${total}</span>` : '',
  ].join('');
  const keys = Object.keys(COMPOUNDS)
    .filter(k => stints.some(([, list]) => list.some(s => s[0] === k)))
    .map(k => `<span><i class="${COMPOUNDS[k][0]}"></i>${COMPOUNDS[k][2]}</span>`)
    .join('');
  return (
    `<div class="pd-pw"><span class="pd-pw-tip" role="status" hidden></span><div class="pd-pw-axis"><span class="pd-pw-d">Lap · ${total}</span><span class="pd-pw-scale">${ticks}</span><span></span></div>` +
    `${rows.join('')}<p class="pd-pw-key">${keys}<span>Point at a stint, or tap it, for its laps</span></p></div>`
  );
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
              `<li><span class="p">${esc(row[c.pos] ?? '')}</span>${tick(w.d, row[c.team] ?? '')}<b>${esc(codeOf(w.d, row[c.name] ?? ''))}</b><span class="nm">${esc(row[c.name] ?? '')}</span>` +
              `<span class="tt">${esc(bestTime(t, row))}</span>${c.pts >= 0 ? `<span class="pp">${esc(row[c.pts] ?? '')}</span>` : ''}</li>`,
          )
          .join('')
      : '';
  const wx = t ? measured(x, used) : forecast(w, e.start, used);
  return (
    `<article class="pd-sc${n === 3 ? ' is-sm' : ''}"><header><div><h3>${esc(e.session)}</h3><p>${yours(at, 'wt')} your time · ${trackWeekday(w, at)} ${trackTime(w, at)} at the track</p>${marks(w, e.session)}</div>${wx}</header>` +
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
  const after = raced ? w.r.round : w.r.round - 1;
  const top = after > 0 ? championship(w.d, after).slice(0, 5) : [];
  const lead = top[0]?.pts ?? 0;
  const more = built(w.d.slug, 'standings') ? `<a class="pd-wk-more" href="${seriesPath(w.d.slug, 'standings')}">Full standings →</a>` : '<span class="pd-wk-more is-off">Full standings →</span>';
  const champ = top.length
    ? `<section class="pd-wk-box pd-wk-champ"><h3>Championship ${raced ? 'after' : 'before'} round ${w.r.round}</h3><ol>${top
        .map(
          (s, i) =>
            `<li><span class="p">${i + 1}</span>${tick(w.d, s.team)}<span class="d"><b>${esc(s.name)}</b><small>${esc(teamLabel(s.team))}</small></span><span class="g">${i ? `−${Math.round((lead - s.pts) * 10) / 10}` : 'Leader'}</span><b class="pt">${s.pts}</b></li>`,
        )
        .join('')}</ol>${more}</section>`
    : '';
  const at = w.sessions[0]?.start ?? `${w.r.startDate}T12:00:00Z`;
  const off = offsetOf(w.tz, at);
  const zone = w.tz === 'UTC' && !w.r.tz ? '' : `<dt>Track time</dt><dd>${utcLabel(off)}<span class="pd-wk-ahead" data-pd-ahead="${off}"></span></dd>`;
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
  const used: Used = { of1: false, met: false };
  const race = tableOf(w, 'Race');
  const run = w.sessions.filter(e => tableOf(w, e.session));
  const ahead = w.sessions.filter(e => !tableOf(w, e.session));
  const parts: string[] = [];
  if (race) {
    const x = extrasOf(w, 'Race');
    const e = w.sessions.find(s => s.session === 'Race');
    const at = x?.marks?.late?.started ?? e?.start;
    if (x?.weather) used.of1 = true;
    const wx = x?.weather;
    const hint = [at ? `${yours(at, 't')} your time` : '', wx ? `air ${wx.air[1]}°${wx.track ? `, track ${wx.track[1]}°` : ''}, ${wx.rain ? 'rain' : 'dry'}` : ''].filter(Boolean).join(' · ');
    parts.push(section('Race result', hint, `${marks(w, 'Race')}${podium(w, race)}${classTable(w, race, 10)}<a class="pd-wk-link" href="${sessionPath(w, 'Race')}">All ${race.rows.length} on the race's page</a>`));
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
      const note = '<p class="pd-wk-note">A session’s forecast is for the hour it starts, while it is within ten days; after it, the weather measured at the track. Each session’s results join this page as it ends.</p>';
      parts.push(section(run.length ? 'Still to come' : 'The weekend', 'The track’s days: your time, the track’s underneath', rows + note));
    }
    if (!w.sessions.length) parts.push(section('The weekend', '', '<p class="pd-wk-empty">The weekend’s session times are not published yet; they appear here as soon as they are.</p>'));
  }
  const body =
    `<div class="pd-wk pd-s-${esc(w.d.slug)}">${weekendBand(w)}${strip(w)}${weekendBar(w, null)}` +
    `<div class="pd-wk-main"><div class="pd-wk-col">${parts.join('')}</div>${aside(w, Boolean(race))}</div>${circuit(w, used)}${credit(used)}</div>`;
  return { path: w.path, title: `${w.r.name} ${w.season}`, body: htmlBlock(body), template: 'page-wide' };
}

/** A session's own page: its classification (every driver, every part), race control's marks, Pit wall for a race or
 *  a sprint, and the weather measured through it, or its forecast before it runs. */
function sessionPage(w: Weekend, e: CalendarEntry): Page {
  const used: Used = { of1: false, met: false };
  const t = tableOf(w, e.session);
  const x = extrasOf(w, e.session);
  const at = x?.marks?.late?.started ?? e.start;
  const band =
    `<section class="pd-ss-band"><div class="pd-ss-band-in"><p class="pd-wk-crumb"><a href="${seriesPath(w.d.slug)}">${esc(w.d.name)}</a> › <a href="${seasonPath(w.d.slug, w.season)}">${w.season}</a> › ` +
    `<a href="${w.path}">Round ${w.r.round} · ${esc(w.r.name)}</a></p><h1>${esc(e.session)}</h1><p class="pd-ss-sub">${esc(trackDay(w, at))} · ${trackTime(w, at)} at the track, ${yours(at, 'wt')} your time</p></div></section>`;
  const parts: string[] = [];
  if (t) {
    const hint = /^S?Q\d$/.test(t.columns[t.columns.length - 1] ?? '') ? `All ${t.rows.length}, as classified; each driver’s best time in each part` : `All ${t.rows.length}, as classified`;
    parts.push(section('Classification', hint, `${marks(w, e.session)}${classTable(w, t)}`));
    if (/^(race|sprint)$/i.test(e.session)) {
      const wall = pitWall(w, e.session, Infinity, used);
      if (wall) parts.push(section('Pit wall', 'Each driver’s tyres and stops, lap by lap', wall));
    }
  } else {
    parts.push(section('Classification', '', `${marks(w, e.session)}<p class="pd-wk-empty">Not run yet. Its results join this page when it ends.</p>`));
  }
  const wx = x?.weather;
  let weather = '';
  if (t && wx) {
    used.of1 = true;
    weather =
      `<section class="pd-wk-box"><h3>Weather at the track</h3><dl><dt>Air</dt><dd>${wx.air[0]}–${wx.air[2]} °C</dd>${wx.track ? `<dt>Track</dt><dd>${wx.track[0]}–${wx.track[2]} °C</dd>` : ''}` +
      `${wx.humidity ? `<dt>Humidity</dt><dd>${wx.humidity[0]}–${wx.humidity[1]} %</dd>` : ''}<dt>Rain</dt><dd>${wx.rain ? 'Yes' : 'None'}</dd></dl><p class="pd-wk-src">Measured through the session</p></section>`;
  } else if (!t) {
    const f = forecast(w, e.start, used);
    if (f) weather = `<section class="pd-wk-box"><h3>Forecast for its start</h3><div class="pd-wk-fc">${f}</div><p class="pd-wk-src">For the hour it starts</p></section>`;
  }
  const body =
    `<div class="pd-wk pd-s-${esc(w.d.slug)}">${band}${weekendBar(w, e.session)}` +
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
