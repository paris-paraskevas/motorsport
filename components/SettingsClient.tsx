'use client';

import { useAuth } from '@clerk/nextjs';
import type { SeriesMeta } from '@/lib/types';
import { useFollowedSeries } from '@/lib/useFollowedSeries';

// One row per series: colour dot + name + a follow checkbox. The checkbox is
// checked inside the "Followed" accordion and unchecked inside "Not followed";
// toggling re-buckets the series on the next render.
function SeriesList({
  series,
  isFollowing,
  toggle,
  emptyLabel,
}: {
  series: SeriesMeta[];
  isFollowing: (slug: string) => boolean;
  toggle: (slug: string) => void;
  emptyLabel: string;
}) {
  if (series.length === 0) {
    return <p className="text-text-faint text-sm px-1 py-2">{emptyLabel}</p>;
  }
  return (
    <div className="border-t border-border">
      {series.map((s, i) => (
        <label
          key={s.slug}
          className={`flex items-center gap-3 px-1 py-3 cursor-pointer hover:bg-surface transition-colors ${
            i > 0 ? 'border-t border-border' : ''
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
          <span className="flex-1 text-text text-sm font-medium">{s.name}</span>
          <input
            type="checkbox"
            checked={isFollowing(s.slug)}
            onChange={() => toggle(s.slug)}
            className="w-5 h-5 rounded accent-brand cursor-pointer"
          />
        </label>
      ))}
    </div>
  );
}

export function SettingsClient({ seriesList }: { seriesList: SeriesMeta[] }) {
  const { isSignedIn } = useAuth();
  const { followed, hydrated, setFollowed } = useFollowedSeries();

  if (!hydrated) {
    return <div className="text-text-faint text-sm">Loading preferences…</div>;
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

  const followedSeries = seriesList.filter(s => isFollowing(s.slug));
  const notFollowedSeries = seriesList.filter(s => !isFollowing(s.slug));
  const followedCount = followedSeries.length;
  const totalCount = seriesList.length;

  return (
    <div>
      <div className="border-t border-border py-5 md:py-6">
        <div className="flex items-baseline justify-between mb-1">
          <div>
            <h2 className="text-text text-base font-semibold">Followed championships</h2>
            <p className="text-text-faint text-xs mt-1">
              Home and Calendar only show sessions for series you follow.
              {isSignedIn
                ? ' Saved to your account — synced across devices.'
                : ' Stored on this device.'}
            </p>
          </div>
          <div className="text-xs text-text-muted font-medium tabular-nums whitespace-nowrap">
            {followedCount} / {totalCount}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={followAll}
            className="text-xs font-medium font-mono text-text-muted hover:text-text border border-border hover:border-border-strong px-3 py-1.5 transition-colors"
          >
            Follow all
          </button>
          <button
            type="button"
            onClick={unfollowAll}
            className="text-xs font-medium font-mono text-text-muted hover:text-text border border-border hover:border-border-strong px-3 py-1.5 transition-colors"
          >
            Unfollow all
          </button>
          <button
            type="button"
            onClick={resetToDefault}
            className="text-xs font-medium font-mono text-text-faint hover:text-text-muted px-3 py-1.5 transition-colors"
          >
            Reset to default
          </button>
        </div>
      </div>

      <div className="border-t border-border py-5">
        <h2 className="mb-1 text-text text-base font-semibold">
          Followed <span className="font-normal text-text-faint">({followedCount})</span>
        </h2>
        <SeriesList
          series={followedSeries}
          isFollowing={isFollowing}
          toggle={toggle}
          emptyLabel="You're not following any series yet — add some below."
        />
      </div>

      <div className="border-t border-border py-5">
        <h2 className="mb-1 text-text text-base font-semibold">
          Not followed <span className="font-normal text-text-faint">({notFollowedSeries.length})</span>
        </h2>
        <SeriesList
          series={notFollowedSeries}
          isFollowing={isFollowing}
          toggle={toggle}
          emptyLabel="You're following every series."
        />
      </div>
    </div>
  );
}
