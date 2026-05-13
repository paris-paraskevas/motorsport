export function StaleBanner({
  configured,
  stale,
}: {
  configured: boolean;
  stale: boolean;
}) {
  if (!configured) {
    return (
      <div className="text-zinc-500 text-xs mb-3">
        No feed configured — placeholder data only.
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
