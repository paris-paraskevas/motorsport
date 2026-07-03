import { kv } from '@vercel/kv';
import { classifySession } from './calendar-grid';
import { reconcileHomeLayout, type HomeLayoutPrefs } from './homeLayout';

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

export interface NotifPrefs {
  sessions: boolean;   // ~30 min before each session
  news: boolean;       // new article from a followed series
  raceWeek: boolean;   // Monday-morning summary if any race this week
  betting: boolean;    // prediction market: quali-eve lock reminder + results-in notice
  blog: boolean;       // a new blog post goes live (site-wide; followed-filtered when series-tagged)
  sound: boolean;      // play the OS default notification sound (off = silent)
  mutedSeries?: string[];  // per-series mute (independent of follow state)
  sessionTypes?: SessionTypePrefs; // sessions-kind granularity; absent (pre-0.159 rows) = all true
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

export async function getUserHomeLayout(userId: string): Promise<HomeLayoutPrefs | null> {
  if (!isKvConfigured()) return null;
  const stored = await kv.get<Partial<HomeLayoutPrefs>>(`${PREFIX}${userId}:homeLayout`);
  return stored ? reconcileHomeLayout(stored) : null;
}

export async function setUserHomeLayout(userId: string, prefs: HomeLayoutPrefs): Promise<void> {
  if (!assertKvForWrite()) return;
  await kv.set(`${PREFIX}${userId}:homeLayout`, reconcileHomeLayout(prefs));
}
