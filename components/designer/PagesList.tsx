'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PAGE_GROUPS, PAGE_GROUP_LABELS, type PageGroup } from '@/lib/design/page-registry';
import { RECOVERY_DAYS, daysLeft } from '@/lib/design/page-document';
import type { PageRow } from '@/lib/design/pages';
import { CreatePageDialog } from './CreatePageDialog';
import { Sheet } from './DesignerMenu';

export type PageFilter = 'all' | 'row' | 'deleted' | PageGroup;

// The App Builder's home, as the approved designer draws it (Paddock Designer
// v2.4, docs/prototypes/paddock-designer-v2.4, renderHome): the application's
// heading, a search over number, name and path, Create Page, then every page
// in one report with its number, name, path, group, how it renders, who may
// see it, whether it is indexed and when its row last changed; a row opens the
// page. Beside the report, the cards the prototype keeps there: the
// application's facts, the pages edited most recently, and the shared
// components. Page Groups opens the prototype's sheet of groups with their
// counts, and a group filters the report (the App Builder has no rail: the
// operator, 2026-09-09, "the app builder takes precedent").
//
// A code page opens to its attributes (the Page Designer plan, PR 1: name,
// title, group, who sees it, indexed, comments) with its body as the one region
// the code serves; a row page, made here, opens to its revisions and its
// layout. "no row yet" marks a code page whose row the migration has not
// seeded on this database; it cannot open until it has one.
//
// Deleted (P1.12; ours, beside APEX's Delete Page): a page deleted from the
// Page Designer stays RECOVERY_DAYS here, with its days left, Reinstate and
// Delete permanently; past the window it reads expired and "Remove expired
// pages" removes such pages for good, one click, never a side effect. A row
// opens the page read-only in the Page Designer.

const AUTHZ_LABEL: Record<string, string> = {
  public: 'Everyone',
  signed_in: 'Signed in',
  contributor: 'Approved writers',
  administrator: 'Administrators',
};

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40 aria-pressed:border-edit aria-pressed:text-edit';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'whitespace-nowrap border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const LNK = 'block w-full py-0.5 text-left text-12 text-edit hover:underline';
const TH = 'px-2.5 py-1.5 font-semibold';

const SHARED: { sc: string; label: string }[] = [
  { sc: 'doors', label: 'Navigation Menu · Doors' },
  { sc: 'bar', label: 'Navigation Bar List' },
  { sc: 'themes', label: 'Themes' },
  { sc: 'authz', label: 'Authorization Schemes' },
];

/** The page's number: the first eight characters of its row id, as the property editor shows it. */
export function pageNumber(p: PageRow): string {
  return p.id ? p.id.slice(0, 8) : 'no row yet';
}

