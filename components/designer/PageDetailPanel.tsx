'use client';

import { ArrowLeft } from 'lucide-react';
import { PAGE_GROUP_LABELS } from '@/lib/design/page-registry';
import type { PageDetail } from '@/lib/design/page-revisions';
import type { EditableAsset } from '@/lib/design/assets';
import type { EditableAuthzScheme } from '@/lib/design/authz';
import type { EditableShortcut } from '@/lib/design/shortcuts';
import { PageEditor } from './PageEditor';

// One page in the App Builder: its facts, then for a row page the editor
// (Phase 3 step 2b: the schematic, the gallery, the properties, Save draft and
// Publish, the revisions), for a code page a sentence. Serving the page to
// visitors is step 3.

const AUTHZ_LABEL: Record<string, string> = {
  public: 'Everyone',
  signed_in: 'Signed in',
  contributor: 'Approved writers',
  administrator: 'Administrators',
};

const PBTN =
  'inline-flex items-center gap-1.5 border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text';

export function PageDetailPanel({
  detail,
  readOnly,
  lists,
  assets,
  schemes,
  shortcuts,
  onBack,
  onSaved,
}: {
  detail: PageDetail;
  readOnly: boolean;
  lists: { key: string; label: string }[];
  assets: EditableAsset[];
  schemes?: EditableAuthzScheme[];
  shortcuts: EditableShortcut[];
  onBack: () => void;
  onSaved: (detail: PageDetail) => void;
}) {
  const { page } = detail;
  return (
    <div>
      <button type="button" className={`${PBTN} mb-3`} onClick={onBack}>
        <ArrowLeft size={11} /> All pages
      </button>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">{page.name}</h2>
      <p className="m-0 mb-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-11 text-text-muted">
        <span>{page.path}</span>
        <span>{page.group ? PAGE_GROUP_LABELS[page.group] : 'no group'}</span>
        <span>{page.kind === 'code' ? 'served by the code' : 'served from a revision'}</span>
        <span>{page.rendering === 'dynamic' ? 'renders each visit' : 'cached'}</span>
        <span>{page.indexable ? 'indexed' : 'not indexed'}</span>
        <span>{page.authz ? (AUTHZ_LABEL[page.authz] ?? page.authz) : 'Everyone'}</span>
      </p>

      {page.kind === 'code' ? (
        <p className="mb-4 max-w-[70ch] text-12 text-text-muted">
          The code serves this page; the designer lists it so a page made here can never take its path. It has no layout
          document.
        </p>
      ) : (
        <PageEditor
          key={page.id ?? page.path}
          detail={detail}
          readOnly={readOnly}
          lists={lists}
          assets={assets}
          schemes={schemes}
          shortcuts={shortcuts}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
