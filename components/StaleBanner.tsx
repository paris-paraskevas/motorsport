export function StaleBanner({
  configured,
  stale,
}: {
  configured: boolean;
  stale: boolean;
}) {
  if (!configured) {
    return (
      <div className="text-text-faint text-xs mb-3">
        No live feed is configured for this series, so the schedule below is
        placeholder data.
      </div>
    );
  }
  if (stale) {
    return (
      <div className="text-amber-400 text-xs mb-3">
        Showing cached data — live feed unavailable.
      </div>
    );
  }
  return null;
}
