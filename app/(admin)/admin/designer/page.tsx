import type { Metadata } from 'next';
import { currentUser } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/admin-guard';
import { isProductionWorker } from '@/lib/env';
import { NAV_LIST_KEYS, loadListForEditing, type EditableList, type NavListKey } from '@/lib/design/lists';
import { loadTextForEditing } from '@/lib/design/text';
import { loadBuildOptionsForEditing } from '@/lib/design/build-options';
import { loadSettingsForEditing } from '@/lib/design/settings';
import { loadAuthzForEditing } from '@/lib/design/authz';
import { loadAllSeriesMeta } from '@/lib/series';
import { DesignerLoader } from '@/components/designer/DesignerLoader';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Designer · Admin' };

// Paddock Developer, the designer (Phase 2 of the designer plan). The page is a
// thin server shell: the admin gate, the facts the browser cannot learn on its
// own (whether this Worker is production, PADDOCK_ENV in lib/env.ts, who is
// signed in, which championships exist), and the four lists, the text messages,
// the build options and the settings loaded once so the designer opens with
// them. The editor itself is a browser-only chunk (DesignerLoader). `?sc=<key>`
// opens a catalogue entry directly.
export default async function DesignerPage({ searchParams }: { searchParams: Promise<{ sc?: string }> }) {
  await requireAdmin();
  const [user, params, initialText, initialBuildOptions, initialSettings, initialAuthz, seriesMeta, ...loaded] =
    await Promise.all([
      currentUser(),
      searchParams,
      loadTextForEditing(),
      loadBuildOptionsForEditing(),
      loadSettingsForEditing(),
      loadAuthzForEditing(),
      loadAllSeriesMeta(),
      ...NAV_LIST_KEYS.map(key => loadListForEditing(key)),
    ]);
  const initialLists: Partial<Record<NavListKey, EditableList>> = {};
  NAV_LIST_KEYS.forEach((key, i) => {
    const list = loaded[i];
    if (list) initialLists[key] = list;
  });
  const production = isProductionWorker();
  const name = user?.firstName ?? user?.username ?? 'Administrator';
  return (
    <DesignerLoader
      readOnly={!production}
      who={`${name} · Administrator · ${production ? 'production' : 'preview'}`}
      initialSelected={typeof params.sc === 'string' ? params.sc : null}
      initialLists={initialLists}
      initialText={initialText}
      initialBuildOptions={initialBuildOptions}
      initialSettings={initialSettings}
      initialAuthz={initialAuthz}
      series={seriesMeta.map(m => ({ slug: m.slug, name: m.name }))}
    />
  );
}
