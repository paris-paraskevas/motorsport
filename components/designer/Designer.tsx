'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ConsoleModeToggle } from '@/components/admin/ConsoleMode';
import type { EditableList, NavListKey } from '@/lib/design/lists';
import { CATALOGUE, LIST_COPY, type CatalogueItem } from './catalogue';
import { ListEditor } from './ListEditor';

// Paddock Developer: the designer's shell in the prototype's shape (2026-09-07,
// v2.4): the workspace header, the crumbs bar, and for Shared Components a
// 300-pixel catalogue beside the editor. Full viewport over the console, so the
// rail never competes with the panes; the arrow at the top left goes back.
//
// Phase 2 step 2 opens the four navigation lists. Everything else in the
// catalogue is listed with the phase that brings it: the operator sees the whole
// shape, and nothing pretends to be editable before it is. App Builder and Data
// are the next workspaces.
//
// This file is loaded as a browser-only chunk (DesignerLoader.tsx), so the
// editor never enters the Worker bundle.

type Loaded =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; list: EditableList };

const LIST_KEYS: NavListKey[] = ['doors', 'bar', 'footer-site', 'footer-legal'];
const ROLE_OF: Record<NavListKey, 'menu' | 'bar' | 'footer'> = {
  doors: 'menu',
  bar: 'bar',
  'footer-site': 'footer',
  'footer-legal': 'footer',
};

