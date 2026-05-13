export function DayHeader({ label }: { label: string }) {
  return (
    <div className="text-xs uppercase tracking-wider text-zinc-500 pt-3 pb-1 border-t border-zinc-900">
      {label}
    </div>
  );
}
