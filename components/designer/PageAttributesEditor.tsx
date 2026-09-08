'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PAGE_GROUPS, PAGE_GROUP_LABELS, type PageGroup } from '@/lib/design/page-registry';
import { PAGE_NAME_MAX, PAGE_TITLE_MAX } from '@/lib/design/page-document';
import type { PageRow } from '@/lib/design/pages';
import type { PageDetail } from '@/lib/design/page-revisions';
import type { EditableAuthzScheme } from '@/lib/design/authz';

// A row page's attributes (APEX: the page's Identification, Navigation and
// Security properties): name, title, group, who sees it, whether search
// engines may index it. One conditional save on the row's stamp through
// PUT /api/admin/design/pages/[id]; a moved stamp comes back as a conflict
// with Reload. The path is not here: a page keeps its address.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';
const LABEL = 'grid gap-1 text-11 text-text-muted';

const FALLBACK_SCHEMES: { key: string; label: string }[] = [
  { key: 'signed_in', label: 'Signed in' },
  { key: 'contributor', label: 'Contributor' },
  { key: 'administrator', label: 'Administrator' },
];

interface Draft {
  name: string;
  title: string;
  group: PageGroup;
  authz: string;
  indexable: boolean;
}

function draftOf(page: PageRow): Draft {
  return {
    name: page.name,
    title: page.title ?? '',
    group: page.group ?? 'editorial',
    authz: page.authz && page.authz !== 'public' ? page.authz : '',
    indexable: page.indexable,
  };
}

export function PageAttributesEditor({
  page,
  readOnly,
  schemes,
  onSaved,
  onConflict,
}: {
  page: PageRow;
  readOnly: boolean;
  schemes?: EditableAuthzScheme[];
  /** The row as stored after a save. */
  onSaved: (page: PageRow) => void;
  /** The detail as stored when the stamp moved under this screen. */
  onConflict: (detail: PageDetail) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(page));
  const [seen, setSeen] = useState<string | null>(page.updatedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  if (page.updatedAt !== seen) {
    // A new row (after a save or a reload) replaces the draft: adjusted during render.
    setSeen(page.updatedAt);
    setDraft(draftOf(page));
  }
  const stored = draftOf(page);
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const nameProblem = !draft.name.trim() ? 'needs a name' : draft.name.length > PAGE_NAME_MAX ? `a name is at most ${PAGE_NAME_MAX} characters` : null;
  const titleProblem = draft.title.length > PAGE_TITLE_MAX ? `a title is at most ${PAGE_TITLE_MAX} characters` : null;
  const problem = nameProblem ?? titleProblem;
  const options = schemes ? schemes.filter(s => s.type !== 'public').map(s => ({ key: s.key, label: s.label })) : FALLBACK_SCHEMES;

  async function save() {
    if (busy || readOnly || problem || !dirty || !page.id) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/design/pages/${page.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          title: draft.title.trim() || null,
          group: draft.group,
          authz: draft.authz || 'public',
          indexable: draft.indexable,
          updatedAt: page.updatedAt,
        }),
      });
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as { current?: PageDetail };
        if (d.current) onConflict(d.current);
        else setError('This page was saved again after you loaded it. Reload the page.');
        return;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `failed (${res.status})`);
        return;
      }
      const d = (await res.json()) as { page: PageRow };
      setSaved(true);
      onSaved(d.page);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="mb-4 border border-border-strong bg-surface">
      <summary className="cursor-pointer select-none px-3 py-2 text-12 font-semibold text-text">
        Page attributes
        <span className="ml-2 font-mono text-9 font-normal uppercase tracking-[0.12em] text-text-faint">
          {dirty ? 'unsaved changes' : saved ? 'saved' : 'name · title · group · who sees it · indexed'}
        </span>
      </summary>
      <div className="grid gap-3 border-t border-border p-3 md:grid-cols-2">
        <label className={LABEL}>
          Name
          <input
            type="text"
            value={draft.name}
            maxLength={PAGE_NAME_MAX}
            disabled={readOnly}
            aria-label="Page name"
            className={FIELD}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
        </label>
        <label className={LABEL}>
          Title (the tab and the heading; the name when empty)
          <input
            type="text"
            value={draft.title}
            maxLength={PAGE_TITLE_MAX}
            disabled={readOnly}
            aria-label="Page title"
            className={FIELD}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
          />
        </label>
        <label className={LABEL}>
          Group
          <select value={draft.group} disabled={readOnly} aria-label="Page group" className={FIELD} onChange={e => setDraft(d => ({ ...d, group: e.target.value as PageGroup }))}>
            {PAGE_GROUPS.map(g => (
              <option key={g} value={g}>
                {PAGE_GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Who sees it
          <select value={draft.authz} disabled={readOnly} aria-label="Page authorization" className={FIELD} onChange={e => setDraft(d => ({ ...d, authz: e.target.value }))}>
            <option value="">Everyone</option>
            {options.map(o => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-11 text-text-muted md:col-span-2">
          <input
            type="checkbox"
            checked={draft.indexable}
            disabled={readOnly}
            aria-label="Search engines may index this page"
            onChange={e => setDraft(d => ({ ...d, indexable: e.target.checked }))}
          />
          Search engines may index this page (only while everyone may see it)
        </label>
        {!readOnly && (
          <div className="flex items-center gap-3 md:col-span-2">
            <button type="button" className={TB} disabled={busy || !dirty || Boolean(problem)} onClick={() => void save()}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : null}
              Save attributes
            </button>
            <span className={`font-mono text-9 uppercase tracking-[0.1em] ${error || problem ? 'text-negative' : 'text-text-faint'}`}>
              {error ?? problem ?? (dirty ? 'unsaved changes' : saved ? 'saved' : 'stored')}
            </span>
          </div>
        )}
      </div>
    </details>
  );
}
