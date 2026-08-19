'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  defaultLocalDateTime,
  toLocalInput,
  postAction,
  type PostAction,
} from './studio-shared';

// Per-row actions on the studio dashboard, decided by status + role:
//   draft      → Submit for review (any owner); an admin can also decide directly
//                (their own hand-authored drafts rely on the direct approve path)
//   in_review  → admin: approve with a time / reject; writer: a status note
//   approved   → admin: re-schedule; writer: nothing (the row shows the time)
// Every success router.refresh()es — the dashboard is a server component, so the
// fresh render moves the row between sections.

const BTN_PRIMARY =
  'bg-text px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted disabled:opacity-40';
const BTN_QUIET =
  'rounded border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text disabled:opacity-40';
const FIELD_DT = 'rounded border border-border bg-bg px-2 py-1 font-mono text-xs text-text';

export function RowActions({
  id,
  status,
  publishAt,
  admin,
}: {
  id: string;
  status: 'draft' | 'in_review' | 'approved';
  publishAt: string | null;
  admin: boolean;
}) {
  const router = useRouter();
  const [when, setWhen] = useState(() =>
    status === 'approved' ? toLocalInput(publishAt) : defaultLocalDateTime(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: PostAction) {
    setBusy(true);
    setError(null);
    const res = await postAction(id, action, when);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  const decide = admin && (status === 'draft' || status === 'in_review');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'draft' && (
        <button type="button" disabled={busy} onClick={() => run('submit')} className={BTN_PRIMARY}>
          Submit for review
        </button>
      )}
      {decide && (
        <>
          <input
            type="datetime-local"
            value={when}
            onChange={e => setWhen(e.target.value)}
            className={FIELD_DT}
            aria-label="Publish time"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => run('approve')}
            className={status === 'in_review' ? BTN_PRIMARY : BTN_QUIET}
          >
            Approve + schedule
          </button>
          <button type="button" disabled={busy} onClick={() => run('reject')} className={BTN_QUIET}>
            Reject
          </button>
        </>
      )}
      {status === 'in_review' && !admin && (
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
          Submitted, waiting on the editor. You can still edit it.
        </span>
      )}
      {status === 'approved' && admin && (
        <>
          <input
            type="datetime-local"
            value={when}
            onChange={e => setWhen(e.target.value)}
            className={FIELD_DT}
            aria-label="New publish time"
          />
          <button type="button" disabled={busy} onClick={() => run('reschedule')} className={BTN_QUIET}>
            Re-schedule
          </button>
        </>
      )}
      {error && <span className="font-mono text-xs text-red-400">{error}</span>}
    </div>
  );
}
