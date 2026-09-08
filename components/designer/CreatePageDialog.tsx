'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Plus, X } from 'lucide-react';
import { CODE_PAGES, PAGE_GROUPS, PAGE_GROUP_LABELS, type PageGroup } from '@/lib/design/page-registry';
import { COLUMNS, PAGE_NAME_MAX, POSITIONS, rowPagePathProblem, rowsAt, type PageDocument, type Position } from '@/lib/design/page-document';
import { PAGE_TEMPLATES, pageTemplate, type PageTemplate, type PageTemplateKey } from '@/lib/design/page-templates';
import type { PageRow } from '@/lib/design/pages';

// The Create page dialog (APEX: the Create Page wizard, a modal with page types
// to choose from, each drawn with its layout). Step 1 chooses a template, a
// starting layout named for the kind of page it makes, drawn as a miniature of
// the schematic; step 2 names the page, gives it a path the code does not serve
// and a group. Creating writes the page and, unless the template is Blank, its
// first draft revision, in one database transaction; the page then opens.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'inline-flex items-center border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';

// The six positions as bands of a 120 × 80 miniature.
const BAND: Record<Position, { y: number; h: number }> = {
  header: { y: 0, h: 9 },
  breadcrumb: { y: 11, h: 5 },
  body: { y: 18, h: 32 },
  right: { y: 52, h: 12 },
  footer: { y: 66, h: 8 },
  phonebar: { y: 76, h: 4 },
};
const FILL: Record<string, string> = { static: 'fill-text-muted', list: 'fill-edit', image: 'fill-positive' };

