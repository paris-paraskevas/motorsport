'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, RotateCcw, Trash2, Upload } from 'lucide-react';
import {
  ASSET_CAPTION_MAX,
  ASSET_CREDIT_MAX,
  ASSET_LICENCE_MAX,
  ASSET_MAX_BYTES,
  LICENCE_SUGGESTIONS,
  assetFileProblems,
  formatBytes,
  parseAssetMeta,
} from '@/lib/design/asset-defaults';
import type { EditableAsset } from '@/lib/design/assets';

// Assets (APEX: Static Application Files): the operator's photos, as a grid with
// their words, and the one way to add one. An upload goes straight to the site
// (a file transfer is not a draft): the form checks the file's kind and size and
// the words the same way the route does, sends them in one request and re-reads
// the list. Caption, credit and licence of a stored photo are drafts saved on the
// stamp; a deletion removes the row first and then the file. Nothing places a
// photo on a page until Phase 3.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';

interface Draft {
  caption: string;
  credit: string;
  licence: string;
  deleted: boolean;
}

const draftsOf = (assets: EditableAsset[]): Record<string, Draft> =>
  Object.fromEntries(assets.map(a => [a.id, { caption: a.caption, credit: a.credit, licence: a.licence, deleted: false }]));

export function AssetsEditor({
  assets,
  mediaConfigured,
  readOnly,
  onSaved,
}: {
  assets: EditableAsset[];
  /** Whether this Worker has the media binding; without it nothing can be uploaded or served. */
  mediaConfigured: boolean;
  readOnly: boolean;
  onSaved: (assets: EditableAsset[]) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => draftsOf(assets));
  const [file, setFile] = useState<File | null>(null);
  const [words, setWords] = useState({ caption: '', credit: '', licence: '' });
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [conflict, setConflict] = useState<EditableAsset[] | null>(null);

  // New rows from the server replace the drafts (adjusted during render, React's
  // own pattern for state that follows a prop).
  const [seen, setSeen] = useState(assets);
  if (assets !== seen) {
    setSeen(assets);
    setDrafts(draftsOf(assets));
    setConflict(null);
    setError(null);
  }

  const canWrite = !readOnly && mediaConfigured;
  const uploadProblems = [...(file ? assetFileProblems(file) : ['choose a photo']), ...parseAssetMeta(words).problems];

  const draftOf = (a: EditableAsset): Draft => drafts[a.id] ?? { caption: a.caption, credit: a.credit, licence: a.licence, deleted: false };
  const changed = (a: EditableAsset) => {
    const d = draftOf(a);
    return !d.deleted && (d.caption.trim() !== a.caption || d.credit.trim() !== a.credit || d.licence.trim() !== a.licence);
  };
  const work = {
    edits: assets.filter(changed),
    deletes: assets.filter(a => draftOf(a).deleted),
  };
  const count = work.edits.length + work.deletes.length;
  const invalid = work.edits.some(a => parseAssetMeta(draftOf(a)).problems.length > 0);

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts(d => ({ ...d, [id]: { ...(d[id] ?? { caption: '', credit: '', licence: '', deleted: false }), ...patch } }));

  async function upload() {
    if (uploading || !canWrite || !file || uploadProblems.length > 0) return;
    setUploading(true);
    setError(null);
    setUploaded(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('caption', words.caption);
      form.append('credit', words.credit);
      form.append('licence', words.licence);
      const res = await fetch('/api/admin/design/assets', { method: 'POST', body: form });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`upload: ${d.error ?? `failed (${res.status})`}`);
        return;
      }
      const d = (await res.json()) as { asset: EditableAsset };
      const fresh = await fetch('/api/admin/design/assets', { cache: 'no-store' });
      if (fresh.ok) {
        const list = (await fresh.json()) as { assets: EditableAsset[] };
        onSaved(list.assets);
      } else {
        onSaved([d.asset, ...assets]);
      }
      setUploaded(d.asset.key);
      setFile(null);
      setWords({ caption: '', credit: '', licence: '' });
    } catch {
      setError('Network error. Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (busy || !canWrite || count === 0 || invalid) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    setConflict(null);
    const headers = { 'content-type': 'application/json' };
    let done = 0;
    const fail = async (res: Response, what: string): Promise<void> => {
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as { current?: EditableAsset[] | null };
        setConflict(d.current ?? []);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(`${what}: ${d.error ?? `failed (${res.status})`}`);
    };
    try {
      for (const a of work.edits) {
        const d = draftOf(a);
        const res = await fetch(`/api/admin/design/assets/${a.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ caption: d.caption, credit: d.credit, licence: d.licence, updatedAt: a.updatedAt }),
        });
        if (!res.ok) return void (await fail(res, a.caption || a.key));
        done += 1;
      }
      for (const a of work.deletes) {
        const res = await fetch(`/api/admin/design/assets/${a.id}`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ updatedAt: a.updatedAt }),
        });
        if (!res.ok) return void (await fail(res, a.caption || a.key));
        done += 1;
      }
      const fresh = await fetch('/api/admin/design/assets', { cache: 'no-store' });
      if (fresh.ok) {
        const list = (await fresh.json()) as { assets: EditableAsset[] };
        onSaved(list.assets);
      }
      setSaved(done);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Assets</h2>
      <p className="m-0 mb-4 max-w-[72ch] text-13 text-text-muted">
        Your photos, stored with the site and served from it. Every photo carries a credit and a licence, so a page can
        use it later without a licence question. JPEG, PNG or WebP, up to {formatBytes(ASSET_MAX_BYTES)}; the file
        proves its kind by its own bytes. Nothing places a photo on a page until Phase 3.
      </p>

      {!mediaConfigured && (
        <p className="mb-4 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text-muted">
          The media store is not bound on this copy of the site, so nothing can be uploaded or shown here. Production
          has it.
        </p>
      )}

      <section className="mb-5 border border-border-strong bg-surface p-3">
        <h3 className="m-0 text-13 font-bold text-text">Add a photo</h3>
        <p className="m-0 mb-2 text-11 text-text-faint">The upload goes straight to the site; the words can be changed afterwards.</p>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="grid gap-1 text-11 text-text-muted">
            Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!canWrite || uploading}
              aria-label="Photo to upload"
              className="text-12 text-text file:mr-2 file:border file:border-border-strong file:bg-bg file:px-2 file:py-1 file:text-11 file:text-text-muted"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <span className="font-mono text-9 uppercase tracking-[0.1em] text-text-faint">
                {file.name} · {file.type || 'unknown type'} · {formatBytes(file.size)}
              </span>
            )}
          </label>
          <label className="grid gap-1 text-11 text-text-muted">
            Caption <span className="text-text-faint">(optional, what the photo shows)</span>
            <input
              type="text"
              value={words.caption}
              maxLength={ASSET_CAPTION_MAX}
              disabled={!canWrite || uploading}
              aria-label="Caption of the photo to upload"
              className={FIELD}
              onChange={e => setWords(w => ({ ...w, caption: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-11 text-text-muted">
            Credit <span className="text-text-faint">(who took or owns it)</span>
            <input
              type="text"
              value={words.credit}
              maxLength={ASSET_CREDIT_MAX}
              disabled={!canWrite || uploading}
              aria-label="Credit of the photo to upload"
              className={FIELD}
              onChange={e => setWords(w => ({ ...w, credit: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-11 text-text-muted">
            Licence <span className="text-text-faint">(under what terms it may be shown)</span>
            <input
              type="text"
              list="licence-suggestions"
              value={words.licence}
              maxLength={ASSET_LICENCE_MAX}
              disabled={!canWrite || uploading}
              aria-label="Licence of the photo to upload"
              className={FIELD}
              onChange={e => setWords(w => ({ ...w, licence: e.target.value }))}
            />
            <datalist id="licence-suggestions">
              {LICENCE_SUGGESTIONS.map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={TB_PRIMARY} disabled={!canWrite || uploading || uploadProblems.length > 0} onClick={() => void upload()}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <span className="font-mono text-9 uppercase tracking-[0.1em] text-text-faint">
            {uploadProblems.length > 0 ? uploadProblems.join(' · ') : uploaded ? `Stored as ${uploaded}` : 'ready'}
          </span>
        </div>
      </section>

      {assets.length === 0 ? (
        <p className="text-12 text-text-faint">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {assets.map(a => {
            const d = draftOf(a);
            const problems = parseAssetMeta(d).problems;
            const isChanged = changed(a);
            return (
              <div key={a.id} className={`grid content-start gap-2 border bg-surface p-2.5 ${d.deleted ? 'border-negative/60 opacity-60' : 'border-border-strong'}`}>
                <Image
                  src={a.url}
                  alt={a.caption || a.credit}
                  width={a.width ?? 400}
                  height={a.height ?? 300}
                  unoptimized
                  className="h-36 w-full object-cover bg-bg"
                />
                <div className="flex items-baseline justify-between gap-2 font-mono text-9 uppercase tracking-[0.1em] text-text-faint">
                  <span className="truncate" title={a.key}>
                    {a.contentType?.replace('image/', '') ?? 'image'} · {a.width ?? '?'}×{a.height ?? '?'} · {a.bytes != null ? formatBytes(a.bytes) : '?'}
                  </span>
                  {isChanged && <span className="text-edit">changed</span>}
                  {d.deleted && <span className="text-negative">to delete</span>}
                </div>
                <input
                  type="text"
                  value={d.caption}
                  placeholder="Caption"
                  maxLength={ASSET_CAPTION_MAX}
                  disabled={!canWrite || d.deleted}
                  aria-label={`Caption of ${a.key}`}
                  className={FIELD}
                  onChange={e => update(a.id, { caption: e.target.value })}
                />
                <input
                  type="text"
                  value={d.credit}
                  placeholder="Credit"
                  maxLength={ASSET_CREDIT_MAX}
                  disabled={!canWrite || d.deleted}
                  aria-label={`Credit of ${a.key}`}
                  className={FIELD}
                  onChange={e => update(a.id, { credit: e.target.value })}
                />
                <input
                  type="text"
                  value={d.licence}
                  list="licence-suggestions"
                  placeholder="Licence"
                  maxLength={ASSET_LICENCE_MAX}
                  disabled={!canWrite || d.deleted}
                  aria-label={`Licence of ${a.key}`}
                  className={FIELD}
                  onChange={e => update(a.id, { licence: e.target.value })}
                />
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`min-w-0 truncate font-mono text-9 ${problems.length > 0 && !d.deleted ? 'text-negative' : 'text-text-faint'}`}
                    title={a.url}
                  >
                    {!d.deleted && problems.length > 0 ? problems[0] : a.url}
                  </span>
                  <button
                    type="button"
                    className={`${PBTN} ${d.deleted ? '' : 'hover:border-negative hover:text-negative'}`}
                    disabled={!canWrite}
                    title={d.deleted ? 'Keep this photo' : 'Delete this photo'}
                    aria-label={d.deleted ? `Keep ${a.key}` : `Delete ${a.key}`}
                    onClick={() => update(a.id, { deleted: !d.deleted })}
                  >
                    {d.deleted ? <RotateCcw size={11} /> : <Trash2 size={11} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {work.deletes.length > 0 && (
        <p className="mt-3 text-12 text-text-muted">
          To be deleted on Save, row and file: {work.deletes.map(a => a.caption || a.key).join(', ')}.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={TB_PRIMARY} disabled={busy || !canWrite || count === 0 || invalid} onClick={() => void save()}>
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? 'Saving…' : count > 1 ? `Save ${count} changes` : 'Save'}
        </button>
        {count > 0 && !busy && (
          <button type="button" className={TB} onClick={() => setDrafts(draftsOf(assets))}>
            <RotateCcw size={13} /> Discard changes
          </button>
        )}
        <span className="font-mono text-10 uppercase tracking-[0.12em] text-text-faint">
          {count > 0
            ? `${count} unsaved${invalid ? ' · a photo needs its credit and licence' : ''}`
            : saved
              ? `Saved ${saved} · placed on nothing yet`
              : `${assets.length} stored`}
        </span>
      </div>
      {conflict && (
        <div className="mt-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text">
          <p className="m-0">
            The photos were saved again after you loaded them. Reload to see what is stored now; your unsaved changes
            are dropped.
          </p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={PBTN} onClick={() => onSaved(conflict)}>
              Reload
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-12 text-negative">{error}</p>}
    </div>
  );
}
