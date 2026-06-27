import fs from 'fs/promises';
import path from 'path';
import { matchCircuitEntry } from './circuits';

export interface CircuitLayout {
  /** Public path to the schematic SVG (under public/circuits/). */
  svg: string;
  /** Attribution — rendered as a visible credit (the layout is licensed). */
  source: string;
  license: string;
  sourceUrl: string;
  /** Circuit display name (from circuits.json). */
  name: string;
}

type RawLayout = Omit<CircuitLayout, 'name'>;

let cache: Record<string, RawLayout> | null = null;

async function loadLayouts(): Promise<Record<string, RawLayout>> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), 'content', 'circuits-layout.json'),
      'utf-8',
    );
    const parsed = JSON.parse(raw) as { layouts?: Record<string, RawLayout> };
    cache = parsed.layouts ?? {};
  } catch {
    cache = {};
  }
  return cache;
}

/**
 * Resolve a session's circuit (by location/title alias match, via
 * matchCircuitEntry) to its curated track-layout schematic + attribution, or
 * null when that circuit has no curated layout (v1 covers the F1 2026 calendar
 * only — see docs/research/2026-06-26-track-layout-scope.md). Server-only (fs).
 */
export async function circuitLayoutFor(
  ...candidates: Array<string | undefined>
): Promise<CircuitLayout | null> {
  const match = await matchCircuitEntry(...candidates);
  if (!match) return null;
  const layout = (await loadLayouts())[match.slug];
  return layout ? { ...layout, name: match.circuit.name } : null;
}
