'use client';

import { useId, useState } from 'react';
import { ChevronDown, CircleHelp, Contrast, List, Loader2 } from 'lucide-react';
import { PAGE_COMMENTS_MAX, PAGE_GROUPS, PAGE_GROUP_LABELS, type PageGroup } from '@/lib/design/page-registry';
import { PAGE_NAME_MAX, PAGE_TITLE_MAX } from '@/lib/design/page-document';
import type { PageRow } from '@/lib/design/pages';
import type { PageDetail } from '@/lib/design/page-revisions';
import type { EditableAuthzScheme } from '@/lib/design/authz';

// A page's attributes as the approved designer's property editor shows them
// (Paddock Designer v2.4, the right pane, docs/prototypes/paddock-designer-v2.4):
// the filter, Go to Group, Show Common / Show All and the help toggle in the
// head; "Page  <number>: <name>"; the groups Identification (Page Number, Name,
// Page Alias, Page Group, Title), Security (Authorization Scheme, Page Requires
// Authentication) and Advanced (Rendering, Indexed, Comments), each a row of
// label and value with its note; the help for the focused property at the
// foot. One conditional save on the row's stamp through
// PUT /api/admin/design/pages/[id]; a moved stamp comes back as a conflict with
// Reload. The path is read-only: a page keeps its address. Save sits at the
// foot of the pane until the Page Designer's toolbar arrives (the operator's
// call, 2026-09-08); Indexed sits under Advanced and Page Number shows the row
// id's first eight characters (the same call: the site numbers pages by id).

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const IB =
  'grid h-7 w-7 place-items-center border border-transparent text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:text-text aria-pressed:border-edit aria-pressed:text-edit';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';
const PILL =
  'border border-border-strong bg-surface px-2 py-1 text-12 leading-none text-text transition-colors duration-(--duration-fast) hover:border-edit hover:text-edit disabled:cursor-default disabled:opacity-60 aria-pressed:border-edit aria-pressed:bg-edit-dim aria-pressed:text-text rounded-[3px]';

const FALLBACK_SCHEMES: { key: string; label: string; type: string }[] = [
  { key: 'public', label: 'Public', type: 'public' },
  { key: 'signed_in', label: 'Signed in', type: 'signed_in' },
  { key: 'contributor', label: 'Contributor', type: 'author' },
  { key: 'administrator', label: 'Administrator', type: 'role' },
];

/** The help for each property, read at the foot when its label is clicked or its field focused. */
const HELP: Record<string, string> = {
  'Page Number': 'Pages are numbered by their row id; the site has no other numbering.',
  Name: 'How the page is called in the App Builder: the list, the rail, the crumb. Readers never see it.',
  'Page Alias': 'The address. A page keeps its address; a new address is a new page.',
  'Page Group': 'How the App Builder home groups pages. Purely organisational.',
  Title: 'Browser tab and search result title. Empty keeps the title the page carries itself.',
  'Authorization Scheme': 'Who may see the page. Schemes are defined once under Shared Components → Security.',
  'Page Requires Authentication': 'Yes when the scheme asks for a session; then the page renders per visit.',
  Rendering: 'Cached pages are rendered ahead and refreshed; each-visit pages render per request. The code decides.',
  Indexed: 'Off tells search engines noindex, follow. On leaves the rule the page carries itself.',
  Comments: 'Notes for the two of you. Never rendered.',
};

interface Draft {
  name: string;
  title: string;
  group: PageGroup;
  authz: string;
  indexable: boolean;
  comments: string;
}

function draftOf(page: PageRow): Draft {
  return {
    name: page.name,
    title: page.title ?? '',
    group: page.group ?? 'editorial',
    authz: page.authz && page.authz !== 'public' ? page.authz : 'public',
    indexable: page.indexable,
    comments: page.comments ?? '',
  };
}

interface Prop {
  label: string;
  /** Shown under Show Common; everything shows under Show All. */
  common: boolean;
  /** The id of the field the label points at, when the value is a field. */
  htmlFor?: string;
  control: React.ReactNode;
  note?: string;
}

