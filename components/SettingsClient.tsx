'use client';
import { useAuth } from '@clerk/nextjs';
import type { SeriesMeta } from '@/lib/types';
import { useFollowedSeries } from '@/lib/useFollowedSeries';
import { groupSeriesByCategory } from '@/lib/categories';
import { NotifPrefsSection } from './NotifPrefsSection';

export function SettingsClient({ seriesList }: { seriesList: SeriesMeta[] }) {
  const { isSignedIn } = useAuth();
  const { followed, hydrated, setFollowed } = useFollowedSeries();

  if (!hydrated) {
    return <div className="text-zinc-500 text-sm">Loading preferences…</div>;
  }

  // Default when nothing stored yet: treat as "follow everything" for UI selection.
  const effectiveFollowed = followed ?? seriesList.map(s => s.slug);

  const isFollowing = (slug: string) => effectiveFollowed.includes(slug);

  const toggle = (slug: string) => {
    const next = isFollowing(slug)
      ? effectiveFollowed.filter(s => s !== slug)
      : [...effectiveFollowed, slug];
    setFollowed(next);
  };

  const followAll = () => setFollowed(seriesList.map(s => s.slug));
  const unfollowAll = () => setFollowed([]);
  const resetToDefault = () => setFollowed(seriesList.map(s => s.slug));

  const grouped = groupSeriesByCategory(seriesList);
  const followedCount = effectiveFollowed.length;
  const totalCount = seriesList.length;

  return (
    <div>
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-5 md:p-6 mb-6">
        <div className="flex items-baseline justify-between mb-1">
          <div>
            <h2 className="text-zinc-50 text-base font-semibold">Followed championships</h2>
            <p className="text-zinc-500 text-xs mt-1">
              Home and Calendar only show sessions for series you follow.
              {isSignedIn
                ? ' Saved to your account — synced across devices.'
                : ' Stored on this device.'}
            </p>
          </div>
          <div className="text-xs text-zinc-400 font-medium tabular-nums whitespace-nowrap">
            {followedCount} / {totalCount}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={followAll}
            className="text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 transition-colors"
          >
            Follow all
          </button>
          <button
            type="button"
            onClick={unfollowAll}
            className="text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 transition-colors"
          >
            Unfollow all
          </button>
          <button
            type="button"
            onClick={resetToDefault}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-300 rounded-full px-3 py-1.5 transition-colors"
          >
            Reset to default
          </button>
        </div>
      </div>

      {isSignedIn && <NotifPrefsSection />}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('paddock:reopen-consent'))}
          className="text-xs font-medium text-zinc-400 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 transition-colors"
        >
          Cookie preferences
        </button>
      </div>

      <div className="space-y-6">
        {grouped.map(group => (
          <section key={group.category.id}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-semibold mb-2 px-1">
              {group.category.label}
            </div>
            <div className="rounded-2xl bg-zinc-900/30 border border-zinc-800/60 overflow-hidden">
              {group.series.map((s, i) => (
                <label
                  key={s.slug}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-900/60 transition-colors ${
                    i > 0 ? 'border-t border-zinc-800/50' : ''
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="flex-1 text-zinc-100 text-sm font-medium">
                    {s.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={isFollowing(s.slug)}
                    onChange={() => toggle(s.slug)}
                    className="w-5 h-5 rounded accent-zinc-300 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