/** A document as a miniature of the schematic: six bands, a filled block per region. */
export function TemplateThumb({ document, className }: { document: PageDocument; className?: string }) {
  const unit = 120 / COLUMNS;
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden="true">
      {POSITIONS.map(position => {
        const band = BAND[position];
        const rows = rowsAt(document, position);
        const rowH = rows.length > 0 ? (band.h - (rows.length - 1)) / rows.length : band.h;
        return (
          <g key={position}>
            <rect
              x="0.5"
              y={band.y + 0.5}
              width="119"
              height={band.h - 1}
              className="fill-none stroke-border-strong"
              strokeWidth="1"
              strokeDasharray={rows.length === 0 ? '2 2' : undefined}
            />
            {rows.map((row, ri) =>
              row.map(r => (
                <rect
                  key={r.id}
                  x={(r.column - 1) * unit + 1}
                  y={band.y + ri * (rowH + 1) + 1}
                  width={r.span * unit - 2}
                  height={Math.max(1, rowH - 2)}
                  className={FILL[r.kind]}
                />
              )),
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Mounted only while open (PagesList renders it conditionally), so every
// opening starts fresh at step 1 with no leftover fields.
export function CreatePageDialog({
  pages,
  onClose,
  onCreated,
}: {
  /** Every page listed, so the path check knows the stored row pages. */
  pages: PageRow[];
  onClose: () => void;
  onCreated: (page: PageRow) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [key, setKey] = useState<PageTemplateKey>('article');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [group, setGroup] = useState<PageGroup>('editorial');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const template = pageTemplate(key) ?? PAGE_TEMPLATES[0];
  const rowPaths = pages.filter(p => p.kind === 'row').map(p => p.path);
  const pathProblem = path ? rowPagePathProblem(path, CODE_PAGES.map(p => p.path), rowPaths) : 'needs a path';
  const nameProblem = !name.trim() ? 'needs a name' : name.length > PAGE_NAME_MAX ? `a name is at most ${PAGE_NAME_MAX} characters` : null;

  const choose = (t: PageTemplate) => {
    setKey(t.key);
    setGroup(t.group);
  };

  async function create() {
    if (busy || pathProblem || nameProblem) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/design/pages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), path, group, template: template.key }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `failed (${res.status})`);
        return;
      }
      const d = (await res.json()) as { page: PageRow };
      setName('');
      setPath('');
      onCreated(d.page);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-page-title"
        className="w-full max-w-[880px] border border-border-strong bg-bg text-text outline-none"
      >
        <div className="flex items-center justify-between border-b border-border-strong bg-surface px-4 py-2">
          <span className="font-mono text-9 uppercase tracking-[0.16em] text-text-muted">Create page · step {step} of 2</span>
          <button type="button" aria-label="Close" onClick={onClose} className={PBTN}>
            <X size={12} />
          </button>
        </div>

        {step === 1 ? (
          <>
            <div className="p-4">
              <h2 id="create-page-title" className="m-0 text-16 font-bold text-text">
                Choose a template
              </h2>
              <p className="m-0 mb-3 max-w-[72ch] text-12 text-text-muted">
                A template is a starting layout, named for the kind of page it makes. Everything on it can be changed
                afterwards; Blank starts empty.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {PAGE_TEMPLATES.map(t => {
                  const on = t.key === key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => choose(t)}
                      className={`grid gap-1.5 border p-3 text-left transition-colors duration-(--duration-fast) ${
                        on ? 'border-edit bg-edit-dim' : 'border-border-strong bg-surface hover:border-text-muted'
                      }`}
                    >
                      <TemplateThumb document={t.document} className="mb-1 w-full" />
                      <span className="block font-mono text-9 uppercase tracking-[0.12em] text-text-faint">like {t.like}</span>
                      <span className="block text-13 font-semibold text-text">{t.name}</span>
                      <span className="block text-11 leading-snug text-text-muted">{t.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border-strong px-4 py-3">
              <button type="button" className={TB} onClick={onClose}>
                Cancel
              </button>
              <button type="button" className={TB_PRIMARY} onClick={() => setStep(2)}>
                Next <ArrowRight size={13} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-5 p-4 md:grid-cols-[240px_minmax(0,1fr)]">
              <div>
                <TemplateThumb document={template.document} className="mb-2 w-full border border-border-strong bg-surface p-2" />
                <span className="block font-mono text-9 uppercase tracking-[0.12em] text-text-faint">like {template.like}</span>
                <span className="block text-13 font-semibold text-text">{template.name}</span>
                <span className="mb-2 block text-11 leading-snug text-text-muted">{template.description}</span>
                <button type="button" className={PBTN} onClick={() => setStep(1)}>
                  <ArrowLeft size={11} className="mr-1" /> Change template
                </button>
              </div>
              <div>
                <h2 id="create-page-title" className="m-0 text-16 font-bold text-text">
                  Name the page
                </h2>
                <p className="m-0 mb-3 max-w-[60ch] text-12 text-text-muted">
                  A literal address such as /history/monza, never one the code serves. The page starts unindexed and
                  for everyone; the {template.key === 'blank' ? 'schematic starts empty' : 'template becomes its first draft'}.
                </p>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-11 text-text-muted">
                    Name
                    <input
                      type="text"
                      value={name}
                      maxLength={PAGE_NAME_MAX}
                      autoFocus
                      aria-label="Name of the new page"
                      className={FIELD}
                      onChange={e => setName(e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-11 text-text-muted">
                    Path
                    <input
                      type="text"
                      value={path}
                      spellCheck={false}
                      placeholder="/history/monza"
                      aria-label="Path of the new page"
                      className={`${FIELD} font-mono text-11 ${path && pathProblem ? 'border-negative' : ''}`}
                      onChange={e => setPath(e.target.value.trim().toLowerCase())}
                    />
                  </label>
                  <label className="grid gap-1 text-11 text-text-muted">
                    Group
                    <select value={group} aria-label="Group of the new page" className={FIELD} onChange={e => setGroup(e.target.value as PageGroup)}>
                      {PAGE_GROUPS.map(g => (
                        <option key={g} value={g}>
                          {PAGE_GROUP_LABELS[g]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className={`m-0 mt-3 font-mono text-9 uppercase tracking-[0.1em] ${error ? 'text-negative' : 'text-text-faint'}`}>
                  {error ?? (path ? pathProblem ?? nameProblem ?? 'ready' : 'name, path and group')}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border-strong px-4 py-3">
              <button type="button" className={TB} onClick={() => setStep(1)}>
                <ArrowLeft size={13} /> Back
              </button>
              <div className="flex gap-2">
                <button type="button" className={TB} onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={TB_PRIMARY}
                  disabled={busy || Boolean(pathProblem) || Boolean(nameProblem)}
                  onClick={() => void create()}
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  {busy ? 'Creating…' : 'Create page'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
