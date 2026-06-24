import { kv } from '@vercel/kv';
import { reconcileHomeLayout, type HomeLayoutPrefs } from './homeLayout';

const PREFIX = 'paddock:user:';

function isKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

export async function getUserFollowed(userId: string): Promise<string[] | null> {
  if (!isKvConfigured()) return null;
  const v = await kv.get<string[]>(`${PREFIX}${userId}:followed`);
  return v ?? null;
}

export async function setUserFollowed(userId: string, slugs: string[]): Promise<void> {
  if (!isKvConfigured()) {
    throw new Error('Vercel KV is not configured.');
  }
  await kv.set(`${PREFIX}${userId}:followed`, slugs);
}

export async function isUserOnboarded(userId: string): Promise<boolean> {
  if (!isKvConfigured()) return false;
  const v = await kv.get<boolean>(`${PREFIX}${userId}:onboarded`);
  return v === true;
}

export async function markUserOnboarded(userId: string): Promise<void> {
  if (!isKvConfigured()) {
    throw new Error('Vercel KV is not configured.');
  }
  await kv.set(`${PREFIX}${userId}:onboarded`, true);
}

export async function resetUserOnboarded(userId: string): Promise<void> {
  if (!isKvConfigured()) return;
  await kv.del(`${PREFIX}${userId}:onboarded`);
}

export interface NotifPrefs {
  sessions: boolean;   // ~30 min before each session
  news: boolean;       // new article from a followed series
  raceWeek: boolean;   // Monday-morning summary if any race this week
  betting: boolean;    // prediction market: quali-eve lock reminder + results-in notice
  sound: boolean;      // play the OS default notification sound (off = silent)
  mutedSeries?: string[];  // per-series mute (independent of follow state)
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  sessions: true,
  news: true,
  raceWeek: true,
  betting: true,
  sound: true,
  mutedSeries: [],
};

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
  if (!isKvConfigured()) return DEFAULT_NOTIF_PREFS;
  const stored = await kv.get<Partial<NotifPrefs>>(`${PREFIX}${userId}:notifPrefs`);
  return { ...DEFAULT_NOTIF_PREFS, ...(stored ?? {}) };
}

export async function setUserNotifPrefs(
  userId: string,
  patch: Partial<NotifPrefs>,
): Promise<NotifPrefs> {
  if (!isKvConfigured()) {
    throw new Error('Vercel KV is not configured.');
  }
  const current = await getUserNotifPrefs(userId);
  const next: NotifPrefs = { ...current, ...patch };
  await kv.set(`${PREFIX}${userId}:notifPrefs`, next);
  return next;
}

export async function getUserHomeLayout(userId: string): Promise<HomeLayoutPrefs | null> {
  if (!isKvConfigured()) return null;
  const stored = await kv.get<Partial<HomeLayoutPrefs>>(`${PREFIX}${userId}:homeLayout`);
  return stored ? reconcileHomeLayout(stored) : null;
}

export async function setUserHomeLayout(userId: string, prefs: HomeLayoutPrefs): Promise<void> {
  if (!isKvConfigured()) {
    throw new Error('Vercel KV is not configured.');
  }
  await kv.set(`${PREFIX}${userId}:homeLayout`, reconcileHomeLayout(prefs));
}
