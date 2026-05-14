import { kv } from '@vercel/kv';
import type { PushSubscription } from 'web-push';

const KEY_PREFIX = 'paddock:push:';

export interface StoredSubscription {
  subscription: PushSubscription;
  userId: string | null;
  createdAt: number;
}

function isKvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

export async function saveSubscription(
  sub: PushSubscription,
  userId: string | null = null,
): Promise<void> {
  if (!isKvConfigured()) {
    throw new Error('Vercel KV is not configured. Connect KV in the Vercel Storage tab.');
  }
  const id = endpointHash(sub.endpoint);
  const value: StoredSubscription = { subscription: sub, userId, createdAt: Date.now() };
  await kv.set(`${KEY_PREFIX}${id}`, value);
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  if (!isKvConfigured()) return;
  const id = endpointHash(endpoint);
  await kv.del(`${KEY_PREFIX}${id}`);
}

export async function listSubscriptions(): Promise<StoredSubscription[]> {
  if (!isKvConfigured()) return [];
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await kv.scan(cursor, { match: `${KEY_PREFIX}*` });
    cursor = String(next);
    keys.push(...batch);
  } while (cursor !== '0');
  if (keys.length === 0) return [];
  const values = await kv.mget<StoredSubscription[]>(...keys);
  return values.filter((v): v is StoredSubscription => Boolean(v && v.subscription));
}

function endpointHash(endpoint: string): string {
  // Cheap, stable per-endpoint key. Push endpoints are long URLs — just hash to base36.
  let h = 0;
  for (let i = 0; i < endpoint.length; i++) {
    h = (Math.imul(h, 31) + endpoint.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
