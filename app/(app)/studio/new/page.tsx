import type { Metadata } from 'next';
import { loadAllSeriesMeta } from '@/lib/series';
import { StudioComposer } from '@/components/studio/StudioComposer';

export const metadata: Metadata = { title: 'New post' };

export default async function NewPostPage() {
  const metas = await loadAllSeriesMeta();
  return (
    <>
      <header className="mb-8">
        <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint">
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
