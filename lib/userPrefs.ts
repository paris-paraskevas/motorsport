import { kv } from '@vercel/kv';

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
