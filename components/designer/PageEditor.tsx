'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowDown, ArrowUp, Loader2, Play, Plus, Trash2, Upload } from 'lucide-react';
import {
  BUTTON_LABEL_MAX,
  COLUMNS,
  EMPTY_DOCUMENT,
  IMAGE_ALT_MAX,
  POSITIONS,
  POSITION_LABELS,
  REGION_KINDS,
  REGION_KIND_LABELS,
  REGION_TITLE_MAX,
  STATIC_TEXT_MAX,
  parsePageDocument,
  type PageDocument,
  type Position,
  type Region,
  type RegionKind,
} from '@/lib/design/page-document';
import { DESTINATIONS } from '@/lib/design/destinations';
import type { PageDetail } from '@/lib/design/page-revisions';
import type { EditableAsset } from '@/lib/design/assets';
import type { EditableAuthzScheme } from '@/lib/design/authz';
import type { EditableShortcut } from '@/lib/design/shortcuts';
import { LayoutSchematic } from './LayoutSchematic';
import { DynamicActionsEditor } from './DynamicActionsEditor';

const GO_OPTIONS = Object.entries(DESTINATIONS)
  .filter(([, d]) => d.kind !== 'action')
  .map(([key, d]) => ({ key, label: d.label }))
  .sort((a, b) => a.label.localeCompare(b.label));

// The page editor (APEX: Page Designer's Layout tab with the Gallery and the
// Property Editor), Phase 3 step 2b. The schematic on the left draws the
// working copy of the newest revision; a tile selected there opens its
// properties on the right (identification, layout, security, source); the
// gallery above them adds a region of a kind to a position. Every change is a
// working copy until Save draft or Publish writes a new revision through the
// one write path; the parser that refuses a bad document on the server runs
// here as you edit, so Save is held with the reason on screen rather than
// refused after the round trip. Publish carries the live revision the screen
// loaded; a stale one comes back as a conflict with Reload.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'inline-flex items-center gap-1 border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';
const LABEL = 'grid gap-1 text-11 text-text-muted';

const FALLBACK_SCHEMES: { key: string; label: string }[] = [
  { key: 'public', label: 'Public' },
  { key: 'signed_in', label: 'Signed in' },
  { key: 'contributor', label: 'Contributor' },
  { key: 'administrator', label: 'Administrator' },
];

const ORDER: Record<string, number> = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));

/** Regions in position and sequence order, renumbered by tens within each position. */
export function renumber(regions: Region[]): Region[] {
  const sorted = [...regions].sort((a, b) => ORDER[a.position] - ORDER[b.position] || a.seq - b.seq);
  const next: Partial<Record<Position, number>> = {};
  return sorted.map(r => {
    const seq = (next[r.position] ?? 0) + 10;
    next[r.position] = seq;
    return r.seq === seq ? r : { ...r, seq };
  });
}

