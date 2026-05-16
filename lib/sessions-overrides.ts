import fs from 'fs/promises';
import path from 'path';
import { Session, SessionsOverridesFile, SessionOverrideBlock } from './types';

export async function loadSessionsOverrides(
  dir: string,
): Promise<SessionsOverridesFile | undefined> {
  try {
    const raw = await fs.readFile(path.join(dir, 'sessions.json'), 'utf-8');
    const parsed = JSON.parse(raw) as SessionsOverridesFile;
    if (!parsed || !Array.isArray(parsed.overrides)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function blockKeySet(block: SessionOverrideBlock): Set<string> {
  // matchDate is the canonical weekend anchor; we also accept the ±2 day window
  // so single-day date-only events still match a weekend block.
  const set = new Set<string>();
  const anchor = new Date(`${block.matchDate}T00:00:00Z`);
  for (let d = -2; d <= 2; d++) {
    set.add(dateKey(new Date(anchor.getTime() + d * DAY_MS)));
  }
  return set;
}

function titleMatches(block: SessionOverrideBlock, sessionTitle: string): boolean {
  if (!block.matchTitle) return true;
  return sessionTitle.toLowerCase().includes(block.matchTitle.toLowerCase());
}

function expandBlock(seriesSlug: string, block: SessionOverrideBlock): Session[] {
  return block.sessions.map((s, idx) => {
    const start = new Date(s.start);
    const end = new Date(s.end);
    return {
      uid: `override:${seriesSlug}:${block.matchDate}:${idx}:${s.title}`,
      seriesSlug,
      title: s.title,
      start,
      end,
      location: s.location,
      significance: s.significance,
    };
  });
}

// Replaces matching date-only sessions with curated timed sessions.
// Strategy: any incoming session whose date falls within a block's match window
// AND whose title matches block.matchTitle (when set) is dropped, then the
// block's curated sessions are spliced in. Non-matching incoming sessions pass
// through untouched.
export function applySessionsOverrides(
  seriesSlug: string,
  sessions: Session[],
  overrides: SessionsOverridesFile | undefined,
): Session[] {
  if (!overrides || overrides.overrides.length === 0) return sessions;
  const blocks = overrides.overrides.map(b => ({ block: b, keys: blockKeySet(b) }));
  const kept: Session[] = [];
  for (const s of sessions) {
    const sKey = dateKey(s.start);
    const consumed = blocks.some(({ block, keys }) =>
      keys.has(sKey) && titleMatches(block, s.title),
    );
    if (!consumed) kept.push(s);
  }
  for (const b of overrides.overrides) {
    kept.push(...expandBlock(seriesSlug, b));
  }
  return kept.sort((a, b) => a.start.getTime() - b.start.getTime());
}
