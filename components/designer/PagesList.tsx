'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PAGE_GROUPS, PAGE_GROUP_LABELS, type PageGroup } from '@/lib/design/page-registry';
import type { PageRow } from '@/lib/design/pages';
import { CreatePageDialog } from './CreatePageDialog';

// The App Builder's first screen (Phase 3 steps 1 and 2a): every page the site
// serves, by group. A code page shows the facts its row carries and nothing
// more, because the code owns it; a row page, made here, opens to its
// revisions and its schematic. "Create page" opens the dialog that makes a row
// page from a template. "no row yet" marks a code page whose row the migration
// has not seeded on this database.

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
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';

export function PagesList({
  pages,
  readOnly,
  onOpen,
  onCreated,
}: {
  pages: PageRow[];
  readOnly: boolean;
  onOpen: (id: string) => void;
  onCreated: (page: PageRow) => void;
}) {
  const [creating, setCreating] = useState(false);

  const groups: (PageGroup | null)[] = [...PAGE_GROUPS, null];
  const codeCount = pages.filter(p => p.kind === 'code').length;
  const rowCount = pages.length - codeCount;
  const unseeded = pages.filter(p => p.kind === 'code' && p.updatedAt === null).length;

  return (
    <div>
      <div className="mb-1 flex items-start justify-between gap-4">
        <h2 className="m-0 text-20 font-bold text-text">Pages</h2>
        {!readOnly && (
          <button type="button" className={TB_PRIMARY} onClick={() => setCreating(true)}>
            <Plus size={13} /> Create page
          </button>
        )}
      </div>
      <p className="m-0 mb-4 max-w-[76ch] text-13 text-text-muted">
        Every page the site serves, as rows the designer can see. The {codeCount} pages the code serves are listed with how
        each renders, whether search engines may index it and who may see it; they are the code’s and cannot be edited
        here. A page made here starts from a template and is served from a published revision once step 3 lands; it can
        never take a path listed for the code.
        {rowCount > 0 ? ` ${rowCount} such page${rowCount === 1 ? ' exists' : 's exist'}.` : ''}
        {unseeded > 0 ? ` ${unseeded} code page${unseeded === 1 ? ' has' : 's have'} no row yet on this database.` : ''}
      </p>

      {groups.map(g => {
        const rows = pages.filter(p => p.group === g);
        if (rows.length === 0) return null;
        return (
          <section key={g ?? 'ungrouped'} className="mb-4 border border-border-strong bg-surface">
            <h3 className="m-0 border-b border-border px-2.5 py-2 text-12 font-semibold text-text-muted">
              {g ? PAGE_GROUP_LABELS[g] : 'No group'}
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
                  <th className="w-28 px-2.5 py-1.5 font-semibold">Kind</th>
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
                    <td className="px-2.5 py-1.5">
                      {p.kind === 'row' && p.id ? (
                        <button type="button" className={`${PBTN} text-edit`} onClick={() => onOpen(p.id!)} aria-label={`Open ${p.name}`}>
                          row · open
                        </button>
                      ) : (
                        <span className="font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
                          {p.kind}
                          {p.updatedAt === null && <span className="mt-0.5 block normal-case tracking-normal">no row yet</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

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