async function fetchList(key: NavListKey): Promise<Loaded> {
  try {
    const res = await fetch(`/api/admin/design/lists/${key}`, { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The list could not be loaded (HTTP ${res.status}).` };
    return { state: 'ready', list: (await res.json()) as EditableList };
  } catch {
    return { state: 'error', message: 'The list could not be loaded: network error.' };
  }
}

export function Designer({
  readOnly,
  who,
  initialSelected = null,
  initialLists,
}: {
  readOnly: boolean;
  who: string;
  /** A catalogue key to open on, from `?sc=` on the page. Unknown keys open the overview. */
  initialSelected?: string | null;
  /** Lists the server already loaded, so opening needs no round trip; any list
   *  missing here is fetched. */
  initialLists?: Partial<Record<NavListKey, EditableList>>;
}) {
  const [selected, setSelected] = useState<string | null>(() =>
    initialSelected && CATALOGUE.some(g => g.items.some(i => i.key === initialSelected)) ? initialSelected : null,
  );
  const [lists, setLists] = useState<Partial<Record<NavListKey, Loaded>>>(() =>
    Object.fromEntries(
      LIST_KEYS.map(k => {
        const given = initialLists?.[k];
        return [k, given ? { state: 'ready', list: given } : { state: 'loading' }];
      }),
    ),
  );

  // All four lists on open: the overview shows their counts, and the footer
  // preview needs the column that is not being edited. Only the ones the server
  // did not hand over are fetched.
  useEffect(() => {
    let cancelled = false;
    for (const key of LIST_KEYS) {
      if (initialLists?.[key]) continue;
      void fetchList(key).then(loaded => {
        if (!cancelled) setLists(s => ({ ...s, [key]: loaded }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [initialLists]);

  const item: CatalogueItem | undefined = selected
    ? CATALOGUE.flatMap(g => g.items).find(i => i.key === selected)
    : undefined;
  const listKey = item?.listKey;

  const count = (key: NavListKey): number | null => {
    const l = lists[key];
    return l && l.state === 'ready' ? l.list.entries.length : null;
  };
  const stored = (key: NavListKey) => {
    const l = lists[key];
    return l && l.state === 'ready' ? l.list.entries : [];
  };

  return (
    <div className="fixed inset-0 z-40 grid grid-rows-[40px_30px_minmax(0,1fr)] bg-bg text-[12.5px] text-text">
      <header className="flex items-center gap-1 border-b border-border-strong bg-surface pl-2 pr-3">
        <Link
          href="/admin"
          title="Back to the console"
          aria-label="Back to the console"
          className="grid h-[30px] w-[30px] place-items-center border border-transparent text-text-muted hover:border-border-strong hover:bg-surface-elevated hover:text-text"
        >
          <ArrowLeft size={14} />
        </Link>
        <span className="mr-4 whitespace-nowrap font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-text">
          Paddock<span className="text-brand">•</span>
          <span className="font-normal text-text-muted">Developer</span>
        </span>
        <nav aria-label="Workspaces" className="flex self-stretch">
          <WorkspaceTab label="App Builder" later="Phase 3" />
          <WorkspaceTab label="Shared Components" active />
          <WorkspaceTab label="Data" later="later" />
        </nav>
        <span className="flex-1" />
        <span className="whitespace-nowrap font-mono text-[10px] tracking-[0.04em] text-text-faint">{who}</span>
        <ConsoleModeToggle />
      </header>

      <div className="flex h-[30px] items-center gap-2 border-b border-border bg-surface-elevated px-3.5 text-[11px] text-text-faint">
        <b className="font-medium text-text-muted">Shared Components</b>
        <span>›</span>
        <span>Application 100 · Paddock</span>
        {item && (
          <>
            <span>›</span>
            <span>{item.label}</span>
          </>
        )}
      </div>

      <div className="grid min-h-0 grid-cols-[300px_minmax(0,1fr)]">
        <nav aria-label="Shared components" className="overflow-auto border-r border-border-strong bg-surface pb-5 pt-2">
          {CATALOGUE.map(group => (
            <div key={group.group}>
              <div className="px-3.5 pb-1 pt-3 text-[12px] font-semibold text-text-muted">{group.group}</div>
              {group.items.map(it => {
                const active = selected === it.key;
                const n = it.listKey ? count(it.listKey) : null;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => setSelected(it.key)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full items-center gap-2.5 py-[7px] pl-[22px] pr-3.5 text-left text-[12px] ${
                      active
                        ? 'bg-edit-dim text-text shadow-[inset_2px_0_0_var(--edit)]'
                        : it.listKey
                          ? 'text-text-muted hover:bg-surface-elevated hover:text-text'
                          : 'text-text-faint hover:bg-surface-elevated hover:text-text-muted'
                    }`}
                  >
                    <span>{it.label}</span>
                    {it.later && <span className="ml-auto font-mono text-[9px] text-text-faint">{it.later}</span>}
                    {n !== null && <span className="ml-auto font-mono text-[9px] text-text-faint">{n}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <main className="min-w-0 overflow-auto px-6 pb-8 pt-[18px]">
          {readOnly && (
            <p className="mb-4 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-[12px] text-text-muted">
              Design edits are made on production. This copy of the site is read-only: browse and preview here, save on
              paddock-tracker.com.
            </p>
          )}

          {!item && (
            <>
              <h2 className="m-0 mb-1 text-[20px] font-bold text-text">Shared Components</h2>
              <p className="m-0 mb-4 max-w-[70ch] text-[13px] text-text-muted">
                Everything the pages share. The header, the footer and the phone bar are lists here; security, themes and
                the data the regions read follow in later steps. Edit once, every page follows.
              </p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {CATALOGUE.map(group => (
                  <div key={group.group} className="grid content-start gap-1.5 border border-border-strong bg-surface p-3.5">
                    <h4 className="m-0 mb-1 text-[13px] font-bold text-text">{group.group}</h4>
                    {group.items.map(it => (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => setSelected(it.key)}
                        className={`py-0.5 text-left text-[12px] ${it.listKey ? 'text-edit hover:underline' : 'text-text-faint'}`}
                      >
                        {it.label}
                        {it.listKey && count(it.listKey) !== null && (
                          <span className="ml-1.5 font-mono text-[10px] text-text-faint">{count(it.listKey)}</span>
                        )}
                        {it.later && <span className="ml-1.5 font-mono text-[9px] text-text-faint">{it.later}</span>}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {item && !listKey && (
            <>
              <h2 className="m-0 mb-1 text-[20px] font-bold text-text">{item.label}</h2>
              <p className="m-0 max-w-[70ch] text-[13px] text-text-muted">
                Not editable yet: {item.later}. The field guide names the table it needs; it arrives with the phase that
                creates it.
              </p>
            </>
          )}

          {item && listKey && (() => {
            const loaded = lists[listKey];
            if (!loaded || loaded.state === 'loading') {
              return <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-faint">Loading {item.label}…</p>;
            }
            if (loaded.state === 'error') {
              return <p className="text-[12px] text-negative">{loaded.message}</p>;
            }
            const other: NavListKey | null =
              listKey === 'footer-site' ? 'footer-legal' : listKey === 'footer-legal' ? 'footer-site' : null;
            return (
              <ListEditor
                key={listKey}
                listKey={listKey}
                role={ROLE_OF[listKey]}
                list={loaded.list}
                title={LIST_COPY[listKey].title}
                sub={LIST_COPY[listKey].sub}
                readOnly={readOnly}
                otherFooter={other ? stored(other) : undefined}
                onSaved={list => setLists(s => ({ ...s, [listKey]: { state: 'ready', list } }))}
              />
            );
          })()}
        </main>
      </div>
    </div>
  );
}

function WorkspaceTab({ label, active = false, later }: { label: string; active?: boolean; later?: string }) {
  return (
    <button
      type="button"
      disabled={!active}
      title={later ? `${label}: ${later}` : label}
      className={`relative h-[40px] whitespace-nowrap px-3 text-[12px] font-medium ${
        active ? 'text-text shadow-[inset_0_-2px_0_var(--edit)]' : 'cursor-default text-text-faint'
      }`}
    >
      {label}
      {later && <span className="ml-1.5 font-mono text-[9px] text-text-faint">{later}</span>}
    </button>
  );
}
