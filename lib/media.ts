import fs from 'fs/promises';
import path from 'path';

/**
 * Per-round media for a series, curated under
 * `content/series/<slug>/media.json`. Keyed by canonical round number (string
 * in JSON). Seeds the long-parked WeekendMedia idea: today only the home's
 * JUST MISSED block reads it (latest race's highlight); weekend pages can
 * reuse the same file later.
 */
export interface RoundMedia {
  /** YouTube id for the round's headline (race) highlights — used by the home
   *  JUST MISSED block, the weekend page, and the race session page. */
  highlight?: string;
  /** Per-session YouTube ids keyed by session slug (`sessionSlug(title)` —
   *  e.g. "qualifying", "free-practice-1", "sprint"), for the weekend's
   *  individual session pages. The race session falls back to `highlight` so
   *  the headline clip isn't curated twice. */
  sessions?: Record<string, string>;
}

export interface MediaFile {
  // round number (as string) → media for that round
  [round: string]: RoundMedia;
}

const SERIES_ROOT = path.join(process.cwd(), 'content', 'series');

/** Reads a series' media.json, or `{}` when absent/unparseable (fail-soft —
 *  a missing or malformed file must never break the home render). */
export async function loadMedia(slug: string): Promise<MediaFile> {
  try {
    const raw = await fs.readFile(path.join(SERIES_ROOT, slug, 'media.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as MediaFile) : {};
  } catch {
    return {};
  }
}

/** The YouTube highlight id for a round, or undefined when not curated. */
export function highlightForRound(
  media: MediaFile,
  round: number | undefined,
): string | undefined {
  if (round === undefined || round === null) return undefined;
  return media[String(round)]?.highlight;
}

/** YouTube id to embed for one session: its curated per-session clip if
 *  present, else the round headline (`highlight`) when this IS the race
 *  session. Undefined → no video for this session (renders nothing). */
export function videoForSession(
  media: MediaFile,
  round: number | undefined,
  sessionSlug: string,
  isRace: boolean,
): string | undefined {
  if (round === undefined || round === null) return undefined;
  const r = media[String(round)];
  return r?.sessions?.[sessionSlug] ?? (isRace ? r?.highlight : undefined);
}
