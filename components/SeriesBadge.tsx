export function SeriesBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center text-[11px] uppercase tracking-[0.14em] font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: `${color}26`, color }}
    >
      {name}
    </span>
  );
}
