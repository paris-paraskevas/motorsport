'use client';

import { PAGE_GROUPS, PAGE_GROUP_LABELS, type PageGroup } from '@/lib/design/page-registry';
import type { PageRow } from '@/lib/design/pages';

// The App Builder's first screen (Phase 3 step 1): every page the site serves,
// by group, read-only. A code page shows the facts its row carries and nothing
// more, because the code owns it; a row page, made here from a layout, arrives
// with step 2 and brings its own controls. "no row yet" marks a code page whose
// row the migration has not seeded on this database.

const AUTHZ_LABEL: Record<string, string> = {
  public: 'Everyone',
  signed_in: 'Signed in',
  contributor: 'Approved writers',
  administrator: 'Administrators',
};

export function PagesList({ pages }: { pages: PageRow[] }) {
  const groups: (PageGroup | null)[] = [...PAGE_GROUPS, null];
  const codeCount = pages.filter(p => p.kind === 'code').length;
  const rowCount = pages.length - codeCount;
  const unseeded = pages.filter(p => p.kind === 'code' && p.updatedAt === null).length;
  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Pages</h2>
      <p className="m-0 mb-4 max-w-[76ch] text-13 text-text-muted">
        Every page the site serves, as rows the designer can see. The {codeCount} pages the code serves are listed with how
        each renders, whether search engines may index it and who may see it; they are the code’s and cannot be edited
        here. Pages made in the designer from a layout arrive with the next step, and can never take a path listed here.
        {rowCount > 0 ? ` ${rowCount} such page${rowCount === 1 ? '' : 's'} exist.` : ''}
        {unseeded > 0 ? ` ${unseeded} code page${unseeded === 1 ? ' has' : 's have'} no row yet on this database.` : ''}
      </p>

      {groups.map(group => {
        const rows = pages.filter(p => p.group === group);
        if (rows.length === 0) return null;
        return (
          <section key={group ?? 'ungrouped'} className="mb-4 border border-border-strong bg-surface">
            <h3 className="m-0 border-b border-border px-2.5 py-2 text-12 font-semibold text-text-muted">
              {group ? PAGE_GROUP_LABELS[group] : 'No group'}
              <span className="ml-2 font-mono text-9 uppercase tracking-[0.12em] text-text-faint">{rows.length}</span>
            </h3>
            <table className="w-full border-collapse text-12">
              <thead>
                <tr className="text-left text-text-faint">
                  <th className="w-56 px-2.5 py-1.5 font-semibold">Page</th>
                  <th className="px-2.5 py-1.5 font-semibold">Path</th>
                  <th className="w-24 px-2.5 py-1.5 font-semibold">Renders</th>
                  <th className="w-20 px-2.5 py-1.5 font-semibold">Indexed</th>
                  <th className="w-36 px-2.5 py-1.5 font-semibold">Who sees it</th>
                  <th className="w-20 px-2.5 py-1.5 font-semibold">Kind</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(p => (
                  <tr key={p.path} className="border-t border-border align-top">
                    <td className="px-2.5 py-1.5 text-text">
                      {p.name}
                      {p.comments && <span className="mt-0.5 block text-11 text-text-faint">{p.comments}</span>}
                    </td>
                    <td className="px-2.5 py-1.5 font-mono text-11 text-text-muted">{p.path}</td>
                    <td className="px-2.5 py-1.5 text-text-muted">{p.rendering === 'dynamic' ? 'each visit' : 'cached'}</td>
                    <td className="px-2.5 py-1.5 text-text-muted">{p.indexable ? 'yes' : 'no'}</td>
                    <td className="px-2.5 py-1.5 text-text-muted">{p.authz ? (AUTHZ_LABEL[p.authz] ?? p.authz) : 'Everyone'}</td>
                    <td className="px-2.5 py-1.5 font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
                      {p.kind}
                      {p.updatedAt === null && <span className="mt-0.5 block normal-case tracking-normal">no row yet</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
