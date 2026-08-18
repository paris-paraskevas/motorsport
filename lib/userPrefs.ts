import { kv } from './kv';
import { classifySession } from './calendar-grid';

const PREFIX = 'paddock:user:';

function isKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

// Guard for a KV write. KV is always provisioned in production, so a missing
// binding THERE is a real misconfiguration → throw so it's caught loudly. In
// dev (no local KV creds) a missing store is expected, so degrade to a no-op
// instead of 500-ing every write. Returns false when the caller should skip.
function assertKvForWrite(): boolean {
  if (isKvConfigured()) return true;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Vercel KV is not configured.');
  }
  return false;
}

export async function getUserFollowed(userId: string): Promise<string[] | null> {
  if (!isKvConfigured()) return null;
  const v = await kv.get<string[]>(`${PREFIX}${userId}:followed`);
  return v ?? null;
}

export async function setUserFollowed(userId: string, slugs: string[]): Promise<void> {
  if (!assertKvForWrite()) return;
  await kv.set(`${PREFIX}${userId}:followed`, slugs);
}

export async function isUserOnboarded(userId: string): Promise<boolean> {
  if (!isKvConfigured()) return false;
  const v = await kv.get<boolean>(`${PREFIX}${userId}:onboarded`);
  return v === true;
}

export async function markUserOnboarded(userId: string): Promise<void> {
  if (!assertKvForWrite()) return;
  await kv.set(`${PREFIX}${userId}:onboarded`, true);
}

export async function resetUserOnboarded(userId: string): Promise<void> {
  if (!isKvConfigured()) return;
  await kv.del(`${PREFIX}${userId}:onboarded`);
}

// Per-session-type granularity for the `sessions` notification kind only.
// The keys mirror lib/calendar-grid's classifySession() buckets ('other' is
// never filtered — parades/ceremonies stay opt-out via the kind toggle).
export interface SessionTypePrefs {
  practice: boolean;
  qualifying: boolean;
  race: boolean;
}

export const DEFAULT_SESSION_TYPE_PREFS: SessionTypePrefs = {
  practice: true,
  qualifying: true,
  race: true,
};

// Do-not-disturb window. `start`/`end` are whole hours 0–23 in the user's own
// timezone (`tz`, an IANA id captured from the browser when they enable it).
// A window that wraps past midnight (start > end, e.g. 22→7) is supported.
// Absent or `enabled:false` = no quiet hours (the default — opt-in only).
export interface QuietHours {
  enabled: boolean;
  start: number;
  end: number;
  tz: string;
}

export interface NotifPrefs {
  sessions: boolean;   // ~30 min before each session
  news: boolean;       // new article from a followed series
  raceWeek: boolean;   // Monday-morning summary if any race this week
  betting: boolean;    // prediction market: quali-eve lock reminder + results-in notice
  blog: boolean;       // a new blog post goes live (site-wide; followed-filtered when series-tagged)
  sound: boolean;      // play the OS default notification sound (off = silent)
  mutedSeries?: string[];  // per-series mute (independent of follow state)
  sessionTypes?: SessionTypePrefs; // sessions-kind granularity; absent (pre-0.159 rows) = all true
  quietHours?: QuietHours; // do-not-disturb window; absent = off (0.182.2)
}

// Stored/patch shape: everything optional, and sessionTypes itself may be
// partial (defensive against hand-edited or half-written KV rows).
export type NotifPrefsPatch = Omit<Partial<NotifPrefs>, 'sessionTypes'> & {
  sessionTypes?: Partial<SessionTypePrefs>;
};

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  sessions: true,
  news: true,
  raceWeek: true,
  betting: true,
  blog: true,
  sound: true,
  mutedSeries: [],
  sessionTypes: { ...DEFAULT_SESSION_TYPE_PREFS },
};

