'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { INFO_TOPICS } from '@/lib/information/topics';
import { postAction } from './studio-shared';

// Admin-only control on a PUBLISHED post: file it into the Learn IA under one
// topic, or clear it. Lives on the studio post page, which for a published post
// is otherwise a dead-end status card.
//
// Why admin-only rather than the author: this is an editorial trust decision on
// the most-indexed section of the site, and the repo already draws that line —
// deciding (approve/reject/schedule) stayed admin-only in 0.248.0 because
// `contributor` is the revocable stranger tier (lib/threads.ts). A writer picking
// their own Learn placement would hand that surface to it.
//
// Two steps by design, matching how the operator described it: the toggle says
// "this is educational", the select says where it belongs. Storage is ONE nullable
// column, so "featured with no topic" cannot exist — turning it on is choosing a
// topic. The toggle just reveals the select; nothing is written until Save.

const BTN_PRIMARY =
  'bg-text px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted disabled:opacity-40';
const BTN_QUIET =
  'rounded border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text disabled:opacity-40';
const FIELD =
  'rounded border border-border bg-bg px-2 py-1.5 font-mono text-xs text-text disabled:opacity-40';

export function LearnFeature({ id, learnTopic }: { id: string; learnTopic: string | null }) {
  const router = useRouter();
  const [on, setOn] = useState(Boolean(learnTopic));
  // Falls back to the first topic so enabling the toggle always has a valid
  // selection — the API rejects an unknown/empty topic, and an empty select would
  // just produce a 422 the operator has to read.
  const [topic, setTopic] = useState(learnTopic ?? INFO_TOPICS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pending = on ? topic !== learnTopic : learnTopic !== null;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await postAction(id, 'feature', undefined, on ? topic : null);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    // The Learn pages are server-rendered; refresh so a second visit to this page
    // shows the stored value rather than this component's local state.
    router.refresh();
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        Feature in Learn
      </span>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-text-muted">
        Files this post into <span className="text-text">/information</span> under one topic, so it
        appears alongside the written answers. The post keeps its own address and stays canonical
        there; nothing new is added to the sitemap.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={on}
            disabled={busy}
            onChange={e => {
              setOn(e.target.checked);
              setSaved(false);
            }}
            className="h-4 w-4 accent-[var(--brand-fill)]"
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text">
            Featured
          </span>
        </label>

        <select
          value={topic}
          disabled={!on || busy}
          onChange={e => {
            setTopic(e.target.value);
            setSaved(false);
          }}
          aria-label="Learn topic"
          className={FIELD}
        >
          {INFO_TOPICS.map(t => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={busy || !pending}
          onClick={save}
          className={pending ? BTN_PRIMARY : BTN_QUIET}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>

        {saved && !pending && (
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-tint">Saved</span>
        )}
        {error && <span className="font-mono text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
