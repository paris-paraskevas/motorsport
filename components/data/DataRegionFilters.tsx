import { encodeViewState, stateEntries, viewStateHref, type ViewState } from '@/lib/design/view-state';

// The Filters region's chips (P2.5; APEX: Smart Filters, the chips above a report). A facet is a disclosure whose summary
// names it and what is picked; its values are links that toggle one value each through the address (one `in` filter for
// the column under the filtered region's own keys), so the page keeps its cache and the middleware serves the variant. A
// facet set to pick several is a GET form with checkboxes and Apply; a dependent facet stays closed until its parent carries a
// value; Reset is the region's plain address. Every text is escaped by React; the one raw markup is SCRIPT below, a constant.

export interface Facet {
  key: string;
  column: string;
  label: string;
  several: boolean;
  /** False while the facet's parent (Depending On) carries no value: the chip names the parent instead of its values. */
  open: boolean;
  parentLabel: string | null;
  /** The parent's column (Depending On): cleared with the parent, so no filter stays that the chips cannot reach. */
  parentColumn: string | null;
  /** The values the address carries for this column. */
  current: readonly string[];
  values: readonly { value: string; count: number }[];
  /** The values past the guardrail, counted, never listed. */
  more: number;
}

const LABEL = 'font-mono text-10 uppercase tracking-[0.14em] text-text-faint';
const LINK = 'underline-offset-4 hover:text-tint hover:underline';
const BUTTON = 'inline-flex min-h-9 items-center bg-text px-4 font-mono text-10 font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-tint';
const FIELD = 'border border-border bg-bg px-2 py-1 font-mono text-11 text-text';

/** The batch form and the search (P2.5), the one raw markup of the Data family, a constant with no data in it: a form set to
 *  pick several folds its ticks into one `in` filter on submit (without it the ticks reach the address as `pick`, which the
 *  vocabulary ignores, so nothing breaks); a facet's search narrows the list drawn, never the address. */
export const FILTERS_SCRIPT =
  "(function(){document.querySelectorAll('[data-filters]').forEach(function(root){if(root.getAttribute('data-bound'))return;root.setAttribute('data-bound','1');" +
  "root.querySelectorAll('form[data-facet]').forEach(function(form){form.addEventListener('submit',function(){" +
  "var picks=[].slice.call(form.querySelectorAll('input[name=pick]'));var vals=picks.filter(function(i){return i.checked}).map(function(i){return i.value});" +
  "picks.forEach(function(i){i.disabled=true});if(vals.length){var h=document.createElement('input');h.type='hidden';h.name=form.getAttribute('data-key');" +
  "h.value=form.getAttribute('data-facet')+'.in:'+vals.join(',');form.appendChild(h)}})});" +
  "root.querySelectorAll('input[data-facet-search]').forEach(function(inp){inp.addEventListener('input',function(){var q=inp.value.toLowerCase();var d=inp.closest('details');if(!d)return;" +
  "d.querySelectorAll('[data-facet-value]').forEach(function(el){el.hidden=q!==''&&el.getAttribute('data-facet-value').toLowerCase().indexOf(q)===-1})})})})})();";

