'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Breakpoint, FrustrationItem, OverlayData } from '@/lib/heatmap';

// A true visual heatmap: the REAL page rendered in a same-origin iframe (?hm=1 so
// its own tracker stays off), with a canvas overlay. CLICKS mode positions each
// click by RE-RESOLVING its element in the live DOM (data-heatmap-id / a
// resolvable CSS path) + the stored in-element ratio, so blobs sit exactly on the
// real tabs/buttons at any breakpoint. SCROLL mode shades the page by how far
// viewers got. Rage/dead-click tallies list below. All per-breakpoint.

const BP_WIDTH: Record<Breakpoint, number> = { mobile: 390, tablet: 820, desktop: 1280 };
const BREAKPOINTS: Breakpoint[] = ['mobile', 'tablet', 'desktop'];
type Mode = 'clicks' | 'scroll';

// Perceptual blue→cyan→green→yellow→red ramp for intensity t in 0..1.
function ramp(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0.0, [37, 99, 235]],
    [0.35, [34, 211, 238]],
    [0.55, [34, 197, 94]],
    [0.75, [250, 204, 21]],
    [1.0, [239, 68, 68]],
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

// CLICKS: two-pass density (heatmap.js technique) — accumulate radial alpha blobs
// weighted by click count, then colourise each pixel by its accumulated alpha.
function drawClicks(canvas: HTMLCanvasElement, positioned: { x: number; y: number; weight: number }[], width: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (positioned.length === 0) return;
  const maxW = Math.max(...positioned.map(p => p.weight));
  const radius = Math.max(22, Math.round(width * 0.03));
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;
  for (const p of positioned) {
    const intensity = 0.25 + 0.75 * (p.weight / maxW);
    const g = tctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    g.addColorStop(0, `rgba(0,0,0,${intensity})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    tctx.fillStyle = g;
    tctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  }
  const img = tctx.getImageData(0, 0, tmp.width, tmp.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0) continue;
    const [r, g, b] = ramp(Math.min(1, a / 255));
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = Math.min(220, a + 60);
  }
  ctx.putImageData(img, 0, 0);
}

// SCROLL: shade the page in 10 horizontal bands by reach — hot/opaque at the top
// (everyone saw it), fading cool as fewer viewers scroll down. Labels the reach %.
function drawScroll(canvas: HTMLCanvasElement, reached: number[], width: number, contentH: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 10; i++) {
    const frac = reached[i] ?? 0;
    const y0 = Math.round((i / 10) * contentH);
    const y1 = Math.round(((i + 1) / 10) * contentH);
    const [r, g, b] = ramp(frac);
    ctx.fillStyle = `rgba(${r},${g},${b},${0.12 + 0.5 * frac})`;
    ctx.fillRect(0, y0, width, y1 - y0);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 13px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(`${Math.round(frac * 100)}% reached ${(i + 1) * 10}% depth`, 8, y0 + 18);
  }
}

export function HeatmapOverlay({
  paths,
  initialPath,
  initialData,
  loadData,
}: {
  paths: string[];
  initialPath: string;
  initialData: OverlayData;
  // Server action (admin-gated) — clicks + scroll + frustration for a path+bp.
  loadData: (path: string, breakpoint: Breakpoint) => Promise<OverlayData>;
}) {
  const [path, setPath] = useState(initialPath);
  const [bp, setBp] = useState<Breakpoint>('desktop');
  const [mode, setMode] = useState<Mode>('clicks');
  const [data, setData] = useState<OverlayData>(initialData);
  const [loading, setLoading] = useState(false);
  const [placed, setPlaced] = useState<{ placed: number; total: number } | null>(null);
  const [frameError, setFrameError] = useState(false);
  const [contentH, setContentH] = useState(600);
  const [scale, setScale] = useState(1);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const width = BP_WIDTH[bp];

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let alive = true;
    setLoading(true);
    loadData(path, bp)
      .then(d => alive && (setData(d), setLoading(false)))
      .catch(() => alive && (setData({ clicks: [], scroll: { sample: 0, reached: [] }, rage: [], dead: [] }), setLoading(false)));
    return () => {
      alive = false;
    };
  }, [path, bp, loadData]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, box.clientWidth / width)));
    ro.observe(box);
    return () => ro.disconnect();
  }, [width]);

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

    if (mode === 'scroll') {
      setPlaced(null);
      drawScroll(canvas, data.scroll.reached, width, h);
      return;
    }

    const win = iframe.contentWindow;
    const sx = win?.scrollX ?? 0;
    const sy = win?.scrollY ?? 0;
    const positioned: { x: number; y: number; weight: number }[] = [];
    for (const p of data.clicks) {
      let el: Element | null = null;
      try {
        el = p.elementId
          ? doc.querySelector(`[data-heatmap-id="${p.elementId.replace(/["\\]/g, '\\$&')}"]`)
          : p.selector
            ? doc.querySelector(p.selector)
            : null;
      } catch {
        el = null;
      }
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      positioned.push({ x: r.left + sx + p.relX * r.width, y: r.top + sy + p.relY * r.height, weight: p.weight });
    }
    setPlaced({ placed: positioned.length, total: data.clicks.length });
    drawClicks(canvas, positioned, width);
  }, [data, width, mode]);

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
          {(['clicks', 'scroll'] as Mode[]).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={pill(mode === m)}>
              {m}
            </button>
          ))}
        </div>
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
          {loading
            ? 'loading…'
            : mode === 'scroll'
              ? `${data.scroll.sample} scroll reading${data.scroll.sample === 1 ? '' : 's'}`
              : placed
                ? `${placed.placed}/${placed.total} clicks placed`
                : ''}
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
        <span>{mode === 'scroll' ? 'few' : 'cold'}</span>
        <span className="h-2 w-40 rounded-full" style={{ background: 'linear-gradient(90deg,#2563eb,#22d3ee,#22c55e,#facc15,#ef4444)' }} />
        <span>{mode === 'scroll' ? 'most' : 'hot'}</span>
        <span className="ml-2 normal-case tracking-normal">
          {mode === 'scroll'
            ? 'How far down viewers scrolled (hot = most reached).'
            : 'Only clicks whose element re-resolves are placed; the rest are counted, not drawn.'}
        </span>
      </div>

      {(data.rage.length > 0 || data.dead.length > 0) && (
        <div className="grid gap-4 pt-1 sm:grid-cols-2">
          <FrustrationList title="Rage clicks" note="rapid repeats in one spot" rows={data.rage} tone="text-red-400" />
          <FrustrationList title="Dead clicks" note="on non-interactive space" rows={data.dead} tone="text-amber-400" />
        </div>
      )}
    </div>
  );
}

function FrustrationList({ title, note, rows, tone }: { title: string; note: string; rows: FrustrationItem[]; tone: string }) {
  return (
    <div>
      <div className={`mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${tone}`}>
        {title} <span className="text-text-faint">· {note}</span>
      </div>
      {rows.length === 0 ? (
        <p className="font-mono text-[11px] text-text-faint">None yet</p>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 8).map(r => (
            <li key={r.anchor} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-mono text-text">{r.anchor}</span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-faint">{r.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
