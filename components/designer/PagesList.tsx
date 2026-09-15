'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PAGE_GROUPS, PAGE_GROUP_LABELS, type PageGroup } from '@/lib/design/page-registry';
import type { PageRow } from '@/lib/design/pages';
import { CreatePageDialog } from './CreatePageDialog';
import { Sheet } from './DesignerMenu';

export type PageFilter = 'all' | 'row' | PageGroup;

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

const AUTHZ_LABEL: Record<string, string> = {
  public: 'Everyone',
  signed_in: 'Signed in',
  contributor: 'Approved writers',
  administrator: 'Administrators',
};

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'whitespace-nowrap border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const LNK = 'block w-full py-0.5 text-left text-12 text-edit hover:underline';

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
  const m = stamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}Z` : stamp;
}

/** The pages of the operator's own: every page but the code pages the code still serves. */
function rowCountOf(pages: PageRow[]): number {
  return pages.length - pages.filter(p => p.kind === 'code' && p.served !== 'rows').length;
}

/** The Page Groups sheet (APEX: Page Groups, "a purely organizational grouping
 *  of pages"; the prototype's sheet): every group with its page count and a
 *  show button that filters the pages list. Shared by the list's Page Groups
 *  button and the Page Designer's Create › Page Group… (P1.10), which returns
 *  to the list filtered by the group shown. */
export function PageGroupsSheet({
  pages,
  current,
  onShow,
  onClose,
}: {
  pages: PageRow[];
  /** The filter (or the page's group) marked as showing. */
  current: PageFilter;
  onShow: (filter: PageFilter) => void;
  onClose: () => void;
}) {
  const rowCount = rowCountOf(pages);
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
          {(['all', 'row', ...PAGE_GROUPS] as PageFilter[]).map(f => {
            const n = f === 'all' ? pages.length : f === 'row' ? rowCount : pages.filter(p => p.group === f).length;
            const label = f === 'all' ? 'All pages' : f === 'row' ? 'Your pages · made here' : PAGE_GROUP_LABELS[f];
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
  initialFilter = 'all',
  readOnly,
  onOpen,
  onCreated,
  onOpenShared,
}: {
  pages: PageRow[];
  /** Every page, the operator's own, or one group; Page Groups changes it. */
  initialFilter?: PageFilter;
  readOnly: boolean;
  onOpen: (id: string) => void;
  onCreated: (page: PageRow) => void;
  /** A shared component from the side card opens in its workspace, in the app. */
  onOpenShared?: (sc: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [filter, setFilter] = useState<PageFilter>(initialFilter);
  const [query, setQuery] = useState('');

  const rowCount = rowCountOf(pages);
  const codeCount = pages.length - rowCount;
  const unseeded = pages.filter(p => p.kind === 'code' && p.updatedAt === null).length;
  const filterLabel = filter === 'all' ? null : filter === 'row' ? 'Your pages' : PAGE_GROUP_LABELS[filter];
  const q = query.trim().toLowerCase();
  const shown = pages.filter(p => {
    if (filter === 'row' && p.kind !== 'row') return false;
    if (filter !== 'all' && filter !== 'row' && p.group !== filter) return false;
    if (!q) return true;
    const hay = `${pageNumber(p)} ${p.name} ${p.path} ${p.group ? PAGE_GROUP_LABELS[p.group] : ''}`.toLowerCase();
    return hay.includes(q);
  });
  const recent = pages
    .filter(p => p.updatedAt !== null)
    .sort((a, b) => (a.updatedAt! < b.updatedAt! ? 1 : a.updatedAt! > b.updatedAt! ? -1 : 0))
    .slice(0, 5);

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
        {!readOnly && (
          <button type="button" className={TB_PRIMARY} onClick={() => setCreating(true)}>
            <Plus size={13} /> Create page <span aria-hidden="true">›</span>
          </button>
        )}
      </div>
      {groupsOpen && (
        <PageGroupsSheet
          pages={pages}
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
          {shown.length > 0 && (
            <div className="overflow-x-auto border border-border-strong bg-surface">
              <table className="w-full border-collapse text-12">
                <thead>
                  <tr className="text-left text-text-faint">
                    <th className="w-24 px-2.5 py-1.5 font-semibold">Page</th>
                    <th className="px-2.5 py-1.5 font-semibold">Name</th>
                    <th className="px-2.5 py-1.5 font-semibold">Path</th>
                    <th className="w-24 px-2.5 py-1.5 font-semibold">Group</th>
                    <th className="w-24 px-2.5 py-1.5 font-semibold">Renders</th>
                    <th className="w-32 px-2.5 py-1.5 font-semibold">Authorization</th>
                    <th className="w-16 px-2.5 py-1.5 font-semibold">Indexed</th>
                    <th className="w-36 px-2.5 py-1.5 font-semibold">Updated</th>
                    <th className="w-24 px-2.5 py-1.5 font-semibold">
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
          onClose={() => setCreating(false)}
          onCreated={page => {
            setCreating(false);
            onCreated(page);
          }}
        />
      )}
    </div>
  );
}