interface Group {
  title: string;
  props: Prop[];
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
  const uid = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(page));
  const [seen, setSeen] = useState<string | null>(page.updatedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState('');
  const [commonOnly, setCommonOnly] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpFor, setHelpFor] = useState<string | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  if (page.updatedAt !== seen) {
    // A new row (after a save or a reload) replaces the draft: adjusted during render.
    setSeen(page.updatedAt);
    setDraft(draftOf(page));
  }
  const stored = draftOf(page);
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const nameProblem = !draft.name.trim() ? 'needs a name' : draft.name.length > PAGE_NAME_MAX ? `a name is at most ${PAGE_NAME_MAX} characters` : null;
  const titleProblem = draft.title.length > PAGE_TITLE_MAX ? `a title is at most ${PAGE_TITLE_MAX} characters` : null;
  const commentsProblem = draft.comments.length > PAGE_COMMENTS_MAX ? `comments are at most ${PAGE_COMMENTS_MAX} characters` : null;
  const problem = nameProblem ?? titleProblem ?? commentsProblem;
  const options = schemes ? schemes.map(s => ({ key: s.key, label: s.label, type: s.type as string })) : FALLBACK_SCHEMES;
  const chosen = options.find(o => o.key === draft.authz);
  const requiresAuth = Boolean(chosen && chosen.type !== 'public');
  const number = page.id ? page.id.slice(0, 8) : 'no row';

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
          comments: draft.comments.trim() || null,
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

  const focus = (label: string) => () => setHelpFor(label);
  const field = (name: string) => `${uid}-${name}`;
  const ro = (text: string, dim = false) => <div className={`pt-1 text-12 ${dim ? 'text-text-faint' : 'text-text'}`}>{text}</div>;
  const pills = <K extends string | boolean>(
    label: string,
    items: { key: K; label: string }[],
    current: K,
    pick: (key: K) => void,
  ) => (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1" onFocus={focus(label)}>
      {items.map(it => (
        <button
          key={String(it.key)}
          type="button"
          aria-pressed={it.key === current}
          disabled={readOnly}
          className={PILL}
          onClick={() => pick(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );

  const groups: Group[] = [
    {
      title: 'Identification',
      props: [
        { label: 'Page Number', common: true, control: ro(number, true), note: 'Pages are numbered by their row id.' },
        {
          label: 'Name',
          common: true,
          htmlFor: field('name'),
          control: (
            <input
              id={field('name')}
              type="text"
              value={draft.name}
              maxLength={PAGE_NAME_MAX}
              disabled={readOnly}
              aria-label="Page name"
              className={FIELD}
              onFocus={focus('Name')}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            />
          ),
        },
        {
          label: 'Page Alias',
          common: true,
          control: ro(page.path),
          note: page.kind === 'code' ? 'Built-in route. Its path is code.' : 'A path of your own, served from the published revision.',
        },
        {
          label: 'Page Group',
          common: true,
          control: pills(
            'Page group',
            PAGE_GROUPS.map(g => ({ key: g, label: PAGE_GROUP_LABELS[g] })),
            draft.group,
            g => setDraft(d => ({ ...d, group: g })),
          ),
        },
        {
          label: 'Title',
          common: true,
          htmlFor: field('title'),
          control: (
            <input
              id={field('title')}
              type="text"
              value={draft.title}
              maxLength={PAGE_TITLE_MAX}
              disabled={readOnly}
              aria-label="Page title"
              placeholder={page.name}
              className={FIELD}
              onFocus={focus('Title')}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            />
          ),
          note: 'Browser tab and search result title.',
        },
      ],
    },
    {
      title: 'Security',
      props: [
        {
          label: 'Authorization Scheme',
          common: true,
          control: pills(
            'Page authorization',
            options.map(o => ({ key: o.key, label: o.label })),
            draft.authz,
            key => setDraft(d => ({ ...d, authz: key })),
          ),
        },
        {
          label: 'Page Requires Authentication',
          common: true,
          control: ro(requiresAuth ? 'Yes' : 'No · public with account', true),
        },
      ],
    },
    {
      title: 'Advanced',
      props: [
        {
          label: 'Rendering',
          common: true,
          control: ro(page.rendering === 'dynamic' ? 'Each visit' : 'Cached', true),
          note: page.kind === 'code' ? 'The code decides; it changes with a deploy.' : 'Stored on the row; not honoured yet for pages made here.',
        },
        {
          label: 'Indexed',
          common: true,
          control: pills(
            'Search engines may index this page',
            [
              { key: true, label: 'Yes' },
              { key: false, label: 'No' },
            ],
            draft.indexable,
            v => setDraft(d => ({ ...d, indexable: v })),
          ),
          note: 'Off adds noindex, follow. On leaves the rule the page carries itself.',
        },
        {
          label: 'Comments',
          common: false,
          htmlFor: field('comments'),
          control: (
            <textarea
              id={field('comments')}
              value={draft.comments}
              maxLength={PAGE_COMMENTS_MAX}
              disabled={readOnly}
              aria-label="Page comments"
              placeholder="Notes for the two of you. Never rendered."
              className={`${FIELD} min-h-[84px] resize-y font-mono text-11`}
              onFocus={focus('Comments')}
              onChange={e => setDraft(d => ({ ...d, comments: e.target.value }))}
            />
          ),
        },
      ],
    },
  ];

  const q = query.trim().toLowerCase();
  const visible = groups
    .map(g => ({ ...g, props: g.props.filter(p => (!commonOnly || p.common) && (!q || p.label.toLowerCase().includes(q))) }))
    .filter(g => g.props.length > 0);
  const groupId = (title: string) => `${uid}-group-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const toggle = (title: string) =>
    setClosed(s => {
      const next = new Set(s);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  const goTo = (title: string) => {
    setClosed(s => {
      const next = new Set(s);
      next.delete(title);
      return next;
    });
    setGroupsOpen(false);
    // jsdom has no scrollIntoView; the tests run this path.
    if (typeof document !== 'undefined') document.getElementById(groupId(title))?.scrollIntoView?.({ block: 'start' });
  };

  return (
    <section aria-label="Page properties" className="relative flex flex-col border border-border-strong bg-surface text-12">
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
        <input
          type="search"
          value={query}
          placeholder="Filter properties"
          aria-label="Filter properties"
          className="h-7 min-w-0 flex-1 border border-border-strong bg-bg px-2 text-12 text-text focus:border-edit focus:outline-none"
          onChange={e => setQuery(e.target.value)}
        />
        <button type="button" className={IB} title="Go to Group" aria-label="Go to Group" aria-pressed={groupsOpen} onClick={() => setGroupsOpen(o => !o)}>
          <List size={13} />
        </button>
        <button
          type="button"
          className={IB}
          title={commonOnly ? 'Show All' : 'Show Common'}
          aria-label={commonOnly ? 'Show All' : 'Show Common'}
          aria-pressed={commonOnly}
          onClick={() => setCommonOnly(c => !c)}
        >
          <Contrast size={13} />
        </button>
        <button type="button" className={IB} title="Show help for the focused property" aria-label="Show help" aria-pressed={helpOpen} onClick={() => setHelpOpen(h => !h)}>
          <CircleHelp size={13} />
        </button>
      </div>
      {groupsOpen && (
        <ul role="menu" aria-label="Groups" className="absolute right-2 top-9 z-10 m-0 grid min-w-40 list-none gap-0 border border-border-strong bg-surface-elevated p-1 shadow-lg">
          {groups.map(g => (
            <li key={g.title} role="none">
              <button type="button" role="menuitem" className="block w-full px-2 py-1 text-left text-12 text-text hover:bg-edit-dim" onClick={() => goTo(g.title)}>
                {g.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex min-w-0 items-center gap-2 border-b border-border bg-surface-elevated px-3 py-2">
        <span className="whitespace-nowrap font-mono text-9 uppercase tracking-[0.14em] text-text-faint">Page</span>
        <span className="min-w-0 truncate font-semibold text-text">
          {number}: {draft.name.trim() || page.name}
        </span>
      </div>
      <div>
        {visible.map(g => {
          const isClosed = closed.has(g.title);
          return (
            <div key={g.title} id={groupId(g.title)} className="border-b border-border">
              <button
                type="button"
                aria-expanded={!isClosed}
                className="flex w-full items-center justify-between bg-surface-elevated px-3 py-2 text-left text-12-5 font-semibold text-text hover:text-edit"
                onClick={() => toggle(g.title)}
              >
                {g.title}
                <ChevronDown size={13} className={`text-text-faint transition-transform ${isClosed ? '-rotate-90' : ''}`} />
              </button>
              {!isClosed && (
                <div className="grid gap-2.5 px-3 pb-3 pt-2">
                  {g.props.map(p => (
                    <div key={p.label} className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-2">
                      {p.htmlFor ? (
                        <label htmlFor={p.htmlFor} className={`pt-1 text-12 leading-tight ${helpFor === p.label ? 'text-edit' : 'text-text-muted'} hover:text-edit`} onClick={focus(p.label)}>
                          {p.label}
                        </label>
                      ) : (
                        <button
                          type="button"
                          className={`pt-1 text-left text-12 leading-tight ${helpFor === p.label ? 'text-edit' : 'text-text-muted'} hover:text-edit`}
                          title="Help"
                          onClick={() => {
                            setHelpFor(p.label);
                            setHelpOpen(true);
                          }}
                        >
                          {p.label}
                        </button>
                      )}
                      <div className="grid min-w-0 gap-1.5">
                        {p.control}
                        {p.note && <span className="text-11 leading-snug text-text-faint">{p.note}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && <p className="m-0 px-3 py-3 text-12 text-text-faint">No property matches.</p>}
      </div>
      {helpOpen && (
        <div className="border-t border-border-strong bg-surface-elevated px-3 py-2 text-12 leading-snug text-text-muted" aria-live="polite">
          {helpFor && HELP[helpFor] ? (
            <>
              <b className="text-text">{helpFor}</b> · {HELP[helpFor]}
            </>
          ) : (
            "Click a property's label, or focus a field, to read its help here."
          )}
        </div>
      )}
      {!readOnly && (
        <div className="flex items-center gap-3 border-t border-border px-3 py-2">
          <button type="button" className={TB} disabled={busy || !dirty || Boolean(problem)} onClick={() => void save()}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : null}
            Save attributes
          </button>
          <span className={`font-mono text-9 uppercase tracking-[0.1em] ${error || problem ? 'text-negative' : 'text-text-faint'}`}>
            {error ?? problem ?? (dirty ? 'unsaved changes' : saved ? 'saved' : 'stored')}
          </span>
        </div>
      )}
    </section>
  );
}
