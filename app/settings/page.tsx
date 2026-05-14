import { loadAllSeriesMeta } from '@/lib/series';
import { SettingsClient } from '@/components/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const seriesList = await loadAllSeriesMeta();

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-semibold mb-2">
          Preferences
        </div>
        <h1 className="text-zinc-50 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          Settings
        </h1>
      </header>
      <SettingsClient seriesList={seriesList} />
    </div>
  );
}
