'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { PostHeader, POST_ARTICLE_CLASS, type PostAuthor } from './PostHeader';
import { MarkdownEditor } from './MarkdownEditor';

// Field limits — mirror lib/blog.ts TITLE_MAX/SUMMARY_MAX. Local literals because
// lib/blog is a server module (Supabase client) and importing it here would drag
// that graph into the client bundle; the server re-validates on PATCH anyway, so
// a drift only loosens the soft maxLength hint. (Body length is server-enforced;
// the MarkdownEditor doesn't cap it client-side.)
const TITLE_MAX = 140;
const SUMMARY_MAX = 300;

// Admin-preview branch of /blog/[slug] (spec
// docs/superpowers/specs/2026-07-03-draft-inline-edit-design.md): owns the
// amber banner + post header + article for draft/scheduled posts, plus a
// pencil that swaps them for an in-place markdown editor so a draft can be
// hand-corrected during review. Save PATCHes /api/blog/[id] then
// router.refresh() — the RSC re-renders (getPostBySlug → renderMarkdown) and
// fresh props drop the component back to view mode. No client-side markdown
// rendering, so the rendered result is always the server pipeline's.
// Slug, series, hero image and publish time are immutable in this surface.

export interface DraftEditorProps {
  id: string;
  title: string;
  summary: string;
  body: string;
  bodyHtml: string;
  dateLabel: string;
  banner: { kind: 'draft' } | { kind: 'scheduled'; label: string };
  author: PostAuthor | null;
}

export function DraftEditor({ id, title, summary, body, bodyHtml, dateLabel, banner, author }: DraftEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftSummary, setDraftSummary] = useState(summary);
  const [draftBody, setDraftBody] = useState(body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = draftTitle !== title || draftSummary !== summary || draftBody !== body;

  function startEdit() {
    // Re-seed from props each time — a previous save refreshed them.
    setDraftTitle(title);
    setDraftSummary(summary);
    setDraftBody(body);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setError(null);
    setEditing(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/blog/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: draftTitle, summary: draftSummary, body: draftBody }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(d.error ?? `Failed (${res.status}).`);
        return;
      }
      // Fresh server render (new bodyHtml) arrives via refresh; drop to view mode.
      setEditing(false);
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  const bannerText =
    banner.kind === 'draft'
      ? 'Draft preview · not yet scheduled · only you and editors can see this'
      : `Scheduled preview · publishes ${banner.label} UTC · only you and editors can see this`;

  const field =
    'w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint';

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-xs text-amber-300">
        <span>{bannerText}</span>
        {!editing && (
          <button
            type="button"
            aria-label="Edit draft"
            onClick={startEdit}
            className="shrink-0 rounded p-1 text-amber-300 transition-colors hover:bg-amber-500/20 hover:text-amber-200"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {editing ? (
        <form
          onSubmit={e => {
            e.preventDefault();
            void save();
          }}
          className="space-y-3"
        >
          <input
            className={`${field} text-lg font-semibold`}
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            maxLength={TITLE_MAX}
            placeholder="Title"
            aria-label="Title"
            required
          />
          <textarea
            className={field}
            value={draftSummary}
            onChange={e => setDraftSummary(e.target.value)}
            maxLength={SUMMARY_MAX}
            rows={3}
            placeholder="Summary"
            aria-label="Summary"
            required
          />
          <MarkdownEditor
            value={draftBody}
            onChange={setDraftBody}
            minHeightClass="min-h-[60vh]"
            textClassName="font-mono text-xs leading-relaxed"
          />
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-brand px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="rounded border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted hover:text-text disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <PostHeader
            dateLabel={dateLabel}
            title={title}
            summary={summary}
            author={author ?? { name: null, image: null }}
          />
          <article className={POST_ARTICLE_CLASS}>
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </article>
        </>
      )}
    </>
  );
}
