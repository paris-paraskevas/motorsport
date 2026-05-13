export function StaleBanner({ configured }: { configured: boolean }) {
  if (configured) {
    return (
      <div className="text-amber-400 text-xs mb-3">
        Showing cached data — live feed unavailable.
      </div>
    );
  }
  return (
    <div className="text-zinc-500 text-xs mb-3">
      No feed configured — placeholder data only.
    </div>
  );
}