/** A fresh id for a region of a kind: text-1, photo-2, list-1, button-1. */
export function nextRegionId(kind: RegionKind, taken: readonly string[]): string {
  const base = kind === 'static' ? 'text' : kind === 'image' ? 'photo' : kind === 'list' ? 'list' : 'button';
  let n = 1;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function newRegion(kind: RegionKind, position: Position, id: string): Region {
  const base = { id, title: '', position, seq: 1_000_000, column: 1, span: COLUMNS, newRow: false, authz: null, hidden: false };
  if (kind === 'static') return { ...base, kind, text: '' };
  if (kind === 'image') return { ...base, kind, assetId: '', alt: '', showCaption: true };
  if (kind === 'button') return { ...base, kind, label: 'Read more', dest: null };
  return { ...base, kind, listKey: 'doors', style: 'links' };
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

export function PageEditor({
  detail,
  readOnly,
  lists,
  assets,
  schemes,
  shortcuts,
  onSaved,
}: {
  detail: PageDetail;
  readOnly: boolean;
  /** The navigation lists a List region may name. */
  lists: { key: string; label: string }[];
  /** The operator's photos an Image region may name. */
  assets: EditableAsset[];
  /** The authorization schemes a region may require; the shipped four when not loaded. */
  schemes?: EditableAuthzScheme[];
  /** The shortcuts Static Content may insert. */
  shortcuts: EditableShortcut[];
  /** The detail as stored after a save or a reload. */
  onSaved: (detail: PageDetail) => void;
}) {
  const { page, live, newest, revisions } = detail;
  const pageId = page.id ?? '';
  const stored = newest?.document ?? EMPTY_DOCUMENT;
  const [doc, setDoc] = useState<PageDocument>(stored);
  const [seenNewest, setSeenNewest] = useState<string | null>(newest?.id ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  const [addAt, setAddAt] = useState<Position>('body');
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [conflict, setConflict] = useState<PageDetail | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // A new newest revision (after a save or a reload) replaces the working copy:
  // adjusted during render, React's own pattern for state that follows a prop.
  if ((newest?.id ?? null) !== seenNewest) {
    setSeenNewest(newest?.id ?? null);
    setDoc(stored);
  }

  const parsed = parsePageDocument(doc);
  const problems = parsed.problems;
  const dirty = JSON.stringify(doc) !== JSON.stringify(stored);
  const region = selected ? (doc.regions.find(r => r.id === selected) ?? null) : null;
  const unpublishedNewest = newest !== null && newest.id !== (live?.id ?? null);
  const canDraft = !readOnly && !busy && problems.length === 0 && dirty;
  const canPublish = !readOnly && !busy && problems.length === 0 && (dirty || unpublishedNewest);
  const schemeOptions = schemes ? schemes.map(s => ({ key: s.key, label: s.label })) : FALLBACK_SCHEMES;

  const patch = (id: string, fn: (r: Region) => Region) =>
    setDoc(d => ({ ...d, regions: renumber(d.regions.map(r => (r.id === id ? fn(r) : r))) }));

  const add = (kind: RegionKind) => {
    const id = nextRegionId(kind, doc.regions.map(r => r.id));
    setDoc(d => ({ ...d, regions: renumber([...d.regions, newRegion(kind, addAt, id)]) }));
    setSelected(id);
  };
  // Removing a region takes with it every trigger and effect that named it; an
  // action left with no effect goes too, so the parser never sees a dangling name.
  const remove = (id: string) => {
    setDoc(d => ({
      ...d,
      regions: renumber(d.regions.filter(r => r.id !== id)),
      actions: d.actions
        .filter(a => !('region' in a.when && a.when.region === id))
        .map(a => ({ ...a, do: a.do.filter(e => e.action === 'go' || e.region !== id) }))
        .filter(a => a.do.length > 0),
    }));
    setSelected(null);
  };
  const move = (id: string, dir: -1 | 1) => {
    setDoc(d => {
      const ordered = renumber(d.regions);
      const me = ordered.find(r => r.id === id);
      if (!me) return d;
      const siblings = ordered.filter(r => r.position === me.position);
      const i = siblings.findIndex(r => r.id === id);
      const other = siblings[i + dir];
      if (!other) return d;
      return {
        ...d,
        regions: renumber(ordered.map(r => (r.id === me.id ? { ...r, seq: other.seq } : r.id === other.id ? { ...r, seq: me.seq } : r))),
      };
    });
  };
  const setLayout = (id: string, column: number, span: number) => {
    const c = Math.min(COLUMNS, Math.max(1, Math.round(column) || 1));
    const s = Math.min(COLUMNS + 1 - c, Math.max(1, Math.round(span) || 1));
    patch(id, r => ({ ...r, column: c, span: s }));
  };
  const insertShortcut = (id: string, key: string) => {
    const el = textRef.current;
    patch(id, r => {
      if (r.kind !== 'static') return r;
      const start = el ? el.selectionStart : r.text.length;
      const end = el ? el.selectionEnd : start;
      const token = `{shortcut:${key}}`;
      const text = r.text.slice(0, start) + token + r.text.slice(end);
      if (el) {
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + token.length, start + token.length);
        });
      }
      return { ...r, text };
    });
  };

  // Save and run (APEX: Save and Run Page): a draft when something changed,
  // then the newest revision opens in a new tab at /preview/<id>, wearing the
  // runtime developer toolbar. With nothing changed the newest revision opens
  // as it is.
  async function saveAndRun() {
    if (busy || readOnly || problems.length > 0) return;
    if (!dirty) {
      if (newest) window.open(`/preview/${newest.id}`, '_blank', 'noopener');
      return;
    }
    const saved = await save('draft');
    if (saved) window.open(`/preview/${saved}`, '_blank', 'noopener');
  }

  /** Saves through the revisions route; resolves to the new revision's id, or null. */
  async function save(action: 'draft' | 'publish'): Promise<string | null> {
    if (busy || readOnly) return null;
    setBusy(action);
    setError(null);
    setNote(null);
    setConflict(null);
    try {
      const res = await fetch(`/api/admin/design/pages/${pageId}/revisions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          document: parsed.value,
          action,
          base: action === 'publish' ? (live?.id ?? null) : (newest?.id ?? null),
        }),
      });
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as { current?: PageDetail | null };
        if (d.current) setConflict(d.current);
        else setError('This page was published again after you loaded it. Reload the page.');
        return null;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `failed (${res.status})`);
        return null;
      }
      const saved = (await res.json().catch(() => ({}))) as { revision?: { id?: string } };
      const fresh = await fetch(`/api/admin/design/pages/${pageId}`, { cache: 'no-store' });
      if (!fresh.ok) {
        setError(`Saved, but the page could not be reloaded (HTTP ${fresh.status}).`);
        return null;
      }
      setNote(action === 'publish' ? 'Published' : 'Draft saved');
      onSaved((await fresh.json()) as PageDetail);
      return saved.revision?.id ?? null;
    } catch {
      setError('Network error. Try again.');
      return null;
    } finally {
      setBusy(null);
    }
  }

  const status = error
    ? error
    : problems.length > 0
      ? problems.length === 1
        ? '1 problem holds Save'
        : `${problems.length} problems hold Save`
      : busy
        ? busy === 'publish'
          ? 'Publishing…'
          : 'Saving…'
        : dirty
          ? 'Unsaved changes'
          : note
            ? `${note} · ${newest ? when(newest.createdAt) : ''}`
            : newest
              ? `${newest.publishedAt ? 'Live' : 'Draft'} from ${when(newest.createdAt)}${live && newest.id !== live.id ? ` · live from ${when(live.publishedAt ?? live.createdAt)}` : ''}`
              : 'No revision yet';

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!readOnly && (
          <>
            <button type="button" className={TB} disabled={!canDraft} onClick={() => void save('draft')}>
              {busy === 'draft' ? <Loader2 size={13} className="animate-spin" /> : null}
              Save draft
            </button>
            <button type="button" className={TB_PRIMARY} disabled={!canPublish} onClick={() => void save('publish')}>
              {busy === 'publish' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              Publish
            </button>
            <button
              type="button"
              className={TB}
              disabled={Boolean(busy) || problems.length > 0 || (!dirty && !newest)}
              title="Save a draft and open it in a new tab, wearing the developer toolbar"
              onClick={() => void saveAndRun()}
            >
              <Play size={13} />
              Save and run
            </button>
          </>
        )}
        <span className={`font-mono text-9 uppercase tracking-[0.1em] ${error || problems.length > 0 ? 'text-negative' : 'text-text-faint'}`}>
          {status}
        </span>
        {readOnly && <span className="text-11 text-text-faint">Read-only here: the layout is edited on production.</span>}
      </div>

      {conflict && (
        <div className="mb-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text">
          <p className="m-0">
            This page was published again after you loaded it. Reload to see what is stored now; your unsaved changes are
            dropped.
          </p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={PBTN} onClick={() => onSaved(conflict)}>
              Reload
            </button>
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <ul className="m-0 mb-3 list-none p-0 text-11 text-negative">
          {problems.map(p => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {newest && newest.problems.length > 0 && (
        <p className="mb-3 max-w-[76ch] border border-border-strong bg-surface px-3 py-2 text-12 text-negative">
          The stored document had problems the reader worked around: {newest.problems.join('; ')}. Saving writes the
          usable part.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <LayoutSchematic document={doc} selected={selected} onSelect={id => setSelected(id === selected ? null : id)} />
        </div>

        <aside className="grid content-start gap-3">
          {!readOnly && (
            <section className="border border-border-strong bg-surface p-3">
              <h3 className="m-0 mb-2 text-12 font-bold text-text">Add a region</h3>
              <div className="grid gap-2">
                <label className={LABEL}>
                  To
                  <select value={addAt} aria-label="Position for a new region" className={FIELD} onChange={e => setAddAt(e.target.value as Position)}>
                    {POSITIONS.map(p => (
                      <option key={p} value={p}>
                        {POSITION_LABELS[p].label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {REGION_KINDS.map(k => (
                    <button key={k} type="button" className={PBTN} onClick={() => add(k)} title={REGION_KIND_LABELS[k].holds}>
                      <Plus size={10} /> {REGION_KIND_LABELS[k].label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {region ? (
            <RegionProperties
              region={region}
              regions={doc.regions}
              readOnly={readOnly}
              lists={lists}
              assets={assets}
              schemes={schemeOptions}
              shortcuts={shortcuts}
              textRef={textRef}
              onPatch={fn => patch(region.id, fn)}
              onLayout={(column, span) => setLayout(region.id, column, span)}
              onMove={dir => move(region.id, dir)}
              onRemove={() => remove(region.id)}
              onInsertShortcut={key => insertShortcut(region.id, key)}
            />
          ) : (
            <p className="m-0 border border-dashed border-border px-3 py-4 text-12 text-text-faint">
              Select a region on the schematic to edit it{readOnly ? '' : ', or add one above'}.
            </p>
          )}
        </aside>
      </div>

      <DynamicActionsEditor
        actions={doc.actions}
        regions={doc.regions}
        readOnly={readOnly}
        onChange={actions => setDoc(d => ({ ...d, actions }))}
      />

      <h3 className="mb-2 mt-5 text-13 font-bold text-text">Revisions</h3>
      {revisions.length === 0 ? (
        <p className="text-12 text-text-faint">None yet.</p>
      ) : (
        <div className="border border-border-strong bg-surface">
          <table className="w-full border-collapse text-12">
            <thead>
              <tr className="text-left text-text-faint">
                <th className="px-2.5 py-1.5 font-semibold">Saved</th>
                <th className="px-2.5 py-1.5 font-semibold">State</th>
                <th className="px-2.5 py-1.5 font-semibold">By</th>
                <th className="px-2.5 py-1.5 font-semibold">Revision</th>
              </tr>
            </thead>
            <tbody>
              {revisions.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-2.5 py-1.5 font-mono text-11 text-text-muted">{when(r.createdAt)}</td>
                  <td className="px-2.5 py-1.5 text-text">
                    {r.publishedAt ? (live && live.id === r.id ? 'live' : 'published, superseded') : 'draft'}
                  </td>
                  <td className="px-2.5 py-1.5 font-mono text-11 text-text-faint">{r.author ? r.author.slice(0, 12) : '—'}</td>
                  <td className="px-2.5 py-1.5 font-mono text-9 text-text-faint">{r.id.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RegionProperties({
  region,
  regions,
  readOnly,
  lists,
  assets,
  schemes,
  shortcuts,
  textRef,
  onPatch,
  onLayout,
  onMove,
  onRemove,
  onInsertShortcut,
}: {
  region: Region;
  regions: Region[];
  readOnly: boolean;
  lists: { key: string; label: string }[];
  assets: EditableAsset[];
  schemes: { key: string; label: string }[];
  shortcuts: EditableShortcut[];
  textRef: React.RefObject<HTMLTextAreaElement | null>;
  onPatch: (fn: (r: Region) => Region) => void;
  onLayout: (column: number, span: number) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onInsertShortcut: (key: string) => void;
}) {
  const siblings = regions.filter(r => r.position === region.position);
  const index = siblings.findIndex(r => r.id === region.id);
  const asset = region.kind === 'image' ? assets.find(a => a.id === region.assetId) : undefined;
  return (
    <section className="grid gap-3 border border-border-strong bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="block font-mono text-9 uppercase tracking-[0.12em] text-text-faint">{REGION_KIND_LABELS[region.kind].label}</span>
          <span className="block text-11 text-text-muted">{REGION_KIND_LABELS[region.kind].holds}</span>
        </div>
        {!readOnly && (
          <button type="button" className={`${PBTN} text-negative`} onClick={onRemove} aria-label={`Remove ${region.id}`}>
            <Trash2 size={10} /> Remove
          </button>
        )}
      </div>

      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1 text-11 font-semibold text-text">Identification</legend>
        <label className={LABEL}>
          Id
          <input
            type="text"
            value={region.id}
            disabled={readOnly}
            spellCheck={false}
            aria-label="Region id"
            className={`${FIELD} font-mono text-11`}
            onChange={e => onPatch(r => ({ ...r, id: e.target.value.trim().toLowerCase() }))}
          />
        </label>
        <label className={LABEL}>
          Title
          <input
            type="text"
            value={region.title}
            maxLength={REGION_TITLE_MAX}
            disabled={readOnly}
            aria-label="Region title"
            className={FIELD}
            onChange={e => onPatch(r => ({ ...r, title: e.target.value }))}
          />
        </label>
      </fieldset>

      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1 text-11 font-semibold text-text">Layout</legend>
        <label className={LABEL}>
          Position
          <select
            value={region.position}
            disabled={readOnly}
            aria-label="Region position"
            className={FIELD}
            onChange={e => onPatch(r => ({ ...r, position: e.target.value as Position, seq: 1_000_000 }))}
          >
            {POSITIONS.map(p => (
              <option key={p} value={p}>
                {POSITION_LABELS[p].label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <label className={LABEL}>
            Column
            <input
              type="number"
              min={1}
              max={COLUMNS}
              value={region.column}
              disabled={readOnly}
              aria-label="Region column"
              className={FIELD}
              onChange={e => onLayout(Number(e.target.value), region.span)}
            />
          </label>
          <label className={LABEL}>
            Span
            <input
              type="number"
              min={1}
              max={COLUMNS + 1 - region.column}
              value={region.span}
              disabled={readOnly}
              aria-label="Region span"
              className={FIELD}
              onChange={e => onLayout(region.column, Number(e.target.value))}
            />
          </label>
          <div className="flex gap-1 pb-px">
            <button type="button" className={PBTN} disabled={readOnly || index <= 0} onClick={() => onMove(-1)} aria-label="Move earlier">
              <ArrowUp size={10} />
            </button>
            <button type="button" className={PBTN} disabled={readOnly || index >= siblings.length - 1} onClick={() => onMove(1)} aria-label="Move later">
              <ArrowDown size={10} />
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-11 text-text-muted">
          <input
            type="checkbox"
            checked={region.newRow}
            disabled={readOnly}
            aria-label="Start a new row"
            onChange={e => onPatch(r => ({ ...r, newRow: e.target.checked }))}
          />
          Start a new row
        </label>
        <label className="flex items-center gap-2 text-11 text-text-muted">
          <input
            type="checkbox"
            checked={region.hidden}
            disabled={readOnly}
            aria-label="Hidden until an action shows it"
            onChange={e => onPatch(r => ({ ...r, hidden: e.target.checked }))}
          />
          Hidden until a dynamic action shows it
        </label>
        <span className="font-mono text-9 text-text-faint">
          {index + 1} of {siblings.length} in {POSITION_LABELS[region.position].label}
        </span>
      </fieldset>

      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1 text-11 font-semibold text-text">Security</legend>
        <label className={LABEL}>
          Who sees it
          <select
            value={region.authz ?? ''}
            disabled={readOnly}
            aria-label="Region authorization"
            className={FIELD}
            onChange={e => onPatch(r => ({ ...r, authz: e.target.value || null }))}
          >
            <option value="">Everyone</option>
            {schemes.map(s => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1 text-11 font-semibold text-text">Source</legend>
        {region.kind === 'static' && (
          <>
            <label className={LABEL}>
              Text
              <textarea
                ref={textRef}
                value={region.text}
                rows={8}
                maxLength={STATIC_TEXT_MAX}
                disabled={readOnly}
                aria-label="Region text"
                className={`${FIELD} resize-y font-sans`}
                onChange={e => onPatch(r => (r.kind === 'static' ? { ...r, text: e.target.value } : r))}
              />
            </label>
            <div className="flex items-center justify-between gap-2">
              <select
                value=""
                disabled={readOnly || shortcuts.length === 0}
                aria-label="Insert a shortcut"
                className={`${FIELD} w-auto`}
                onChange={e => {
                  if (e.target.value) onInsertShortcut(e.target.value);
                }}
              >
                <option value="">Insert a shortcut…</option>
                {shortcuts.map(s => (
                  <option key={s.key} value={s.key}>
                    {s.key}
                  </option>
                ))}
              </select>
              <span className="font-mono text-9 text-text-faint">
                {region.text.length.toLocaleString()} / {STATIC_TEXT_MAX.toLocaleString()}
              </span>
            </div>
          </>
        )}
        {region.kind === 'image' && (
          <>
            <label className={LABEL}>
              Photo
              <select
                value={region.assetId}
                disabled={readOnly}
                aria-label="Region photo"
                className={FIELD}
                onChange={e => onPatch(r => (r.kind === 'image' ? { ...r, assetId: e.target.value } : r))}
              >
                <option value="">Choose a photo…</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.caption || a.key}
                  </option>
                ))}
              </select>
            </label>
            {assets.length === 0 && (
              <p className="m-0 text-11 text-text-faint">No photos yet: upload one under Shared Components › Assets first.</p>
            )}
            {asset && (
              <Image
                src={asset.url}
                alt=""
                width={asset.width ?? 400}
                height={asset.height ?? 300}
                unoptimized
                className="max-h-32 w-full border border-border object-cover"
              />
            )}
            <label className={LABEL}>
              Alternative text
              <input
                type="text"
                value={region.alt}
                maxLength={IMAGE_ALT_MAX}
                disabled={readOnly}
                aria-label="Alternative text"
                className={FIELD}
                onChange={e => onPatch(r => (r.kind === 'image' ? { ...r, alt: e.target.value } : r))}
              />
            </label>
            <label className="flex items-center gap-2 text-11 text-text-muted">
              <input
                type="checkbox"
                checked={region.showCaption}
                disabled={readOnly}
                aria-label="Show the caption and credit"
                onChange={e => onPatch(r => (r.kind === 'image' ? { ...r, showCaption: e.target.checked } : r))}
              />
              Show the caption and credit
            </label>
          </>
        )}
        {region.kind === 'button' && (
          <>
            <label className={LABEL}>
              Label
              <input
                type="text"
                value={region.label}
                maxLength={BUTTON_LABEL_MAX}
                disabled={readOnly}
                aria-label="Button label"
                className={FIELD}
                onChange={e => onPatch(r => (r.kind === 'button' ? { ...r, label: e.target.value } : r))}
              />
            </label>
            <label className={LABEL}>
              Goes to
              <select
                value={region.dest ?? ''}
                disabled={readOnly}
                aria-label="Button destination"
                className={FIELD}
                onChange={e => onPatch(r => (r.kind === 'button' ? { ...r, dest: e.target.value || null } : r))}
              >
                <option value="">Nowhere: it fires dynamic actions only</option>
                {GO_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {region.kind === 'list' && (
          <>
            <label className={LABEL}>
              List
              <select
                value={region.listKey}
                disabled={readOnly}
                aria-label="Region list"
                className={FIELD}
                onChange={e => onPatch(r => (r.kind === 'list' ? { ...r, listKey: e.target.value } : r))}
              >
                {lists.map(l => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Style
              <select
                value={region.style}
                disabled={readOnly}
                aria-label="Region list style"
                className={FIELD}
                onChange={e => onPatch(r => (r.kind === 'list' ? { ...r, style: e.target.value === 'cards' ? 'cards' : 'links' } : r))}
              >
                <option value="links">Links</option>
                <option value="cards">Cards</option>
              </select>
            </label>
          </>
        )}
      </fieldset>
    </section>
  );
}
