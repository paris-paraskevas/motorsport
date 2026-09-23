'use client';

import { useState } from 'react';
import { Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { VIEW_KEY_MAX, VIEW_NAME_MAX, encodeViewState, parseViewState, viewKeyProblem, viewNameProblem } from '@/lib/design/view-state';
import type { EditableSavedView, ViewTarget } from '@/lib/design/views';

// Saved Views (P2.3 PR B; APEX: the saved reports of an Interactive Report, the designer-authored tiers alone): the named
// Alternatives of the Data regions, one row each — its key (the share link's ?view=<key>), its name, the page and region it
// belongs to, its definition in the URL vocabulary (`sort=-points&cols=name,points&filter=team.eq:Mercedes`). Save runs
// creates, then edits, then deletes, each through its own route with the stamp that was loaded; a row that moved comes back as
// a conflict with Reload. A stored key, page and region never change (readers share the key in a link): to move a view, add
// the new one and delete the old. Each row shows its History (the stamp) and its Utilization (the page and the region, or
// that the region is gone from the page's newest revision), both from the one scan the route answers with.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-50';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-50';
const FIELD = 'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';

interface Draft {
  /** A client id, stable across renders; the key once the row exists. */
  id: string;
  key: string;
  name: string;
  pageId: string;
  regionId: string;
  /** The definition in the vocabulary's words, as typed. */
  definition: string;
  stored: EditableSavedView | null;
  deleted: boolean;
}

let seq = 0;
const newId = () => `new-${++seq}`;
/** A stored definition in the vocabulary's words: the canonical string, its escapes undone for reading. */
export const definitionText = (v: EditableSavedView): string => decodeURIComponent(encodeViewState(v.definition)).replace(/\+/g, ' ');
const draftsOf = (rows: EditableSavedView[]): Draft[] => rows.map(v => ({ id: v.key, key: v.key, name: v.name, pageId: v.pageId, regionId: v.regionId, definition: definitionText(v), stored: v, deleted: false }));
/** The stamp as History reads it: the day and the minute, UTC. */
const stampOf = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)}Z`;

export function ViewsEditor({ views, targets, readOnly, onSaved }: { views: EditableSavedView[]; targets: ViewTarget[]; readOnly: boolean; onSaved: (next: { views: EditableSavedView[]; targets: ViewTarget[] }) => void }) {
  const [drafts, setDrafts] = useState<Draft[]>(() => draftsOf(views));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [conflict, setConflict] = useState<EditableSavedView[] | null>(null);

  // New rows from the server replace the draft (adjusted during render, React's own pattern for state that follows a prop).
  const [seen, setSeen] = useState(views);
  if (views !== seen) {
    setSeen(views);
    setDrafts(draftsOf(views));
    setConflict(null);
    setError(null);
  }

  const live = drafts.filter(d => !d.deleted);
  const keyCount = new Map<string, number>();
  for (const d of live) keyCount.set(d.key.trim(), (keyCount.get(d.key.trim()) ?? 0) + 1);
  const targetOf = (pageId: string) => targets.find(t => t.pageId === pageId);

  /** The reasons a row cannot be saved, in plain words. */
  const problemsOf = (d: Draft): string[] => {
    const out: string[] = [];
    if (d.stored === null) {
      const p = viewKeyProblem(d.key.trim());
      if (p) out.push(p);
      else if ((keyCount.get(d.key.trim()) ?? 0) > 1) out.push('this key is used twice');
      if (!d.pageId || !d.regionId) out.push('pick a page and a region');
    }
    const n = viewNameProblem(d.name);
    if (n) out.push(n);
    const parsed = parseViewState(d.definition.trim());
    out.push(...parsed.problems);
    if (parsed.value.view !== undefined) out.push('a definition never names a view');
    return out;
  };
  /** What a definition says once read: two texts that read the same are one definition. */
  const canonical = (text: string) => encodeViewState({ ...parseViewState(text.trim()).value, view: undefined });
  const changed = (d: Draft) => d.stored !== null && (d.name.trim() !== d.stored.name || canonical(d.definition) !== encodeViewState(d.stored.definition));

  const work = {
    creates: live.filter(d => d.stored === null),
    edits: live.filter(changed),
    deletes: drafts.filter(d => d.stored !== null && d.deleted),
  };
  const count = work.creates.length + work.edits.length + work.deletes.length;
  const invalid = live.some(d => problemsOf(d).length > 0);

  const update = (id: string, patch: Partial<Draft>) => setDrafts(list => list.map(d => (d.id === id ? { ...d, ...patch } : d)));
  const add = () => setDrafts(list => [...list, { id: newId(), key: '', name: '', pageId: targets[0]?.pageId ?? '', regionId: targets[0]?.regions[0]?.id ?? '', definition: '', stored: null, deleted: false }]);
  const remove = (d: Draft) => (d.stored ? update(d.id, { deleted: true }) : setDrafts(list => list.filter(x => x.id !== d.id)));
  const discard = () => {
    setDrafts(draftsOf(views));
    setError(null);
  };

  async function save() {
    if (busy || readOnly || count === 0 || invalid) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    setConflict(null);
    const headers = { 'content-type': 'application/json' };
    let done = 0;
    // A refusal stops the run; a 409 shows the conflict; anything else is the error line.
    const fail = async (res: Response, what: string): Promise<void> => {
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as { current?: EditableSavedView[] | null };
        setConflict(d.current ?? []);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(`${what}: ${d.error ?? `failed (${res.status})`}`);
    };
    try {
      for (const d of work.creates) {
        const res = await fetch('/api/admin/design/views', { method: 'POST', headers, body: JSON.stringify({ key: d.key.trim(), name: d.name, pageId: d.pageId, regionId: d.regionId, definition: d.definition }) });
        if (!res.ok) return void (await fail(res, d.key.trim() || 'new view'));
        done += 1;
      }
      for (const d of work.edits) {
        const res = await fetch(`/api/admin/design/views/${d.key}`, { method: 'PUT', headers, body: JSON.stringify({ name: d.name, definition: d.definition, updatedAt: d.stored!.updatedAt }) });
        if (!res.ok) return void (await fail(res, d.key));
        done += 1;
      }
      for (const d of work.deletes) {
        const res = await fetch(`/api/admin/design/views/${d.key}`, { method: 'DELETE', headers, body: JSON.stringify({ updatedAt: d.stored!.updatedAt }) });
        if (!res.ok) return void (await fail(res, d.key));
        done += 1;
      }
      const fresh = await fetch('/api/admin/design/views', { cache: 'no-store' });
      if (fresh.ok) {
        const d = (await fresh.json()) as { views: EditableSavedView[]; targets: ViewTarget[] };
        onSaved(d);
      }
      setSaved(done);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const utilization = (d: Draft): { text: string; gone: boolean } => {
    const t = targetOf(d.pageId);
    if (!t) return { text: 'page gone', gone: true };
    const r = t.regions.find(x => x.id === d.regionId);
    return r ? { text: `${t.path} · ${r.label}${r.live ? '' : ' · not live yet'}`, gone: false } : { text: `${t.path} · region ${d.regionId} gone`, gone: true };
  };

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Saved Views</h2>
      <p className="m-0 mb-4 max-w-[72ch] text-13 text-text-muted">
        The named Alternatives of a Data region (APEX: an Interactive Report’s saved reports). Primary is the region as designed; each row here is one more view readers pick from the region’s Views menu and share by its link, <code>?view=key</code>. A definition uses the address’s own words: <code>sort=-points</code>, <code>cols=name,points</code>, <code>filter=team.eq:Mercedes</code>. A key, its page and its region never change once saved: to move a view, add the new one and delete the old.
      </p>
      <div className="border border-border-strong bg-surface">
        <table className="w-full border-collapse text-12">
          <thead>
            <tr className="text-left text-text-faint">
              <th className="w-40 px-2.5 py-2 font-semibold">Key</th>
              <th className="w-44 px-2.5 py-2 font-semibold">Name</th>
              <th className="w-64 px-2.5 py-2 font-semibold">Page · Region</th>
              <th className="px-2.5 py-2 font-semibold">Definition</th>
              <th className="w-10 px-2.5 py-2" />
            </tr>
          </thead>
          <tbody>
            {live.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={5} className="px-2.5 py-3 text-text-faint">
                  No saved views yet.
                </td>
              </tr>
            )}
            {live.map(d => {
              const problems = problemsOf(d);
              const use = utilization(d);
              return (
                <tr key={d.id} className="border-t border-border align-top">
                  <td className="px-2.5 py-2 font-mono text-11 text-text-muted">
                    {d.stored ? (
                      <>
                        {d.key}
                        {changed(d) && <span className="mt-1 block text-9 uppercase text-edit">changed</span>}
                        <span className="mt-1 block text-9 text-text-faint" title="History: the last save">{stampOf(d.stored.updatedAt)}</span>
                      </>
                    ) : (
                      <>
                        <input type="text" value={d.key} disabled={readOnly} spellCheck={false} maxLength={VIEW_KEY_MAX} placeholder="top-five" aria-label="Key of the new view" className={`${FIELD} font-mono text-11`} onChange={e => update(d.id, { key: e.target.value.toLowerCase() })} />
                        <span className="mt-1 block text-9 uppercase text-edit">new</span>
                      </>
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    <input type="text" value={d.name} disabled={readOnly} maxLength={VIEW_NAME_MAX} aria-label={d.stored ? `Name of ${d.key}` : 'Name of the new view'} className={FIELD} onChange={e => update(d.id, { name: e.target.value })} />
                  </td>
                  <td className="px-2.5 py-2">
                    {d.stored ? (
                      <span className={`block font-mono text-11 ${use.gone ? 'text-negative' : 'text-text-muted'}`} title="Utilization: the page and the region this view belongs to">
                        {use.text}
                      </span>
                    ) : (
                      <div className="grid gap-1">
                        <select value={d.pageId} disabled={readOnly} aria-label="Page of the new view" className={FIELD} onChange={e => update(d.id, { pageId: e.target.value, regionId: targetOf(e.target.value)?.regions[0]?.id ?? '' })}>
                          {targets.length === 0 && <option value="">No page has a Data region</option>}
                          {targets.map(t => (
                            <option key={t.pageId} value={t.pageId}>
                              {t.name} · {t.path}
                            </option>
                          ))}
                        </select>
                        <select value={d.regionId} disabled={readOnly || !d.pageId} aria-label="Region of the new view" className={FIELD} onChange={e => update(d.id, { regionId: e.target.value })}>
                          {(targetOf(d.pageId)?.regions ?? []).map(r => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                              {r.live ? '' : ' · not live yet'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    <input type="text" value={d.definition} disabled={readOnly} spellCheck={false} placeholder="sort=-points&cols=name,points" aria-label={d.stored ? `Definition of ${d.key}` : 'Definition of the new view'} className={`${FIELD} font-mono text-11`} onChange={e => update(d.id, { definition: e.target.value })} />
                    {problems.length > 0 && <div className="mt-1 font-mono text-9 text-negative">{problems.join(' · ')}</div>}
                  </td>
                  <td className="px-2.5 py-2">
                    <button type="button" className={`${PBTN} hover:border-negative hover:text-negative`} disabled={readOnly} title={d.stored ? `Delete ${d.key}` : 'Remove this row'} aria-label={d.stored ? `Delete ${d.key}` : 'Remove the new row'} onClick={() => remove(d)}>
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!readOnly && (
          <div className="border-t border-border px-2.5 py-2">
            <button type="button" className={`${TB} h-[26px]`} onClick={add}>
              <Plus size={13} /> Add a view
            </button>
          </div>
        )}
      </div>

      {work.deletes.length > 0 && <p className="mt-3 text-12 text-text-muted">To be deleted on Save: {work.deletes.map(d => d.key).join(', ')}.</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={TB_PRIMARY} disabled={busy || readOnly || count === 0 || invalid} onClick={() => void save()}>
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? 'Saving…' : count > 1 ? `Save ${count} changes` : 'Save'}
        </button>
        {count > 0 && !busy && (
          <button type="button" className={TB} onClick={discard}>
            <RotateCcw size={13} /> Discard changes
          </button>
        )}
        <span className="font-mono text-10 uppercase tracking-[0.12em] text-text-faint">{count > 0 ? `${count} unsaved${invalid ? ' · a row fails its checks' : ''}` : saved ? `Saved ${saved}` : 'Stored'}</span>
      </div>
      {conflict && (
        <div className="mt-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text">
          <p className="m-0">The saved views were saved again after you loaded them. Reload to see what is stored now; your unsaved changes are dropped.</p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={PBTN} onClick={() => onSaved({ views: conflict, targets })}>
              Reload
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-12 text-negative">{error}</p>}
    </div>
  );
}
