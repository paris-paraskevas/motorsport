// Self-drawn circuit geometry from /location samples. Plotting one lap's worth
// of (x, y) points traces the track outline to scale — no per-circuit SVG
// calibration. Y is flipped (track coords are y-up; SVG is y-down). Pure +
// synchronous so it can be unit-tested and run server-side without a fetch.

import type { OF1Location } from './types';

export interface TrackPoint {
  x: number; // viewBox space
  y: number;
  t: number; // seconds from the first sample (for time-based animation)
}

export interface TrackPath {
  d: string; // SVG path data ("M.. L..")
  width: number;
  height: number;
  viewBox: string; // "0 0 W H"
  points: TrackPoint[];
}

const DEFAULT_WIDTH = 1000;
const DEFAULT_PADDING = 40;
const MAX_POINTS = 800; // a ~90s lap at 3.7 Hz is ~330 pts; cap pathological inputs

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build a normalised SVG path from location samples (one lap, ideally). Drops
 * non-finite and (0,0) dropout samples, sorts by time, downsamples if very
 * dense, and scales to fit `width` preserving aspect ratio. Returns null when
 * there aren't enough usable points to draw a line.
 */
export function buildTrackPath(
  samples: Pick<OF1Location, 'x' | 'y' | 'date'>[],
  opts: { width?: number; padding?: number } = {},
): TrackPath | null {
  const width = opts.width ?? DEFAULT_WIDTH;
  const padding = opts.padding ?? DEFAULT_PADDING;

  const clean = samples
    .map(s => ({ x: s.x, y: s.y, ms: new Date(s.date).getTime() }))
    .filter(
      s =>
        Number.isFinite(s.x) &&
        Number.isFinite(s.y) &&
        Number.isFinite(s.ms) &&
        !(s.x === 0 && s.y === 0),
    )
    .sort((a, b) => a.ms - b.ms);
  if (clean.length < 2) return null;

  const step = clean.length > MAX_POINTS ? Math.ceil(clean.length / MAX_POINTS) : 1;
  const pts = clean.filter((_, i) => i % step === 0);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = (width - 2 * padding) / spanX;
  const height = Math.round(spanY * scale + 2 * padding);
  const t0 = pts[0].ms;

  const points: TrackPoint[] = pts.map(p => ({
    x: round2(padding + (p.x - minX) * scale),
    // flip Y so the map is north-up rather than mirrored
    y: round2(height - padding - (p.y - minY) * scale),
    t: round2((p.ms - t0) / 1000),
  }));

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');

  return { d, width, height, viewBox: `0 0 ${width} ${height}`, points };
}
