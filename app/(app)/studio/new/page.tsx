import type { Metadata } from 'next';
import { loadAllSeriesMeta } from '@/lib/series';
import { StudioComposer } from '@/components/studio/StudioComposer';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';

const BASE_METADATA: Metadata = { title: 'New post' };
export const generateMetadata = pageMetadata('/studio/new', BASE_METADATA);

async function NewPostPage() {
  const metas = await loadAllSeriesMeta();
  return (
    <>
      <header className="mb-8">
        <div className="mb-2 font-mono text-11 font-semibold uppercase tracking-[0.18em] text-text-faint">
          Studio
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-text">New post</h1>
        <p className="mt-3 text-sm text-text-muted">
          Saves as a private draft. Nothing goes anywhere until it is submitted and approved.
        </p>
      </header>
      <StudioComposer series={metas.map(m => ({ slug: m.slug, name: m.name }))} />
    </>
  );
}

export default withPageGate('/studio/new', NewPostPage);
