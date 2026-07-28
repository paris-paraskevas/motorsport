import { kv } from '../kv';

// Best-effort assistant usage logging in Vercel KV — NEVER throws (a logging
// failure must not break an answer). Powers the admin insights page: what people
// ask, how often, per-user counts, and 👍/👎 feedback so the operator can expand
// the help corpus to cover the common questions. Retention is bounded by COUNT
// (a capped recent list + rolling counters), not time — disclosed in /privacy.

const RECENT = 'paddock:assistant:recent'; // list of recent {u,q,ts,ok}
const FREQ = 'paddock:assistant:freq'; // hash: normalizedQ -> count
const USERS = 'paddock:assistant:users'; // hash: userId -> count
const FB_UP = 'paddock:assistant:fb:up'; // hash: normalizedQ -> 👍 count
const FB_DOWN = 'paddock:assistant:fb:down'; // hash: normalizedQ -> 👎 count
const RECENT_MAX = 500;

function kvOn(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/** Normalize a question for frequency counting: lowercase, collapse whitespace,
 *  drop trailing punctuation, cap length. Pure — unit-tested. */
export function normalizeQuestion(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[?.!]+$/, '').slice(0, 200);
}

/** Record one asked question (best-effort). */
export async function logQuestion(userId: string, question: string, ok: boolean): Promise<void> {
  if (!kvOn()) return;
  try {
    await Promise.all([
      kv.lpush(RECENT, { u: userId, q: question.slice(0, 300), ts: Date.now(), ok }),
      kv.hincrby(FREQ, normalizeQuestion(question), 1),
      kv.hincrby(USERS, userId, 1),
    ]);
    await kv.ltrim(RECENT, 0, RECENT_MAX - 1);
  } catch {
    /* best-effort — logging must never break the assistant */
  }
}

/** Record a 👍/👎 on the answer to `question` (best-effort). */
export async function recordFeedback(question: string, rating: 'up' | 'down'): Promise<void> {
  if (!kvOn()) return;
  try {
    await kv.hincrby(rating === 'up' ? FB_UP : FB_DOWN, normalizeQuestion(question), 1);
  } catch {
    /* best-effort */
  }
}

export interface RecentEntry {
  u: string;
  q: string;
  ts: number;
  ok: boolean;
}
export interface AssistantInsights {
  totalQuestions: number;
  uniqueUsers: number;
  topQuestions: { q: string; count: number }[];
  topUsers: { u: string; count: number }[];
  recent: RecentEntry[];
  feedback: { up: number; down: number; topDownvoted: { q: string; count: number }[] };
}

function toPairs(h: Record<string, unknown> | null): { key: string; count: number }[] {
  return Object.entries(h ?? {}).map(([key, c]) => ({ key, count: Number(c) || 0 }));
}

/** Aggregate everything for the admin insights page. */
export async function readInsights(): Promise<AssistantInsights> {
  const empty: AssistantInsights = {
    totalQuestions: 0,
    uniqueUsers: 0,
    topQuestions: [],
    topUsers: [],
    recent: [],
    feedback: { up: 0, down: 0, topDownvoted: [] },
  };
  if (!kvOn()) return empty;
  try {
    const [freq, users, recentRaw, up, down] = await Promise.all([
      kv.hgetall<Record<string, unknown>>(FREQ),
      kv.hgetall<Record<string, unknown>>(USERS),
      kv.lrange(RECENT, 0, 49),
      kv.hgetall<Record<string, unknown>>(FB_UP),
      kv.hgetall<Record<string, unknown>>(FB_DOWN),
    ]);
    const freqPairs = toPairs(freq);
    const userPairs = toPairs(users);
    const downPairs = toPairs(down);
    const recent = (recentRaw ?? [])
      .map(r => {
        try {
          return typeof r === 'string' ? (JSON.parse(r) as RecentEntry) : (r as RecentEntry);
        } catch {
          return null;
        }
      })
      .filter((r): r is RecentEntry => Boolean(r && r.q));
    const byCount = (a: { count: number }, b: { count: number }) => b.count - a.count;
    return {
      totalQuestions: freqPairs.reduce((s, p) => s + p.count, 0),
      uniqueUsers: userPairs.length,
      topQuestions: freqPairs.sort(byCount).slice(0, 25).map(p => ({ q: p.key, count: p.count })),
      topUsers: userPairs.sort(byCount).slice(0, 15).map(p => ({ u: p.key, count: p.count })),
      recent,
      feedback: {
        up: toPairs(up).reduce((s, p) => s + p.count, 0),
        down: downPairs.reduce((s, p) => s + p.count, 0),
        topDownvoted: downPairs.sort(byCount).slice(0, 15).map(p => ({ q: p.key, count: p.count })),
      },
    };
  } catch {
    return empty;
  }
}
