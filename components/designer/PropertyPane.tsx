'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, CircleHelp, Contrast, List, Pin } from 'lucide-react';

// The Property Editor pane (Paddock Designer v2.4, the right pane, docs/
// prototypes/paddock-designer-v2.4): the head with Filter properties, Go to
// Group, Show Common / Show All and the help toggle; "<Kind>  <name>"; the
// groups, each a header that folds and rows of label and value with their
// notes; the help for the focused property at the foot. It knows nothing of
// pages or regions: the designer builds the groups for the selection
// (PageDesignerProperties.tsx) and this pane draws them.

export interface PropRow {
  label: string;
  /** Shown under Show Common; everything shows under Show All. */
  common?: boolean;
  /** The id of the field the label points at, when the value is a field. */
  htmlFor?: string;
  control: ReactNode;
  note?: string;
  /** Read at the foot when the label is clicked or the field focused. */
  help?: string;
  /** A note in the negative colour. */
  bad?: boolean;
}

export interface PropGroup {
  title: string;
  props: PropRow[];
  /** Folded at first. */
  closed?: boolean;
  /** A group that arrives with a later step: shown folded, labelled. */
  later?: boolean;
}

export const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';
export const TEXTAREA = `${FIELD} min-h-[84px] resize-y font-mono text-11`;
export const PBTN =
  'inline-flex items-center gap-1 border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const IB =
  'grid h-7 w-7 place-items-center border border-transparent text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:text-text aria-pressed:border-edit aria-pressed:text-edit';
const PILL =
  'border border-border-strong bg-surface px-2 py-1 text-12 leading-none text-text transition-colors duration-(--duration-fast) hover:border-edit hover:text-edit disabled:cursor-default disabled:opacity-60 aria-pressed:border-edit aria-pressed:bg-edit-dim aria-pressed:text-text rounded-[3px]';

