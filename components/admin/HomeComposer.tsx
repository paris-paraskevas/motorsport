'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Eye, EyeOff, GripVertical, Loader2, RotateCcw } from 'lucide-react';
import type { HomeBlock, HomeBlockId } from '@/lib/home-layout';

// Arrange the home page. The draft is pushed into the URL after every change so
// the server can re-render the REAL preview beside it; nothing here renders a
// facsimile of the page, which is the whole reason the preview can be trusted.
//
// Drag handle only (the ≡), so the hide button on each row stays clickable, with
// a full keyboard path via dnd-kit's keyboard sensor: focus the handle, space to
// pick up, arrows to move, space to drop.

const LABELS: Record<HomeBlockId, { name: string; hint: string }> = {
  blog: { name: 'Lead story', hint: 'Our own writing, with its cover' },
  live: { name: 'This weekend', hint: 'The session running or coming next' },
  result: { name: 'Latest result', hint: 'The podium, the championship and what races next' },
  wire: { name: 'The wire', hint: 'Headlines from elsewhere' },
};

function Row({
  id,
  hidden,
  onToggle,
}: {
  id: HomeBlockId;
  hidden: boolean;
  onToggle: (id: HomeBlockId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const label = LABELS[id];
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 border border-border bg-surface px-2 py-2 ${
        isDragging ? 'opacity-60' : ''
      } ${hidden ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-text-faint hover:text-text"
        aria-label={`Reorder ${label.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text">{label.name}</span>
        <span className="block text-xs text-text-faint">{label.hint}</span>
      </span>
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-pressed={!hidden}
        aria-label={hidden ? `Show ${label.name}` : `Hide ${label.name}`}
        title={hidden ? 'Show this band' : 'Hide this band'}
        className="p-2 text-text-muted hover:text-text"
      >
        {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </li>
  );
}

export function HomeComposer({
  blocks,
  liveBlocks,
  order,
  pinnedSlug,
  posts,
  liveId,
  savedDraft,
  readOnly = false,
}: {
  blocks: HomeBlock[];
  /** What is currently published, so the composer can say whether the draft differs. */
  liveBlocks: HomeBlock[];
  /** The live revision's id, or null when nothing is published. Sent back with a
   *  publish as `base`, so the API can refuse one whose base is no longer live. */
  liveId: string | null;
  /** The saved draft this page opened, if one is newer than the live layout. */
  savedDraft: { id: string; at: string; blocks: HomeBlock[] } | null;
  order: HomeBlockId[];
  pinnedSlug: string | null;
  posts: { slug: string; title: string; publishedAt: string | null; seriesSlug: string | null }[];
  /** True on the preview Workers (testing., paris.): drafting and the live preview
   *  still work, Save draft and Publish are disabled and a banner says where edits
   *  are made. The API refuses a write from a preview regardless; this is the
   *  honest UI. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<'draft' | 'publish' | null>(null);
  // A publish refused with 409 because the live revision moved: when it moved,
  // and the id to resend with if the operator chooses Publish anyway.
  const [conflict, setConflict] = useState<{ id: string | null; at: string | null } | null>(null);
  const [query, setQuery] = useState('');

  // Title OR series, so "f1" narrows to a championship and "zandvoort" to a
  // race. The "Newest published post" row is never filtered out — it is the
  // default rather than a post, and it is how you undo a pin.
  const shownPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      p => p.title.toLowerCase().includes(q) || (p.seriesSlug ?? '').toLowerCase().includes(q),
    );
  }, [posts, query]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = blocks.map(b => b.id);
  const hiddenSet = new Set(blocks.filter(b => b.hidden).map(b => b.id));

  /** "2026-08-24T…" → "24 Aug". UTC so a plain date can't drift a day. */
  function shortDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  /** "2026-09-07T21:15:30Z" → "7 Sept, 21:15 UTC". UTC on the server and in the
   *  browser alike, so the hydrated text matches what the server rendered. */
  function shortDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const text = d.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
    return `${text} UTC`;
  }

  // Serialising the draft into the URL is what triggers the server preview.
  const push = (next: HomeBlock[]) => {
    const q = new URLSearchParams();
    q.set('order', next.map(b => b.id).join(','));
    const hidden = next.filter(b => b.hidden).map(b => b.id);
    if (hidden.length) q.set('hidden', hidden.join(','));
    const lead = next.find(b => b.id === 'blog')?.pinnedSlug;
    if (lead) q.set('lead', lead);
    router.replace(`/admin/site?${q.toString()}`, { scroll: false });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id as HomeBlockId);
    const to = ids.indexOf(over.id as HomeBlockId);
    if (from < 0 || to < 0) return;
    push(arrayMove(blocks, from, to));
  };

  const toggle = (id: HomeBlockId) =>
    push(blocks.map(b => (b.id === id ? { ...b, hidden: !b.hidden } : b)));

  const setLead = (slug: string | null) =>
    push(blocks.map(b => (b.id === 'blog' ? { ...b, pinnedSlug: slug ?? undefined } : b)));

  // Compare against what is actually published, not against the last render, so
  // the button is honest after a reload. Save draft compares against the saved
  // draft instead, or against the live layout when there is none.
  const dirty = useMemo(
    () => JSON.stringify(blocks) !== JSON.stringify(liveBlocks),
    [blocks, liveBlocks],
  );
  const draftDirty = useMemo(
    () => JSON.stringify(blocks) !== JSON.stringify(savedDraft?.blocks ?? liveBlocks),
    [blocks, savedDraft, liveBlocks],
  );

  // One request shape for both buttons. `base` is the live revision this page
  // was loaded against; the API refuses a publish when it has moved (409), and
  // Publish anyway resends with the id the refusal named. A draft carries no base.
  async function send(action: 'draft' | 'publish', base: string | null) {
    if (busy) return;
    setBusy(action);
    setError(null);
    setSaved(null);
    setConflict(null);
    try {
      const res = await fetch('/api/admin/page-layout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blocks, action, base }),
      });
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as {
          live?: { id?: string; publishedAt?: string } | null;
        };
        setConflict({ id: d.live?.id ?? null, at: d.live?.publishedAt ?? null });
        return;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `Failed (${res.status}).`);
        return;
      }
      setSaved(action);
      // Drop the URL draft: the page reopens from the row just written.
      router.replace('/admin/site', { scroll: false });
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const rowBtn =
    'flex w-full items-center gap-2 border-b border-border px-2 py-2 text-left text-sm transition-colors duration-(--duration-fast) hover:bg-surface';
  const primaryBtn =
    'inline-flex items-center gap-2 border border-border-strong bg-surface px-4 py-2 font-mono text-11 font-semibold uppercase tracking-[0.16em] text-text transition-colors duration-(--duration-fast) hover:border-text disabled:opacity-50';
  const secondaryBtn =
    'inline-flex items-center gap-2 border border-border bg-transparent px-4 py-2 font-mono text-11 font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text hover:text-text disabled:opacity-50';
  const quietBtn =
    'inline-flex items-center gap-1.5 font-mono text-11 uppercase tracking-[0.14em] text-text-muted hover:text-text disabled:opacity-50';

  return (
    <div className="min-w-0">
      {readOnly && (
        <p className="mb-4 border border-border-strong bg-surface px-3 py-2 text-xs text-text-muted">
          Design edits are made on production. This copy of the site is read-only: arrange and
          preview here, publish on paddock-tracker.com.
        </p>
      )}
      <p className="mb-2 font-mono text-10 font-semibold uppercase tracking-[0.16em] text-text-faint">
        Bands · drag to reorder
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {blocks.map(b => (
              <Row key={b.id} id={b.id} hidden={hiddenSet.has(b.id)} onToggle={toggle} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="mb-2 mt-6 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-10 font-semibold uppercase tracking-[0.16em] text-text-faint">
          Lead story
        </p>
        {/* Local state only — deliberately NOT pushed into the URL like the
            selections are, because filtering the list is not a change to the
            draft and must not cost a server round-trip or a preview re-render. */}
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter posts…"
          aria-label="Filter the post list"
          className="min-w-0 flex-1 border border-border bg-surface px-2 py-1 font-mono text-11 text-text placeholder:text-text-faint focus:border-text focus:outline-none"
        />
      </div>
      {/* radiogroup, not a column of checkboxes: exactly one lead can be chosen,
          and the square boxes with `aria-pressed` announced as independent
          toggles to a screen reader. */}
      <div role="radiogroup" aria-label="Lead story" className="max-h-80 overflow-y-auto border border-border">
        <button
          type="button"
          role="radio"
          aria-checked={!pinnedSlug}
          onClick={() => setLead(null)}
          className={`${rowBtn} ${!pinnedSlug ? 'bg-surface' : ''}`}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center border border-border-strong">
            {!pinnedSlug && <Check size={11} />}
          </span>
          <span className="min-w-0 flex-1 font-semibold text-text">Newest published post</span>
        </button>
        {shownPosts.map(p => (
          <button
            key={p.slug}
            type="button"
            role="radio"
            aria-checked={pinnedSlug === p.slug}
            onClick={() => setLead(p.slug)}
            className={`${rowBtn} ${pinnedSlug === p.slug ? 'bg-surface' : ''}`}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center border border-border-strong">
              {pinnedSlug === p.slug && <Check size={11} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-text">{p.title}</span>
              {/* Series and date were already being passed to this component and
                  thrown away. Two dozen truncated headlines with no other
                  signal is not a list you can pick from. */}
              <span className="mt-0.5 flex items-baseline gap-2 font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
                {p.seriesSlug && <span className="font-semibold">{p.seriesSlug}</span>}
                {p.publishedAt && <span className="tabular-nums">{shortDate(p.publishedAt)}</span>}
              </span>
            </span>
          </button>
        ))}
        {shownPosts.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-text-faint">
            No post matches “{query}”.
          </p>
        )}
      </div>

      {savedDraft && !saved && (
        <p className="mt-5 text-xs text-text-muted">
          Editing the draft saved {shortDateTime(savedDraft.at)}. Nothing changes for visitors
          until you publish.
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => send('draft', null)}
          disabled={busy !== null || !draftDirty || readOnly}
          className={secondaryBtn}
        >
          {busy === 'draft' && <Loader2 size={13} className="animate-spin" />}
          {busy === 'draft' ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={() => send('publish', liveId)}
          disabled={busy !== null || !dirty || readOnly}
          className={primaryBtn}
        >
          {busy === 'publish' && <Loader2 size={13} className="animate-spin" />}
          {busy === 'publish' ? 'Publishing…' : dirty ? 'Publish to everyone' : 'Published'}
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => router.replace('/admin/site', { scroll: false })}
            className={quietBtn}
          >
            <RotateCcw size={13} /> Discard
          </button>
        )}
      </div>
      {conflict && (
        <div className="mt-3 border border-border-strong bg-surface px-3 py-2 text-xs text-text">
          <p>
            The home page was published again
            {conflict.at ? ` at ${shortDateTime(conflict.at)}` : ''}, after you loaded this page.
            Reload to see it, or publish yours over it.
          </p>
          <div className="mt-2 flex gap-4">
            <button
              type="button"
              onClick={() => {
                router.replace('/admin/site', { scroll: false });
                router.refresh();
              }}
              className={quietBtn}
            >
              Reload
            </button>
            <button type="button" onClick={() => send('publish', conflict.id)} className={quietBtn}>
              Publish anyway
            </button>
          </div>
        </div>
      )}
      {saved === 'draft' && (
        <p className="mt-2 text-xs text-text-muted">
          Draft saved. Nothing changes for visitors until you publish.
        </p>
      )}
      {saved === 'publish' && !dirty && (
        <p className="mt-2 text-xs text-text-muted">
          Live. The home page picks it up within a few minutes.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <p className="mt-4 text-xs text-text-faint">
        {order.length} of {blocks.length} bands showing. A band with nothing to show is skipped
        automatically, and hiding every one falls back to the default page rather than a blank one.
      </p>
    </div>
  );
}
