import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-guard';
import { loadAssetsById, loadRevisionPreview } from '@/lib/design/live-page';
import { loadShortcuts } from '@/lib/design/shortcuts';
import { loadDocumentLists, loadNavLists } from '@/lib/design/lists';
import { loadAuthzSchemes } from '@/lib/design/authz';
import { applyBuildOptions, applyConditions, conditionAsks, documentRefs, schemesAsked } from '@/lib/design/page-document';
import { loadNamedPages } from '@/lib/design/pages';
import { loadComponents } from '@/lib/design/definitions';
import { loadBuildOptions } from '@/lib/design/build-options';
import { loadAppearance } from '@/lib/design/appearance';
import { raceWeekendNow, renderComponents } from '@/lib/design/component-render';
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

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

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

  // A code page served from rows (R4.1) previews as the catch-all serves it: the
  // revision's document read the same way (a transitional body adopting the
  // recipe, an empty body the default composition), its components in the code
  // page's frame, with its family's structured data. A plain row page previews
  // as the catch-all's row branch renders it (RowPageView: the title, the Right
  // Side Column). The rule is the page's kind, as the resolver has it: pageFromRow
  // marks a row page served: 'rows' too (P1.13).
  const composed = preview.page.kind !== 'row';
  const stored = composed ? composedDocument(preview.document, preview.page.path) : preview.document;
  // The conditions apply as on the running site (P2.6): the administrator previewing is signed in, the race-weekend fact is
  // read when a condition asks, and a preview has no address, so a condition on the address shows its region (a fact not
  // known). Then an Excluded region leaves as it leaves the running site (APEX: Build Option, P1.3).
  const asks = conditionAsks(stored);
  const conditions = { signedIn: true, raceWeekend: asks.calendar ? await raceWeekendNow() : null, params: null, path: null };
  const document = applyBuildOptions(applyConditions(stored, conditions), await loadBuildOptions());
  const asked = schemesAsked(preview.page.authz, document);
  const refs = documentRefs(document, await loadComponents());
  // One read of the pages, shared with the renderer for the cards' zones (P2.2 B3); the render stays parallel with it.
  const namedPages = loadNamedPages(refs.dests);
  const [shortcuts, assets, nav, schemes, components, extras, appearance, pages] = await Promise.all([
    loadShortcuts(),
    loadAssetsById(refs.assets),
    loadNavLists(),
    asked.length > 0 ? loadAuthzSchemes() : Promise.resolve([]),
    // Every component the conditions kept draws in the preview too.
    renderComponents(document, { path: preview.page.path, params: {}, page: preview.page, pages: namedPages }),
    composed ? familyExtras(preview.page.path, {}) : Promise.resolve(null),
    // The templates' presets (P1.2), as the catch-all reads them.
    loadAppearance(),
    // The live row pages the buttons and go effects name (P1.12 B2), as the catch-all reads them.
    namedPages,
  ]);
  const messages: Record<string, string | null> = {};
  for (const key of asked) messages[key] = schemes.find(s => s.key === key)?.message ?? null;
  const lists = await loadDocumentLists(refs.lists, nav);
  const d = { page: preview.page, document, shortcuts, assets, nav, lists, allowed: new Set(asked), messages, components, templates: appearance.templates, pages };

  // The Developer Toolbar is the app layout's, drawn for the administrator on
  // every running page (R5); what it cannot know from the address, which
  // revision this is and in what state, stays as a line at the top.
  const state = preview.isLive ? 'the live revision' : preview.publishedAt ? 'published, superseded' : 'a draft';
  return (
    <>
      <p data-preview-note="" className="sticky top-0 z-30 m-0 flex flex-wrap gap-x-4 border-b border-text bg-text px-4 py-2 font-mono text-10 uppercase tracking-[0.14em] text-bg">
        <span className="font-semibold">Preview</span>
        <span>{preview.page.name}</span>
        <span>
          revision {preview.revisionId.slice(0, 8)} · {state} · saved {when(preview.createdAt)}
        </span>
        {preview.problems.length > 0 && <span className="text-brand">{preview.problems.length} problem{preview.problems.length === 1 ? '' : 's'} in the stored document</span>}
      </p>
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