/**
 * Merge a stored (possibly pre-0.159, possibly partial) prefs row over the
 * defaults. Shallow spread alone would let a partial `sessionTypes` object
 * wipe the unspecified type flags, so that field is deep-merged: absent field
 * or absent key = true (the pre-granularity behaviour).
 */
export function mergeNotifPrefs(stored: NotifPrefsPatch | null | undefined): NotifPrefs {
  const s = stored ?? {};
  return {
    ...DEFAULT_NOTIF_PREFS,
    ...s,
    sessionTypes: { ...DEFAULT_SESSION_TYPE_PREFS, ...(s.sessionTypes ?? {}) },
  };
}

/**
 * Whether a sessions-kind notification about `sessionTitle` passes the user's
 * per-session-type toggles. Classification reuses lib/calendar-grid's
 * classifySession — the same buckets the calendar filter uses — so "Sprint
 * Qualifying" counts as qualifying, "Sprint" as race, warm-ups as practice.
 * Titles classified 'other' are never filtered here. Absent prefs = allowed.
 */
export function sessionTypeAllowed(
  sessionTypes: Partial<SessionTypePrefs> | undefined,
  sessionTitle: string,
): boolean {
  const kind = classifySession(sessionTitle);
  if (kind === 'other') return true;
  return { ...DEFAULT_SESSION_TYPE_PREFS, ...(sessionTypes ?? {}) }[kind] !== false;
}

// Whether `now` falls inside the user's quiet-hours window, evaluated in their
// own timezone. Pure + fail-open: a disabled window, a zero-width window, or an
// unparseable tz all return false (never suppress a push by accident). A window
// that wraps past midnight (start > end, e.g. 22→7) is handled. The hour is
// normalised %24 so ICU's "24" for midnight collapses to 0.
export function isQuietNow(prefs: Pick<NotifPrefs, 'quietHours'>, now: Date = new Date()): boolean {
  const q = prefs.quietHours;
  if (!q || !q.enabled || q.start === q.end) return false;
  let hour: number;
  try {
    hour =
      Number(
        new Intl.DateTimeFormat('en-US', { timeZone: q.tz, hour: 'numeric', hour12: false }).format(now),
      ) % 24;
  } catch {
    return false;
  }
  if (Number.isNaN(hour)) return false;
  return q.start < q.end ? hour >= q.start && hour < q.end : hour >= q.start || hour < q.end;
}

export async function addMutedSeries(userId: string, slug: string): Promise<NotifPrefs> {
  const prefs = await getUserNotifPrefs(userId);
  const muted = new Set(prefs.mutedSeries ?? []);
  muted.add(slug);
  return setUserNotifPrefs(userId, { mutedSeries: [...muted] });
}

export async function removeMutedSeries(userId: string, slug: string): Promise<NotifPrefs> {
  const prefs = await getUserNotifPrefs(userId);
  const muted = new Set(prefs.mutedSeries ?? []);
  muted.delete(slug);
  return setUserNotifPrefs(userId, { mutedSeries: [...muted] });
}

export async function getUserNotifPrefs(userId: string): Promise<NotifPrefs> {
  if (!isKvConfigured()) return mergeNotifPrefs(null);
  const stored = await kv.get<NotifPrefsPatch>(`${PREFIX}${userId}:notifPrefs`);
  return mergeNotifPrefs(stored);
}

export async function setUserNotifPrefs(
  userId: string,
  patch: NotifPrefsPatch,
): Promise<NotifPrefs> {
  if (!assertKvForWrite()) return mergeNotifPrefs(patch);
  const current = await getUserNotifPrefs(userId);
  // sessionTypes deep-merges so a partial patch never drops the other flags.
  const next: NotifPrefs = {
    ...current,
    ...patch,
    sessionTypes: {
      ...DEFAULT_SESSION_TYPE_PREFS,
      ...current.sessionTypes,
      ...(patch.sessionTypes ?? {}),
    },
  };
  await kv.set(`${PREFIX}${userId}:notifPrefs`, next);
  return next;
}
