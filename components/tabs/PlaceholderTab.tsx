export function PlaceholderTab({ tabLabel }: { tabLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-12 h-px bg-border-strong mb-6" />
      <div className="text-xs uppercase tracking-[0.18em] text-text-faint font-semibold mb-3">
        {tabLabel}
      </div>
      {/* NOT "Coming soon." This is the empty state for seven real tabs
          (Standings, Results, Champions, Rounds, About, History and the series
          landing) whenever their source has nothing for this series yet. The
          feature is not coming — it is here, and the data is not. Promising a
          launch that already happened reads as abandonment, and it was one of
          the strings the low-value-content audit picked out. */}
      <div className="text-text-muted text-base max-w-xs">
        Nothing here yet for this series.
      </div>
    </div>
  );
}