export function DataRegionFilters({ href, prefix, others, state, facets }: { href: string; prefix: string; others: string; state: ViewState; facets: readonly Facet[] }) {
  // This region's state with one column's picks replaced (the values sorted, so one set of picks is one address). A facet
  // cleared clears the facets that depend on it, and theirs, so no filter stays that the chips cannot reach. A value with a
  // comma cannot ride an `in` list (the address splits on commas): it is picked alone, as `eq`.
  const stateFor = (column: string, values: readonly string[]): ViewState => {
    const cleared = new Set<string>();
    if (values.length === 0) {
      let frontier = [column];
      while (frontier.length > 0) {
        const next: string[] = [];
        for (const f of facets) {
          if (f.parentColumn === null || !frontier.includes(f.parentColumn) || cleared.has(f.column)) continue;
          cleared.add(f.column);
          next.push(f.column);
        }
        frontier = next;
      }
    }
    const rest = state.filters.filter(f => f.column !== column && !cleared.has(f.column));
    if (values.length === 0) return { ...state, filters: rest };
    const comma = values.find(v => v.includes(','));
    if (comma !== undefined) return { ...state, filters: [...rest, { column, op: 'eq', value: comma }] };
    return { ...state, filters: [...rest, { column, op: 'in', value: [...values].sort().join(',') }] };
  };
  const toggle = (f: Facet, value: string) => {
    const next = f.current.includes(value) ? f.current.filter(v => v !== value) : value.includes(',') ? [value] : [...f.current.filter(v => !v.includes(',')), value];
    return viewStateHref(href, stateFor(f.column, next), prefix, others);
  };
  const reset = viewStateHref(href, { ...state, filters: [] }, prefix, others);
  // The rest of the address as a form's hidden inputs: every other region's keys, and this region's but the facet's own column.
  const hidden = (f: Facet): [string, string][] => [...stateEntries(others, prefix), ...new URLSearchParams(encodeViewState(stateFor(f.column, []), prefix)).entries()];
  return (
    <div className="mb-3 flex flex-wrap items-start gap-3" data-filters>
      {facets.map(f => {
        const top = f.values[0];
        const summary = f.current.length > 0 ? `${f.label} · ${f.current.join(', ')}` : top ? `${f.label} · ${top.value} (${top.count})` : f.label;
        const max = Math.max(1, top?.count ?? 1);
        const count = (v: { value: string; count: number }) => (
          <>
            <span className="font-mono text-10 text-text-faint">{v.count}</span>
            <span className="block h-1 bg-tint/40" style={{ width: `${Math.round((v.count / max) * 100)}%` }} aria-hidden />
          </>
        );
        return (
          <details key={f.key} open={f.current.length > 0 || undefined} className="min-w-40 border border-border bg-surface">
            <summary className={`${LABEL} cursor-pointer select-none px-3 py-2 text-text-muted`}>{summary}</summary>
            {!f.open ? (
              <p className={`${LABEL} px-3 pb-3`}>Pick {f.parentLabel} first</p>
            ) : f.several ? (
              <form method="get" action={href} data-facet={f.column} data-key={`${prefix}filter`} className="flex flex-col gap-2 px-3 pb-3">
                {hidden(f).map(([k, v], i) => (
                  <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
                ))}
                <input type="search" data-facet-search aria-label={`Search ${f.label}`} placeholder="Search" className={FIELD} />
                <ul className="flex flex-col gap-1">
                  {f.values.map(v => (
                    <li key={v.value} data-facet-value={v.value}>
                      <label className="inline-flex items-center gap-1.5 font-mono text-11 text-text-muted">
                        <input type="checkbox" name="pick" value={v.value} defaultChecked={f.current.includes(v.value)} />
                        {v.value}
                      </label>
                      {count(v)}
                    </li>
                  ))}
                </ul>
                {f.more > 0 && <p className={LABEL}>and {f.more} more</p>}
                <div>
                  <button type="submit" className={BUTTON}>
                    Apply
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-2 px-3 pb-3">
                <input type="search" data-facet-search aria-label={`Search ${f.label}`} placeholder="Search" className={FIELD} />
                <ul className="flex flex-col gap-1">
                  {f.values.map(v => (
                    <li key={v.value} data-facet-value={v.value}>
                      <a href={toggle(f, v.value)} rel="nofollow" className={`font-mono text-11 text-text-muted ${LINK}`} aria-current={f.current.includes(v.value) ? 'true' : undefined}>
                        {v.value}
                      </a>{' '}
                      {count(v)}
                    </li>
                  ))}
                </ul>
                {f.more > 0 && <p className={LABEL}>and {f.more} more</p>}
              </div>
            )}
          </details>
        );
      })}
      {state.filters.length > 0 && (
        <a href={reset} rel="nofollow" className={`${LABEL} ${LINK} self-center text-text-muted`}>
          Reset
        </a>
      )}
      {/* The constant script above: raw markup by design, no data in it (rule 4's labelled exception). */}
      <script dangerouslySetInnerHTML={{ __html: FILTERS_SCRIPT }} />
    </div>
  );
}
