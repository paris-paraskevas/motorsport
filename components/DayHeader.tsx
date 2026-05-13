export function DayHeader({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-baseline justify-between pt-4 pb-2">
      <span className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-semibold">
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
          {count} {count === 1 ? 'session' : 'sessions'}
        </span>
      )}
    </div>
  );
}
