export function DayHeader({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-baseline gap-2 pt-5 pb-1">
      <span className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
        {label}
      </span>
      {count !== undefined && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint tnum">
          {count}
        </span>
      )}
    </div>
  );
}