/** A row of choices, one pressed (APEX: a switch or a select; the prototype's chips). */
export function Pills<K extends string | number | boolean>({
  label,
  items,
  current,
  onPick,
  disabled,
  onFocus,
}: {
  label: string;
  items: readonly { key: K; label: string; disabled?: boolean; title?: string }[];
  current: K | null;
  onPick: (key: K) => void;
  disabled?: boolean;
  onFocus?: () => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1" onFocus={onFocus}>
      {items.map(it => (
        <button
          key={String(it.key)}
          type="button"
          aria-pressed={it.key === current}
          disabled={disabled || it.disabled}
          title={it.title}
          className={PILL}
          onClick={() => onPick(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** A read-only value. */
export function Ro({ children, dim = false }: { children: ReactNode; dim?: boolean }) {
  return <div className={`pt-1 text-12 ${dim ? 'text-text-faint' : 'text-text'}`}>{children}</div>;
}

/** Yes / No as pills. */
export function YesNo({ label, value, onPick, disabled, onFocus }: { label: string; value: boolean; onPick: (v: boolean) => void; disabled?: boolean; onFocus?: () => void }) {
  return (
    <Pills
      label={label}
      items={[
        { key: true, label: 'Yes' },
        { key: false, label: 'No' },
      ]}
      current={value}
      onPick={onPick}
      disabled={disabled}
      onFocus={onFocus}
    />
  );
}

export function PropertyPane({
  head,
  groups,
  footer,
  focusGroup,
  filterRef,
  onHelpFor,
  emptyText = "Click a property's label, or focus a field, to read its help here.",
}: {
  /** "Page" and its name, "Static Content" and the region's name. */
  head: { kind: string; name: string };
  groups: PropGroup[];
  /** A row at the foot of the pane: Save, a status. */
  footer?: ReactNode;
  /** A group to open and scroll to; a new `n` repeats it. */
  focusGroup?: { title: string; n: number } | null;
  /** The filter field, so Alt+6 can focus it. */
  filterRef?: React.RefObject<HTMLInputElement | null>;
  /** Told which property's help is showing, so the Help tab can say the same. */
  onHelpFor?: (label: string | null, text: string | null) => void;
  emptyText?: string;
}) {
  const [query, setQuery] = useState('');
  const [pinned, setPinned] = useState(false);
  const [seenHead, setSeenHead] = useState(`${head.kind}·${head.name}`);
  if (`${head.kind}·${head.name}` !== seenHead) {
    // Another component selected: the filter clears unless pinned (APEX's Pin Filter), adjusted during render.
    setSeenHead(`${head.kind}·${head.name}`);
    if (!pinned && query) setQuery('');
  }
  const [commonOnly, setCommonOnly] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpFor, setHelpForState] = useState<string | null>(null);
  const setHelpFor = (label: string | null) => {
    setHelpForState(label);
    onHelpFor?.(label, label ? (groups.flatMap(g => g.props).find(p => p.label === label)?.help ?? null) : null);
  };
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [closed, setClosed] = useState<Set<string>>(() => new Set(groups.filter(g => g.closed || g.later).map(g => g.title)));
  // A group seen for the first time (another kind of component selected) starts
  // closed when it asks to; a group the person has toggled keeps their choice.
  // Adjusted during render, like the filter above.
  const [seenGroups, setSeenGroups] = useState<Set<string>>(() => new Set(groups.map(g => g.title)));
  const unseen = groups.filter(g => !seenGroups.has(g.title));
  if (unseen.length > 0) {
    setSeenGroups(prev => new Set([...prev, ...unseen.map(g => g.title)]));
    const toClose = unseen.filter(g => g.closed || g.later).map(g => g.title);
    if (toClose.length > 0) setClosed(prev => new Set([...prev, ...toClose]));
  }
  const [seenFocus, setSeenFocus] = useState<number>(focusGroup?.n ?? 0);
  if (focusGroup && focusGroup.n !== seenFocus) {
    // Messages and Page Search ask for a group: open it, adjusted during render.
    setSeenFocus(focusGroup.n);
    setClosed(s => {
      const next = new Set(s);
      next.delete(focusGroup.title);
      return next;
    });
  }
  useEffect(() => {
    if (!focusGroup) return;
    document.getElementById(groupId(focusGroup.title))?.scrollIntoView?.({ block: 'start' });
  }, [focusGroup]);

  const q = query.trim().toLowerCase();
  const visible = groups
    .map(g => ({ ...g, props: g.props.filter(p => (!commonOnly || p.common) && (!q || p.label.toLowerCase().includes(q))) }))
    .filter(g => g.props.length > 0 || (g.later && !q));
  const helpText = helpFor ? groups.flatMap(g => g.props).find(p => p.label === helpFor)?.help : undefined;
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
    document.getElementById(groupId(title))?.scrollIntoView?.({ block: 'start' });
  };

  return (
    <section aria-label="Property Editor" className="relative flex min-h-0 flex-col bg-surface text-12">
      <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
        <input
          ref={filterRef}
          type="search"
          value={query}
          placeholder="Filter properties"
          aria-label="Filter properties"
          title="Alt+6"
          className="h-7 min-w-0 flex-1 border border-border-strong bg-bg px-2 text-12 text-text focus:border-edit focus:outline-none"
          onChange={e => setQuery(e.target.value)}
        />
        <button type="button" className={IB} title={pinned ? 'Unpin Filter' : 'Pin Filter'} aria-label={pinned ? 'Unpin Filter' : 'Pin Filter'} aria-pressed={pinned} onClick={() => setPinned(p => !p)}>
          <Pin size={12} />
        </button>
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
                {g.later && <span className="ml-1.5 font-mono text-9 text-text-faint">later</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex min-w-0 items-center gap-2 border-b border-border bg-surface-elevated px-3 py-2">
        <span className="whitespace-nowrap font-mono text-9 uppercase tracking-[0.14em] text-text-faint">{head.kind}</span>
        <span className="min-w-0 truncate font-semibold text-text">{head.name}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
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
                <span>
                  {g.title}
                  {g.later && <span className="ml-1.5 font-mono text-9 font-normal text-text-faint">later</span>}
                </span>
                <ChevronDown size={13} className={`text-text-faint transition-transform ${isClosed ? '-rotate-90' : ''}`} />
              </button>
              {!isClosed && (
                <div className="grid gap-2.5 px-3 pb-3 pt-2">
                  {g.props.map(p => (
                    <div key={p.label} className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-2" onFocus={() => setHelpFor(p.label)}>
                      {p.htmlFor ? (
                        <label htmlFor={p.htmlFor} className={`pt-1 text-12 leading-tight ${helpFor === p.label ? 'text-edit' : 'text-text-muted'} hover:text-edit`} onClick={() => setHelpFor(p.label)}>
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
                        {p.note && <span className={`text-11 leading-snug ${p.bad ? 'text-negative' : 'text-text-faint'}`}>{p.note}</span>}
                      </div>
                    </div>
                  ))}
                  {g.props.length === 0 && g.later && <p className="m-0 text-11 text-text-faint">Arrives with a later step.</p>}
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && <p className="m-0 px-3 py-3 text-12 text-text-faint">No property matches.</p>}
      </div>
      {helpOpen && (
        <div className="max-h-[34%] overflow-auto border-t border-border-strong bg-surface-elevated px-3 py-2 text-12 leading-snug text-text-muted" aria-live="polite">
          {helpFor && helpText ? (
            <>
              <b className="text-text">{helpFor}</b> · {helpText}
            </>
          ) : (
            emptyText
          )}
        </div>
      )}
      {footer}
    </section>
  );
}

function groupId(title: string): string {
  return `pe-group-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}
