import fs from 'fs/promises';
import path from 'path';

export interface Circuit {
  name: string;
  lat: number;
  lon: number;
  aliases: string[];
}

export type CircuitsMap = Record<string, Circuit>;

let cache: CircuitsMap | null = null;

async function loadCircuits(): Promise<CircuitsMap> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), 'content', 'circuits.json'),
      'utf-8',
    );
    cache = JSON.parse(raw) as CircuitsMap;
  } catch {
    cache = {};
  }
  return cache;
}

// Match the combining diacritical marks block (U+0300..U+036F).
const DIACRITICS_RE = /[̀-ͯ]/g;

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Match a session location/title string against the curated circuits map and
 * return the matched entry WITH its slug (the circuits.json key). Tries each
 * circuit's aliases case-insensitively, longest-first to avoid "Spa" matching
 * inside "Spain". Returns the first hit or null.
 */
export async function matchCircuitEntry(
  ...candidates: Array<string | undefined>
): Promise<{ slug: string; circuit: Circuit } | null> {
  const circuits = await loadCircuits();
  const haystacks = candidates
    .filter((c): c is string => Boolean(c && c.trim()))
    .map(normalise);
  if (haystacks.length === 0) return null;

  // Flatten all aliases with their circuit + slug, sort by alias length desc.
  const lookup: Array<{ alias: string; slug: string; circuit: Circuit }> = [];
  for (const [slug, circuit] of Object.entries(circuits)) {
    for (const alias of circuit.aliases) {
      lookup.push({ alias: normalise(alias), slug, circuit });
    }
  }
  lookup.sort((a, b) => b.alias.length - a.alias.length);

  for (const { alias, slug, circuit } of lookup) {
    if (alias.length < 4) continue;
    if (haystacks.some(h => h.includes(alias))) return { slug, circuit };
  }
  return null;
}

/** As {@link matchCircuitEntry} but returns just the circuit (back-compat). */
export async function matchCircuit(
  ...candidates: Array<string | undefined>
): Promise<Circuit | null> {
  return (await matchCircuitEntry(...candidates))?.circuit ?? null;
}
