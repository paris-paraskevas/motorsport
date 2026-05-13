export function DayHeader({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-3 pt-5 pb-2">
      <span className="text-xs uppercase tracking-[0.18em] text-zinc-300 font-semibold">
        {label}
      </span>
      <span className="flex-1 h-px bg-zinc-800/80" />
      {count !== undefined && (
        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 font-medium tnum">
          {count} {count === 1 ? 'session' : 'sessions'}
        </span>
      )}
    </div>
  );
}
