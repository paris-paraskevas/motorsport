export function PlaceholderTab({ tabLabel }: { tabLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-12 h-px bg-zinc-700 mb-6" />
      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500 font-semibold mb-3">
        {tabLabel}
      </div>
      <div className="text-zinc-400 text-base max-w-xs">
        Coming soon.
      </div>
    </div>
  );
}
