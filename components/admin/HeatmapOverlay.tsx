'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Breakpoint, ClickPoint } from '@/lib/heatmap';

// A true visual click heatmap: the REAL page rendered in a same-origin iframe
// (?hm=1 so its own tracker stays off), with a canvas overlay whose hotspots are
// positioned by RE-RESOLVING each click's element in the live DOM — so a blob on
// the "Standings" tab actually sits on the Standings tab, at any breakpoint. Only
// possible because clicks are stored element-relative (data-heatmap-id / a
// resolvable CSS path + in-element ratio) and the app frames its own origin.

const BP_WIDTH: Record<Breakpoint, number> = { mobile: 390, tablet: 820, desktop: 1280 };
const BREAKPOINTS: Breakpoint[] = ['mobile', 'tablet', 'desktop'];

// Perceptual blue→cyan→green→yellow→red ramp for intensity t in 0..1.
function ramp(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0.0, [37, 99, 235]], // blue
    [0.35, [34, 211, 238]], // cyan
    [0.55, [34, 197, 94]], // green
    [0.75, [250, 204, 21]], // yellow
    [1.0, [239, 68, 68]], // red
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const f = (t - t0) / (t1 - t0 || 1);
      return [
        Math.round(c0[0] + f * (c1[0] - c0[0])),
        Math.round(c0[1] + f * (c1[1] - c0[1])),
        Math.round(c0[2] + f * (c1[2] - c0[2])),
      ];
    }
  }
  return stops[stops.length - 1][1];
}