function updatedOn(stamp: string | null): string {
  if (!stamp) return 'no row yet';
  const m = stamp.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}Z` : stamp;
}

function dayOf(stamp: string): string {
  return stamp.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? stamp;
}

/** The pages of the operator's own: every page but the code pages the code still serves. */
function rowCountOf(pages: PageRow[]): number {
  return pages.length - pages.filter(p => p.kind === 'code' && p.served !== 'rows').length;
}

/** The Page Groups sheet (APEX: Page Groups, "a purely organizational grouping
 *  of pages"; the prototype's sheet): every group with its page count and a
 *  show button that filters the pages list. Shared by the list's Page Groups
 *  button and the Page Designer's Create › Page Group… (P1.10), which returns
 *  to the list filtered by the group shown. With deleted pages, a Deleted row (P1.12). */
export function PageGroupsSheet({
  pages,
  deletedCount = 0,
  current,
  onShow,
  onClose,
}: {
  pages: PageRow[];
  /** How many pages sit in Deleted; none hides the row. */
  deletedCount?: number;
  /** The filter (or the page's group) marked as showing. */
  current: PageFilter;
  onShow: (filter: PageFilter) => void;
  onClose: () => void;
}) {
  const rowCount = rowCountOf(pages);
  const filters: PageFilter[] = ['all', 'row', ...PAGE_GROUPS, ...(deletedCount > 0 ? (['deleted'] as PageFilter[]) : [])];
  return (
    <Sheet title="Page Groups" sub="How the pages list is organised. A group is a label; pages keep their paths." onClose={onClose}>
      <table className="w-full border-collapse text-12">
        <thead>
          <tr className="text-left text-text-faint">
            <th className="px-[18px] py-2 font-mono text-9 font-medium uppercase tracking-[0.14em]">Group</th>
            <th className="px-2.5 py-2 text-right font-mono text-9 font-medium uppercase tracking-[0.14em]">Pages</th>
            <th className="px-2.5 py-2" />
          </tr>
        </thead>
        <tbody>
          {filters.map(f => {
            const n = f === 'all' ? pages.length : f === 'row' ? rowCount : f === 'deleted' ? deletedCount : pages.filter(p => p.group === f).length;
            const label = f === 'all' ? 'All pages' : f === 'row' ? 'Your pages · made here' : f === 'deleted' ? `Deleted · reinstate within ${RECOVERY_DAYS} days` : PAGE_GROUP_LABELS[f];
            return (
              <tr key={f} className={`border-t border-border ${current === f ? 'bg-surface-elevated' : ''}`}>
                <td className="px-[18px] py-2 text-text">{label}</td>
                <td className="px-2.5 py-2 text-right font-mono tabular-nums text-text-muted">{n}</td>
                <td className="px-2.5 py-2 text-right">
                  <button type="button" className={PBTN} aria-pressed={current === f} onClick={() => onShow(f)}>
                    {current === f ? 'showing' : 'show'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Sheet>
  );
}

export function PagesList({
  pages,
  deleted = [],
  initialFilter = 'all',
  readOnly,
  onOpen,
  onCreated,
  onOpenShared,
  onReinstated,
  onPurged,
  now = Date.now,
}: {
  pages: PageRow[];
  /** The deleted pages (P1.12), newest deletion first. */
  deleted?: PageRow[];
  /** Every page, the operator's own, one group, or Deleted; Page Groups changes it. */
  initialFilter?: PageFilter;
  readOnly: boolean;
  onOpen: (id: string) => void;
  onCreated: (page: PageRow) => void;
  /** A shared component from the side card opens in its workspace, in the app. */
  onOpenShared?: (sc: string) => void;
  /** A deleted page reinstated through the route: the row as stored now. */
  onReinstated?: (page: PageRow) => void;
  /** Pages removed for good through the route, by id. */
  onPurged?: (ids: string[]) => void;
  /** The clock, for the days left; a test hands a fixed one. */
  now?: () => number;
}) {
  const [creating, setCreating] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [filter, setFilter] = useState<PageFilter>(initialFilter);
  // Deleted empties itself (the last page reinstated or removed): the list shows
  // every page again, the state adjusted during the render.
  if (filter === 'deleted' && deleted.length === 0) setFilter('all');
  const [query, setQuery] = useState('');
  /** Delete permanently asks first: the page the sheet is about. */
  const [purging, setPurging] = useState<PageRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** What the routes said: a refusal names the pages holding a deleted page. */
  const [message, setMessage] = useState<string | null>(null);
  const [held, setHeld] = useState<Record<string, string[]>>({});

  const rowCount = rowCountOf(pages);
  const codeCount = pages.length - rowCount;
  const unseeded = pages.filter(p => p.kind === 'code' && p.updatedAt === null).length;
  const filterLabel = filter === 'all' ? null : filter === 'row' ? 'Your pages' : filter === 'deleted' ? 'Deleted' : PAGE_GROUP_LABELS[filter];
  const q = query.trim().toLowerCase();
  const matches = (p: PageRow) => {
    if (!q) return true;
    const hay = `${pageNumber(p)} ${p.name} ${p.path} ${p.group ? PAGE_GROUP_LABELS[p.group] : ''}`.toLowerCase();
    return hay.includes(q);
  };
  const shown =
    filter === 'deleted'
      ? deleted.filter(matches)
      : pages.filter(p => {
          if (filter === 'row' && p.kind !== 'row') return false;
          if (filter !== 'all' && filter !== 'row' && p.group !== filter) return false;
          return matches(p);
        });
  const recent = pages
    .filter(p => p.updatedAt !== null)
    .sort((a, b) => (a.updatedAt! < b.updatedAt! ? 1 : a.updatedAt! > b.updatedAt! ? -1 : 0))
    .slice(0, 5);
  const expired = deleted.filter(p => p.deletedAt && daysLeft(p.deletedAt, now()) === 0);
  const nameOf = (id: string) => deleted.find(p => p.id === id)?.name ?? id.slice(0, 8);

  /** A deleted row's state, in words. */
  const stateOf = (p: PageRow): string => {
    if (p.id && held[p.id]) return `held by ${held[p.id].join(' · ')}`;
    if (!p.deletedAt) return 'deleted';
    const left = daysLeft(p.deletedAt, now());
    if (left === 0) return 'expired · can be removed for good';
    return `deleted ${dayOf(p.deletedAt)} · ${left} day${left === 1 ? '' : 's'} left`;
  };

  async function reinstate(p: PageRow) {
    if (!p.id) return;
    setBusy(p.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/design/pages/${p.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reinstate' }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; page?: PageRow };
      if (!res.ok || !body.page) {
        setMessage(body.error ?? `${p.name} could not be reinstated (HTTP ${res.status}).`);
        return;
      }
      onReinstated?.(body.page);
    } catch {
      setMessage('Network error. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function purge(p: PageRow) {
    if (!p.id) return;
    setBusy(p.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/design/pages/${p.id}?purge=1`, { method: 'DELETE' });
      const body = (await res.json().catch(() => ({}))) as { error?: string; pages?: string[] };
      if (!res.ok) {
        if (body.pages && p.id) setHeld(h => ({ ...h, [p.id!]: body.pages! }));
        setMessage(body.error ?? `${p.name} could not be removed (HTTP ${res.status}).`);
        return;
      }
      onPurged?.([p.id]);
    } catch {
      setMessage('Network error. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function purgeExpired() {
    setBusy('expired');
    setMessage(null);
    try {
      const res = await fetch('/api/admin/design/pages?expired=1', { method: 'DELETE' });
      const body = (await res.json().catch(() => ({}))) as { error?: string; purged?: string[]; held?: { id: string; pages: string[] }[] };
      if (!res.ok) {
        setMessage(body.error ?? `The expired pages could not be removed (HTTP ${res.status}).`);
        return;
      }
      if (body.held && body.held.length > 0) {
        setHeld(h => Object.fromEntries([...Object.entries(h), ...body.held!.map(x => [x.id, x.pages])]));
        setMessage(body.held.map(x => `${nameOf(x.id)} is held by ${x.pages.join(' · ')}`).join('; ') + '.');
      }
      if (body.purged && body.purged.length > 0) onPurged?.(body.purged);
    } catch {
      setMessage('Network error. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h2 className="m-0 text-20 font-bold text-text">
        Application 100 · Paddock
        {filterLabel && <span className="ml-2 font-mono text-11 font-normal uppercase tracking-[0.14em] text-text-faint">· {filterLabel}</span>}
      </h2>
      <p className="m-0 mb-3 max-w-[76ch] text-13 text-text-muted">
        Every page the site serves, in one list; each opens in the Page Designer. A page whose body the code still draws
        carries that body as one component you put regions around, until the page is split. The header, the footer and
        the phone bar are shared components, edited under Shared Components, never here.
        {unseeded > 0 ? ` ${unseeded} code page${unseeded === 1 ? ' has' : 's have'} no row yet on this database.` : ''}
      </p>
      <div className="mb-3 flex items-center gap-2">
        <input
          type="search"
          value={query}
          placeholder="Search pages by number, name or path"
          aria-label="Search pages"
          className="h-[30px] w-full max-w-[360px] border border-border-strong bg-bg px-2 text-12 text-text focus:border-edit focus:outline-none"
          onChange={e => setQuery(e.target.value)}
        />
        <span className="flex-1" />
        <button type="button" className={TB} aria-haspopup="dialog" onClick={() => setGroupsOpen(true)}>
          Page Groups
          {filterLabel && <span className="font-mono text-9 uppercase tracking-[0.12em] text-edit">· {filterLabel}</span>}
        </button>
        {deleted.length > 0 && (
          <button type="button" className={TB} aria-pressed={filter === 'deleted'} onClick={() => setFilter(filter === 'deleted' ? 'all' : 'deleted')}>
            Deleted · {deleted.length}
          </button>
        )}
        {!readOnly && (
          <button type="button" className={TB_PRIMARY} onClick={() => setCreating(true)}>
            <Plus size={13} /> Create page <span aria-hidden="true">›</span>
          </button>
        )}
      </div>
      {groupsOpen && (
        <PageGroupsSheet
          pages={pages}
          deletedCount={deleted.length}
          current={filter}
          onShow={f => {
            setFilter(f);
            setGroupsOpen(false);
          }}
          onClose={() => setGroupsOpen(false)}
        />
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          {filter === 'row' && rowCount === 0 && (
            <p className="mb-4 border border-dashed border-border px-3 py-4 text-12 text-text-faint">
              No page of your own yet. Create page starts one from a template.
            </p>
          )}
          {filter === 'deleted' && (
            <div className="mb-3 flex flex-wrap items-center gap-3 border border-border-strong bg-surface px-3 py-2 text-12 text-text-muted">
              <span>
                A deleted page stays here {RECOVERY_DAYS} days for Reinstate; readers find nothing at its address meanwhile, and the address stays its own.
                Past the window it can be removed for good, with its revisions.
              </span>
              {!readOnly && expired.length > 0 && (
                <button type="button" className={`${PBTN} hover:border-negative hover:text-negative`} disabled={busy !== null} onClick={() => void purgeExpired()}>
                  Remove {expired.length} expired page{expired.length === 1 ? '' : 's'}
                </button>
              )}
            </div>
          )}
          {message && (
            <p role="alert" className="mb-3 border border-negative/40 bg-surface px-3 py-2 text-12 text-negative">
              {message}
            </p>
          )}
          {shown.length > 0 && filter !== 'deleted' && (
            <div className="overflow-x-auto border border-border-strong bg-surface">
              <table className="w-full border-collapse text-12">
                <thead>
                  <tr className="text-left text-text-faint">
                    <th className={`w-24 ${TH}`}>Page</th>
                    <th className={TH}>Name</th>
                    <th className={TH}>Path</th>
                    <th className={`w-24 ${TH}`}>Group</th>
                    <th className={`w-24 ${TH}`}>Renders</th>
                    <th className={`w-32 ${TH}`}>Authorization</th>
                    <th className={`w-16 ${TH}`}>Indexed</th>
                    <th className={`w-36 ${TH}`}>Updated</th>
                    <th className={`w-24 ${TH}`}>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(p => (
                    <tr
                      key={p.path}
                      className={`border-t border-border align-top ${p.id ? 'cursor-pointer hover:bg-surface-elevated' : ''}`}
                      onClick={p.id ? () => onOpen(p.id!) : undefined}
                    >
                      <td className="px-2.5 py-1.5 font-mono text-11 text-text-faint">{pageNumber(p)}</td>
                      <td className="px-2.5 py-1.5 text-text">
                        <b className="font-semibold">{p.name}</b>
                        {p.comments && <span className="mt-0.5 block text-11 font-normal text-text-faint">{p.comments}</span>}
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-11 text-text-muted">{p.path}</td>
                      <td className="px-2.5 py-1.5">
                        <span className="border border-border-strong px-1.5 py-0.5 text-11 text-text-muted">{p.group ? PAGE_GROUP_LABELS[p.group] : 'none'}</span>
                      </td>
                      <td className="px-2.5 py-1.5 text-text-muted">{p.rendering === 'dynamic' ? 'each visit' : 'cached'}</td>
                      <td className="px-2.5 py-1.5 text-text-muted">{p.authz ? (AUTHZ_LABEL[p.authz] ?? p.authz) : 'Everyone'}</td>
                      <td className="px-2.5 py-1.5 text-text-muted">{p.indexable ? 'yes' : 'no'}</td>
                      <td className="px-2.5 py-1.5 font-mono text-11 text-text-muted">{updatedOn(p.updatedAt)}</td>
                      <td className="px-2.5 py-1.5">
                        {p.id ? (
                          <button
                            type="button"
                            className={`${PBTN} text-edit`}
                            aria-label={`Open ${p.name}`}
                            onClick={e => {
                              e.stopPropagation();
                              onOpen(p.id!);
                            }}
                          >
                            open
                          </button>
                        ) : (
                          <span className="font-mono text-9 uppercase tracking-[0.12em] text-text-faint">{p.kind}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {shown.length > 0 && filter === 'deleted' && (
            <div className="overflow-x-auto border border-border-strong bg-surface">
              <table className="w-full border-collapse text-12">
                <thead>
                  <tr className="text-left text-text-faint">
                    <th className={`w-24 ${TH}`}>Page</th>
                    <th className={TH}>Name</th>
                    <th className={TH}>Path</th>
                    <th className={`w-24 ${TH}`}>Group</th>
                    <th className={`w-64 ${TH}`}>State</th>
                    <th className={`w-56 ${TH}`}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(p => (
                    <tr key={p.path} className="cursor-pointer border-t border-border align-top hover:bg-surface-elevated" onClick={p.id ? () => onOpen(p.id!) : undefined}>
                      <td className="px-2.5 py-1.5 font-mono text-11 text-text-faint">{pageNumber(p)}</td>
                      <td className="px-2.5 py-1.5 text-text">
                        <b className="font-semibold">{p.name}</b>
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-11 text-text-muted">{p.path}</td>
                      <td className="px-2.5 py-1.5">
                        <span className="border border-border-strong px-1.5 py-0.5 text-11 text-text-muted">{p.group ? PAGE_GROUP_LABELS[p.group] : 'none'}</span>
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-11 text-text-muted">{stateOf(p)}</td>
                      <td className="px-2.5 py-1.5">
                        {!readOnly && p.id && (
                          <span className="flex gap-1">
                            <button
                              type="button"
                              className={`${PBTN} text-edit`}
                              aria-label={`Reinstate ${p.name}`}
                              disabled={busy !== null}
                              onClick={e => {
                                e.stopPropagation();
                                void reinstate(p);
                              }}
                            >
                              Reinstate
                            </button>
                            <button
                              type="button"
                              className={`${PBTN} hover:border-negative hover:text-negative`}
                              aria-label={`Delete ${p.name} permanently`}
                              disabled={busy !== null}
                              onClick={e => {
                                e.stopPropagation();
                                setPurging(p);
                              }}
                            >
                              Delete permanently
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {shown.length === 0 && q && <p className="border border-dashed border-border px-3 py-4 text-12 text-text-faint">No page matches “{query.trim()}”.</p>}
        </div>

        <aside className="grid gap-3">
          <section className="border border-border-strong bg-surface p-3">
            <h4 className="m-0 mb-2 text-13 font-bold text-text">Application</h4>
            <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-12">
              <dt className="text-text-muted">Name</dt>
              <dd className="m-0 text-text">Paddock</dd>
              <dt className="text-text-muted">Pages</dt>
              <dd className="m-0 text-text tnum">{pages.length}</dd>
              <dt className="text-text-muted">Body still drawn by the code</dt>
              <dd className="m-0 text-text tnum">{codeCount}</dd>
              <dt className="text-text-muted">Made here</dt>
              <dd className="m-0 text-text tnum">{rowCount}</dd>
              {deleted.length > 0 && (
                <>
                  <dt className="text-text-muted">Deleted</dt>
                  <dd className="m-0 text-text tnum">{deleted.length}</dd>
                </>
              )}
            </dl>
          </section>
          {recent.length > 0 && (
            <section className="border border-border-strong bg-surface p-3">
              <h4 className="m-0 mb-1 text-13 font-bold text-text">Recently edited</h4>
              {recent.map(p => (
                <button key={p.path} type="button" className={LNK} onClick={() => onOpen(p.id!)}>
                  {pageNumber(p)} · {p.name}
                </button>
              ))}
            </section>
          )}
          <section className="border border-border-strong bg-surface p-3">
            <h4 className="m-0 mb-1 text-13 font-bold text-text">Shared components</h4>
            {SHARED.map(s =>
              onOpenShared ? (
                <button key={s.sc} type="button" className={LNK} onClick={() => onOpenShared(s.sc)}>
                  {s.label}
                </button>
              ) : (
                <a key={s.sc} href={`/admin/designer?sc=${s.sc}`} className={LNK}>
                  {s.label}
                </a>
              ),
            )}
          </section>
        </aside>
      </div>

      {creating && (
        <CreatePageDialog
          pages={pages}
          deleted={deleted}
          onClose={() => setCreating(false)}
          onCreated={page => {
            setCreating(false);
            onCreated(page);
          }}
        />
      )}
      {purging && (
        <Sheet
          title="Delete permanently"
          sub={`${purging.name} · ${purging.path}`}
          onClose={() => setPurging(null)}
          buttons={[{ label: 'Cancel' }, { label: 'Delete permanently', danger: true, disabled: busy !== null, run: () => void purge(purging) }]}
        >
          <p className="m-0 px-[18px] py-3 text-13 text-text">
            The page is removed for good with its revisions, and {purging.path} is free for a new page. A menu entry naming it goes
            with it. Refused while a live page names it. This cannot be undone.
          </p>
        </Sheet>
      )}
    </div>
  );
}
