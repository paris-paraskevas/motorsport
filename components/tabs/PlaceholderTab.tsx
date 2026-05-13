export function PlaceholderTab({ tabLabel }: { tabLabel: string }) {
  return (
    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-8 text-center">
      <div className="text-zinc-300 text-base font-medium mb-1">{tabLabel}</div>
      <div className="text-zinc-500 text-sm">Coming in a later phase.</div>
    </div>
  );
}