// Two-pass density render (heatmap.js technique): accumulate radial alpha blobs
// weighted by click count, then colorise each pixel by its accumulated alpha.
function drawHeatmap(
  canvas: HTMLCanvasElement,
  positioned: { x: number; y: number; weight: number }[],
  width: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (positioned.length === 0) return;
  const maxW = Math.max(...positioned.map(p => p.weight));
  const radius = Math.max(22, Math.round(width * 0.03));

  // Pass 1 — accumulate greyscale alpha on an offscreen buffer (additive).
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;
  for (const p of positioned) {
    const intensity = 0.25 + 0.75 * (p.weight / maxW); // floor so singletons still show
    const g = tctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    g.addColorStop(0, `rgba(0,0,0,${intensity})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    tctx.fillStyle = g;
    tctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  }

  // Pass 2 — map accumulated alpha → colour ramp.
  const img = tctx.getImageData(0, 0, tmp.width, tmp.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0) continue;
    const [r, g, b] = ramp(Math.min(1, a / 255));
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = Math.min(220, a + 60); // display opacity (keep the page readable underneath)
  }
  ctx.putImageData(img, 0, 0);
}

export function HeatmapOverlay({
  paths,
  initialPath,
  initialPoints,
  loadPoints,
}: {
  paths: string[];
  initialPath: string;
  initialPoints: ClickPoint[];
  // Server action (admin-gated) — fetches bucketed click points for a path+bp.
  loadPoints: (path: string, breakpoint: Breakpoint) => Promise<ClickPoint[]>;
}) {
  const [path, setPath] = useState(initialPath);
  const [bp, setBp] = useState<Breakpoint>('desktop');
  const [points, setPoints] = useState<ClickPoint[]>(initialPoints);
  const [loading, setLoading] = useState(false);
  const [placed, setPlaced] = useState<{ placed: number; total: number } | null>(null);
  const [frameError, setFrameError] = useState(false);
  const [contentH, setContentH] = useState(600);
  const [scale, setScale] = useState(1);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const width = BP_WIDTH[bp];

  // Fetch points when path/breakpoint change (initial render is seeded).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let alive = true;
    setLoading(true);
    loadPoints(path, bp)
      .then(pts => alive && (setPoints(pts), setLoading(false)))
      .catch(() => alive && (setPoints([]), setLoading(false)));
    return () => {
      alive = false;
    };
  }, [path, bp, loadPoints]);

  // Fit the (breakpoint-width) frame into the panel via a uniform CSS scale.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, box.clientWidth / width)));
    ro.observe(box);
    return () => ro.disconnect();
  }, [width]);

  // Resolve every click against the live framed DOM and repaint. Positions come
  // from the CURRENT element rects, so hotspots track the real layout.
  const render = useCallback(() => {
    const iframe = iframeRef.current;
    const canvas = canvasRef.current;
    if (!iframe || !canvas) return;
    let doc: Document | null = null;
    try {
      doc = iframe.contentDocument;
    } catch {
      doc = null;
    }
    if (!doc || !doc.body) {
      setFrameError(true);
      return;
    }
    setFrameError(false);
    const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 400);
    setContentH(h);
    canvas.width = width;
    canvas.height = h;
    const win = iframe.contentWindow;
    const sx = win?.scrollX ?? 0;
    const sy = win?.scrollY ?? 0;

    const positioned: { x: number; y: number; weight: number }[] = [];
    for (const p of points) {
      let el: Element | null = null;
      try {
        el = p.elementId
          ? doc.querySelector(`[data-heatmap-id="${p.elementId.replace(/["\\]/g, '\\$&')}"]`)
          : p.selector
            ? doc.querySelector(p.selector)
            : null;
      } catch {
        el = null; // malformed/stale selector — skip this point
      }
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      positioned.push({ x: r.left + sx + p.relX * r.width, y: r.top + sy + p.relY * r.height, weight: p.weight });
    }
    setPlaced({ placed: positioned.length, total: points.length });
    drawHeatmap(canvas, positioned, width);
  }, [points, width]);

  // Repaint whenever the resolved inputs change (also fired by the iframe onLoad).
  useEffect(() => {
    render();
  }, [render]);

  const pill = (active: boolean) =>
    `border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
      active ? 'border-text bg-text text-bg' : 'border-border text-text-muted hover:text-text'
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={path}
          onChange={e => setPath(e.target.value)}
          className="border border-border bg-bg px-2 py-1 font-mono text-xs text-text"
        >
          {paths.map(p => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {BREAKPOINTS.map(b => (
            <button key={b} type="button" onClick={() => setBp(b)} aria-pressed={bp === b} className={pill(bp === b)}>
              {b}
            </button>
          ))}
        </div>
        <button type="button" onClick={render} className={pill(false)}>
          Re-measure
        </button>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-text-faint">
          {loading ? 'loading…' : placed ? `${placed.placed}/${placed.total} clicks placed` : ''}
        </span>
      </div>

      {frameError && (
        <p className="rounded-lg border border-dashed border-border bg-surface/40 px-3 py-2 font-mono text-[11px] text-text-faint">
          Couldn&apos;t read the framed page — needs same-origin + <span className="text-text">X-Frame-Options: SAMEORIGIN</span>.
        </p>
      )}

      <div ref={boxRef} className="overflow-auto rounded-xl border border-border bg-surface-elevated">
        <div style={{ width: width * scale, height: contentH * scale, position: 'relative' }}>
          <div style={{ width, height: contentH, position: 'absolute', top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <iframe
              ref={iframeRef}
              src={`${path}?hm=1`}
              title="Page under heatmap"
              onLoad={render}
              style={{ width, height: contentH, border: 0, display: 'block' }}
            />
            <canvas
              ref={canvasRef}
              style={{ position: 'absolute', top: 0, left: 0, width, height: contentH, pointerEvents: 'none' }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        <span>cold</span>
        <span className="h-2 w-40 rounded-full" style={{ background: 'linear-gradient(90deg,#2563eb,#22d3ee,#22c55e,#facc15,#ef4444)' }} />
        <span>hot</span>
        <span className="ml-2 normal-case tracking-normal">
          Only clicks whose element re-resolves are placed; the rest are counted, not drawn.
        </span>
      </div>
    </div>
  );
}
