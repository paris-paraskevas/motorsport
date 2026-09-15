'use client';

import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { TemplateOptionsDialog } from '@/components/designer/TemplateOptionsDialog';
import { SHIPPED_PRESETS, type TemplatePresets } from '@/lib/design/template-options';
import type { PageDocument, Region } from '@/lib/design/page-document';

// Quick Edit on the running page (P1.7; APEX: the Developer Toolbar's Quick
// Edit menu, UX map: "Quick Edit Mode: click a component to jump into Page
// Designer for it, ESCAPE or click outside to exit. Edit Live Template Options:
// hover the component then click its Wrench icon"). The region under the
// pointer is outlined (the served page wraps every region in `data-region`,
// which the dynamic actions already find); in Quick Edit Mode a click opens the
// designer on this page with the region selected, in the ONE developer tab (the
// operator, 2026-09-15: "the one tab i have for developing the app", the way
// Save and Run reuses the one running tab); in Edit Live Template Options the
// wrench opens P1.2's Template Options dialog, and OK publishes the running
// revision with the new list and reloads, the way Save and Run publishes. The
// mode is a moment: Escape or a click outside a region exits (the operator:
// hideable; the toolbar's menu turns it off too). Loaded on demand.

export type QuickEditMode = 'jump' | 'live';

interface Detail {
  live: { id: string } | null;
  newest: { id: string; problems: string[]; document: PageDocument } | null;
}

