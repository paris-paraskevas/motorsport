'use client';

import { COLUMNS, POSITIONS, POSITION_LABELS, REGION_KIND_LABELS, rowsAt, type PageDocument, type Region } from '@/lib/design/page-document';

// The Layout schematic (APEX: the Layout tab as a schematic of positions, the
// approved design of 2026-09-07): six positions top to bottom, each a strip of
// twelve columns, with a region a tile at its column and span. It draws what a
// document says and nothing more; it never renders the page. Step 2a shows a
// stored document read-only; step 2b adds the controls around it.

export function LayoutSchematic({
  document,
  selected = null,
  onSelect,
}: {
  document: PageDocument;
  selected?: string | null;
  onSelect?: (regionId: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[120px_minmax(0,1fr)] items-end gap-3 px-1">
        <span />
        <div className="grid grid-cols-12 gap-px font-mono text-9 text-text-faint">
          {Array.from({ length: COLUMNS }, (_, i) => (
            <span key={i} className="text-center">
              {i + 1}
            </span>
          ))}
        </div>
      </div>
      {POSITIONS.map(position => {
        const rows = rowsAt(document, position);
        return (
          <div key={position} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border border-border-strong bg-surface p-2">
            <div className="text-11">
              <span className="block font-semibold text-text">{POSITION_LABELS[position].label}</span>
              <span className="block text-text-faint">{POSITION_LABELS[position].holds}</span>
            </div>
            <div className="grid gap-1.5">
              {rows.length === 0 && (
                <div className="grid grid-cols-12 gap-px">
                  {Array.from({ length: COLUMNS }, (_, i) => (
                    <span key={i} className="h-8 border border-dashed border-border" />
                  ))}
                </div>
              )}
              {rows.map((row, ri) => (
                <div key={ri} className="relative grid grid-cols-12 gap-px">
                  {Array.from({ length: COLUMNS }, (_, i) => (
                    <span key={i} className="h-14 border border-dashed border-border" style={{ gridColumn: `${i + 1} / span 1`, gridRow: 1 }} />
                  ))}
                  {row.map(r => (
                    <RegionTile key={r.id} region={r} selected={selected === r.id} onSelect={onSelect} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RegionTile({ region, selected, onSelect }: { region: Region; selected: boolean; onSelect?: (id: string) => void }) {
  const kind = REGION_KIND_LABELS[region.kind].label;
  const detail =
    region.kind === 'static'
      ? region.text.trim().replace(/\s+/g, ' ').slice(0, 60) || 'empty text'
      : region.kind === 'image'
        ? `photo ${region.assetId.slice(0, 8)}`
        : `list ${region.listKey} · ${region.style}`;
  const body = (
    <>
      <span className="block truncate font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
        {kind}
        {region.authz ? ` · ${region.authz}` : ''}
      </span>
      <span className="block truncate text-12 font-semibold text-text">{region.title || region.id}</span>
      <span className="block truncate text-11 text-text-muted">{detail}</span>
    </>
  );
  const className = `h-14 overflow-hidden border px-2 py-1 text-left ${
    selected ? 'border-edit bg-edit-dim' : 'border-border-strong bg-surface-elevated'
  }`;
  const style = { gridColumn: `${region.column} / span ${region.span}`, gridRow: 1 };
  return onSelect ? (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => onSelect(region.id)}
      aria-pressed={selected}
      aria-label={`${kind}: ${region.title || region.id}`}
    >
      {body}
    </button>
  ) : (
    <div className={className} style={style}>
      {body}
    </div>
  );
}
