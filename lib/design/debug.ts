// The Debug helper (APEX: APEX_DEBUG on the server and apex.debug in the
// browser write one log, gated by one level; the Debugging chapter, run 13, and
// Appendix D, run 14, of the APEX study; rule 6 v3). Pure and client-safe: the
// server's trace (debug-trace.ts) and the browser's store (debug-client.ts)
// build the same entries, and the Debug panel draws both.

/** APEX's levels: Info (4, the default once debug is on), App Trace (6), Full
 *  Trace (9); 0 is off (UX map line 110). Each level includes the ones below. */
export type DebugLevel = 0 | 4 | 6 | 9;
export type OnLevel = Exclude<DebugLevel, 0>;
export const LEVEL_NAMES: Readonly<Record<OnLevel, string>> = { 4: 'Info', 6: 'App Trace', 9: 'Full Trace' };
/** The toolbar's stored names for the levels. */
export const LEVEL_KEYS = { info: 4, app: 6, full: 9 } as const;
export type LevelKey = keyof typeof LEVEL_KEYS;

/** `?debug=YES|LEVEL4|LEVEL6|LEVEL9` as APEX reads it (YES is Info); anything else is off. */
export function levelFromParam(v: string | null | undefined): DebugLevel {
  if (!v) return 0;
  const u = v.trim().toUpperCase();
  if (u === 'YES' || u === 'LEVEL4') return 4;
  if (u === 'LEVEL6') return 6;
  if (u === 'LEVEL9') return 9;
  return 0;
}

/** The stored name (info · app · full) as a level; anything else is off. */
export function levelFromKey(v: string | null | undefined): DebugLevel {
  return v !== null && v !== undefined && v in LEVEL_KEYS ? LEVEL_KEYS[v as LevelKey] : 0;
}

export function keyOfLevel(level: DebugLevel): LevelKey | null {
  return level === 4 ? 'info' : level === 6 ? 'app' : level === 9 ? 'full' : null;
}

export interface DebugEntry {
  /** Milliseconds since the trace began (server) or since the page began (browser). */
  at: number;
  level: OnLevel;
  /** The step's code: the Processing tab's names (resolve · session · authz ·
   *  condition · build · refs · render · bind), a region's own as `render:<id>`,
   *  `condition:<id>`, `authz:<id>`, `build:<id>`, an action's as `action:<id>`. */
  phase: string;
  text: string;
  ms?: number;
  /** The sources a component declares it reads (component-render's READS). */
  src?: readonly string[];
  /** The loader run that wrote those sources, with its phases. */
  run?: string;
}

export interface DebugReport {
  cid: string;
  level: DebugLevel;
  page: string;
  startedAt: string;
  totalMs: number;
  entries: DebugEntry[];
}

const round = (ms: number) => Math.round(ms * 10) / 10;

/** One request's collector: keeps the entries its level allows, times steps,
 *  and writes every kept line to the log with the correlation id first, so the
 *  Worker's log and the panel say the same thing. */
export class Collector {
  readonly entries: DebugEntry[] = [];
  private readonly t0: number;
  private readonly startedAt = new Date().toISOString();

  constructor(
    readonly cid: string,
    readonly level: DebugLevel,
    readonly page: string,
    private readonly now: () => number = () => performance.now(),
    private readonly log: (line: string) => void = line => console.log(line),
  ) {
    this.t0 = this.now();
  }

  get on(): boolean {
    return this.level > 0;
  }

  /** Milliseconds since the start. */
  elapsed(): number {
    return round(this.now() - this.t0);
  }

  note(level: OnLevel, phase: string, text: string, extra: Pick<DebugEntry, 'ms' | 'src' | 'run'> = {}): void {
    if (level > this.level) return;
    const entry: DebugEntry = { at: this.elapsed(), level, phase, text };
    if (extra.ms !== undefined) entry.ms = extra.ms;
    if (extra.src !== undefined) entry.src = extra.src;
    if (extra.run !== undefined) entry.run = extra.run;
    this.entries.push(entry);
    this.log(`[pd ${this.cid}] ${phase} ${text}${extra.ms !== undefined ? ` ${extra.ms}ms` : ''}`);
  }

  /** Times a step; its entry carries the duration; a throw is noted and rethrown. */
  async step<T>(level: OnLevel, phase: string, text: string, fn: () => Promise<T> | T): Promise<T> {
    const t = this.now();
    try {
      const out = await fn();
      this.note(level, phase, text, { ms: round(this.now() - t) });
      return out;
    } catch (err) {
      this.note(level, phase, `${text} failed: ${err instanceof Error ? err.message : String(err)}`, { ms: round(this.now() - t) });
      throw err;
    }
  }

  report(): DebugReport {
    return { cid: this.cid, level: this.level, page: this.page, startedAt: this.startedAt, totalMs: this.elapsed(), entries: [...this.entries] };
  }
}

/** The correlation id of a trace (APEX: the page view id that joins a request
 *  to its debug messages): the Worker's cf-ray when the request has one, else
 *  eight hex characters. */
export function newCid(cfRay?: string | null): string {
  if (cfRay) return cfRay.split('-')[0].slice(0, 16);
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
