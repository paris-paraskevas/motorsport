import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-guard';
import { loadAssetsById, loadRevisionPreview } from '@/lib/design/live-page';
import { loadShortcuts } from '@/lib/design/shortcuts';
import { loadDocumentLists, loadNavLists } from '@/lib/design/lists';
import { loadAuthzSchemes } from '@/lib/design/authz';
import { applyBuildOptions, documentRefs, schemesAsked } from '@/lib/design/page-document';
import { loadBuildOptions } from '@/lib/design/build-options';
import { renderComponents } from '@/lib/design/component-render';
import { CodePageFrame, RowPageView } from '@/components/page/RowPageView';
import { familyExtras } from '@/lib/design/page-families';
import { composedDocument } from '@/lib/design/composed-page';
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

  // A page served from rows (R4.1) previews as the catch-all serves it: the
  // revision's document read the same way (a transitional body adopting the
  // recipe, an empty body the default composition), its components in the code
  // page's frame, with its family's structured data.
  const composed = preview.page.served === 'rows';
  const stored = composed ? composedDocument(preview.document, preview.page.path) : preview.document;
  // An Excluded region leaves the preview as it leaves the running site (APEX: Build Option, P1.3); the show rules are not applied here.
  const document = applyBuildOptions(stored, await loadBuildOptions());
  const asked = schemesAsked(preview.page.authz, document);
  const refs = documentRefs(document);
  const [shortcuts, assets, nav, schemes, components, extras] = await Promise.all([
    loadShortcuts(),
    loadAssetsById(refs.assets),
    loadNavLists(),
    asked.length > 0 ? loadAuthzSchemes() : Promise.resolve([]),
    // Every component draws in the preview too; the show rules are not applied here.
    renderComponents(document, { path: preview.page.path, params: {}, page: preview.page }),
    composed ? familyExtras(preview.page.path, {}) : Promise.resolve(null),
  ]);
  const messages: Record<string, string | null> = {};
  for (const key of asked) messages[key] = schemes.find(s => s.key === key)?.message ?? null;
  const lists = await loadDocumentLists(refs.lists, nav);
  const d = { page: preview.page, document, shortcuts, assets, nav, lists, allowed: new Set(asked), messages, components };

  // The Developer Toolbar is the app layout's, drawn for the administrator on every running page (R5).
  return (
    <>
      {composed ? (
        <>
          {extras}
          <CodePageFrame d={d} />
        </>
      ) : (
        <RowPageView {...d} />
      )}
    </>
  );
}

export default withPageGate('/preview/[rev]', RevisionPreviewPage);
