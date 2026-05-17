export function DayHeader({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-3 pt-5 pb-2">
      <span className="text-xs uppercase tracking-[0.18em] text-text-muted font-semibold">
        {label}
      </span>
      <span className="flex-1 h-px bg-border" />
      {count !== undefined && (
        <span className="text-[10px] uppercase tracking-[0.14em] text-text-faint font-medium tnum font-mono">
          {count} {count === 1 ? 'session' : 'sessions'}
        </span>
      )}
    </div>
  );
}