const LABEL = 'bg-brand px-1.5 py-0.5 font-mono text-9 uppercase tracking-[0.12em] text-bg';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The region's rectangle on the screen, for the outline; null when it is not on the page. */
function measure(id: string): Box | null {
  const el = document.querySelector<HTMLElement>(`[data-region="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function QuickEdit({
  mode,
  pageId,
  designerTab,
  onExit,
  reload = () => window.location.reload(),
}: {
  mode: QuickEditMode;
  /** The page row this address serves (Quick Edit needs a page of the application). */
  pageId: string;
  /** The developer tab's name, the one the designer gives its own window. */
  designerTab: string;
  onExit: () => void;
  /** After a live publish; a prop so a test can watch it (jsdom's location cannot be stubbed). */
  reload?: () => void;
}) {
  // The last region hovered and its rectangle, read again on scroll and resize.
  const [over, setOver] = useState<{ id: string; box: Box } | null>(null);
  const hover = over?.id ?? null;
  const [dialog, setDialog] = useState(false);
  const [detail, setDetail] = useState<Detail | 'error' | null>(null);
  const [presets, setPresets] = useState<TemplatePresets>(SHIPPED_PRESETS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The pointer and the keyboard. Bubble-phase listeners: while the dialog is
  // open, its Sheet takes Escape in the capture phase and stops it, and these
  // stand down as well, so Escape closes the dialog alone and Quick Edit stays.
  useEffect(() => {
    const over = (e: MouseEvent) => {
      if (dialog) return;
      const el = (e.target as Element | null)?.closest?.('[data-region]');
      const id = el?.getAttribute('data-region');
      if (!id) return;
      const box = measure(id);
      if (box) setOver({ id, box });
    };
    const down = (e: MouseEvent) => {
      if (dialog) return;
      const t = e.target as Element | null;
      if (t?.closest?.('[data-region], [data-quick-edit], [data-developer-toolbar]')) return;
      onExit();
    };
    const key = (e: KeyboardEvent) => {
      if (dialog) return;
      if (e.key === 'Escape') onExit();
    };
    const move = () => setOver(h => (h ? { id: h.id, box: measure(h.id) ?? h.box } : h));
    document.addEventListener('mouseover', over);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', move, true);
    window.addEventListener('resize', move);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', move, true);
      window.removeEventListener('resize', move);
    };
  }, [dialog, onExit]);

  // Live mode reads the running page's detail (the document the wrench edits)
  // and the site's presets (what Default draws), once.
  useEffect(() => {
    if (mode !== 'live') return;
    let live = true;
    Promise.all([
      fetch(`/api/admin/design/pages/${pageId}`, { cache: 'no-store' }).then(r => (r.ok ? (r.json() as Promise<unknown>) : null)),
      fetch('/api/admin/design/appearance', { cache: 'no-store' }).then(r => (r.ok ? (r.json() as Promise<{ appearance?: { templates?: TemplatePresets } }>) : null)),
    ])
      .then(([d, a]) => {
        if (!live) return;
        setDetail(d && typeof d === 'object' && 'newest' in d ? (d as Detail) : 'error');
        if (a?.appearance?.templates) setPresets(a.appearance.templates);
      })
      .catch(() => {
        if (live) setDetail('error');
      });
    return () => {
      live = false;
    };
  }, [mode, pageId]);

  const region: Region | undefined = detail && detail !== 'error' && hover ? detail.newest?.document.regions.find(r => r.id === hover) : undefined;
  const reason =
    mode !== 'live'
      ? null
      : detail === null
        ? 'Reading the page…'
        : detail === 'error'
          ? 'The running page could not be read'
          : !detail.newest
            ? 'The page has no revision yet'
            : detail.newest.id !== detail.live?.id
              ? 'A draft newer than the running page exists; finish it in the designer'
              : detail.newest.problems.length > 0
                ? 'The running revision has problems; open the designer'
                : !region
                  ? 'This region is not in the running revision'
                  : null;

  const jump = () => {
    if (!hover) return;
    window.open(`/admin/designer?ws=builder&page=${pageId}&region=${encodeURIComponent(hover)}`, designerTab)?.focus();
  };

  async function publish(next: string[] | undefined) {
    if (!detail || detail === 'error' || !detail.newest || !hover) return;
    setDialog(false);
    setBusy(true);
    setError(null);
    const regions = detail.newest.document.regions.map(r => {
      if (r.id !== hover) return r;
      const y: Region = { ...r };
      if (next) y.templateOptions = next;
      else delete y.templateOptions;
      return y;
    });
    try {
      const res = await fetch(`/api/admin/design/pages/${pageId}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document: { ...detail.newest.document, regions }, action: 'publish', base: detail.live?.id ?? null }),
      });
      if (res.status === 409) {
        setError('The page was published again after this tab loaded it.');
        return;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `Publish failed (${res.status})`);
        return;
      }
      reload();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const box = over?.box ?? null;
  return (
    <div data-quick-edit={mode}>
      {box &&
        hover &&
        (mode === 'jump' ? (
          <button
            type="button"
            data-quick-edit-outline=""
            aria-label={`Open ${hover} in the designer`}
            className="fixed z-[60] flex items-start justify-end border-2 border-brand bg-brand/5 p-1 text-left transition-colors hover:bg-brand/15"
            style={box}
            onClick={jump}
          >
            <span className={LABEL}>{hover}</span>
          </button>
        ) : (
          <div data-quick-edit-outline="" className="pointer-events-none fixed z-[60] border-2 border-brand bg-brand/5" style={box}>
            <div className="pointer-events-auto absolute right-1 top-1 flex items-center gap-1">
              <span className={LABEL}>{hover}</span>
              <button
                type="button"
                aria-label={`Edit the template options of ${hover}`}
                title={reason ?? 'Live Template Options'}
                disabled={reason !== null || busy}
                className="grid h-7 w-7 place-items-center rounded-full bg-brand text-bg shadow transition-opacity disabled:opacity-50"
                onClick={() => setDialog(true)}
              >
                <Wrench size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      {dialog && region && <TemplateOptionsDialog value={region.templateOptions} presets={presets} onOk={publish} onCancel={() => setDialog(false)} />}
      {error && (
        <div role="alert" className="fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 border border-negative bg-bg px-3 py-2 text-12 text-text shadow-lg">
          <span>{error}</span>
          <button type="button" className="border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted hover:text-text" onClick={() => reload()}>
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
