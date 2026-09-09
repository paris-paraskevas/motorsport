import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-guard';
import { loadAssetsById, loadRevisionPreview } from '@/lib/design/live-page';
import { loadShortcuts } from '@/lib/design/shortcuts';
import { loadDocumentLists, loadNavLists } from '@/lib/design/lists';
import { loadAuthzSchemes } from '@/lib/design/authz';
import { documentRefs, schemesAsked } from '@/lib/design/page-document';
import { renderComponents } from '@/lib/design/component-render';
import { RowPageView } from '@/components/page/RowPageView';
import { DeveloperToolbar } from '@/components/page/DeveloperToolbar';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';

// Save and Run (APEX: Save and Run Page), Phase 3 step 6. The designer's "Save
// and run" saves a draft and opens /preview/<revision id>: this route renders
// that revision of its row page, draft or published, exactly as the catch-all
// would render a live one, wearing the runtime developer toolbar. For
// administrators only (404 for everyone else, so the address leaks nothing),
// rendered per request, never indexed. Every region shows, whatever scheme it
// asks for: the administrator is checking the layout, not their own access.

export const dynamic = 'force-dynamic';

type Params = Promise<{ rev: string }>;

async function baseMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { rev } = await params;
  const preview = await loadRevisionPreview(rev);
  return {
    title: preview ? `Preview · ${preview.page.title ?? preview.page.name}` : 'Preview',
    robots: { index: false, follow: false },
  };
}
export const generateMetadata = pageMetadata('/preview/[rev]', baseMetadata);

async function RevisionPreviewPage({ params }: { params: Params }) {
  await requireAdmin();
  const { rev } = await params;
  const preview = await loadRevisionPreview(rev);
  if (!preview) notFound();

  const asked = schemesAsked(preview.page.authz, preview.document);
  const refs = documentRefs(preview.document);
  const [shortcuts, assets, nav, schemes, components] = await Promise.all([
    loadShortcuts(),
    loadAssetsById(refs.assets),
    loadNavLists(),
    asked.length > 0 ? loadAuthzSchemes() : Promise.resolve([]),
    // Every component draws in the preview too; the show rules are not applied here.
    renderComponents(preview.document, { path: preview.page.path }),
  ]);
  const messages: Record<string, string | null> = {};
  for (const key of asked) messages[key] = schemes.find(s => s.key === key)?.message ?? null;
  const lists = await loadDocumentLists(refs.lists, nav);

  return (
    <>
      <DeveloperToolbar
        page={preview.page}
        revisionId={preview.revisionId}
        createdAt={preview.createdAt}
        publishedAt={preview.publishedAt}
        isLive={preview.isLive}
        problems={preview.problems}
      />
      <RowPageView
        page={preview.page}
        document={preview.document}
        shortcuts={shortcuts}
        assets={assets}
        nav={nav}
        lists={lists}
        allowed={new Set(asked)}
        messages={messages}
        components={components}
      />
    </>
  );
}

export default withPageGate('/preview/[rev]', RevisionPreviewPage);
