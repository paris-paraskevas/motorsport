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
const SCRIPT =
  "(function(){var s=document.currentScript,root=s&&s.parentElement;if(!root)return;" +
  "root.querySelectorAll('form[data-facet]').forEach(function(form){form.addEventListener('submit',function(){" +
  "var picks=[].slice.call(form.querySelectorAll('input[name=pick]'));var vals=picks.filter(function(i){return i.checked}).map(function(i){return i.value});" +
  "picks.forEach(function(i){i.disabled=true});if(vals.length){var h=document.createElement('input');h.type='hidden';h.name=form.getAttribute('data-key');" +
  "h.value=form.getAttribute('data-facet')+'.in:'+vals.join(',');form.appendChild(h)}})});" +
  "root.querySelectorAll('input[data-facet-search]').forEach(function(inp){inp.addEventListener('input',function(){var q=inp.value.toLowerCase();var d=inp.closest('details');if(!d)return;" +
  "d.querySelectorAll('[data-facet-value]').forEach(function(el){el.hidden=q!==''&&el.getAttribute('data-facet-value').toLowerCase().indexOf(q)===-1})})})})();";

export function DataRegionFilters({ href, prefix, others, state, facets }: { href: string; prefix: string; others: string; state: ViewState; facets: readonly Facet[] }) {
  // This region's state with one column's picks replaced (the values sorted, so one set of picks is one address).
  const stateFor = (column: string, values: readonly string[]): ViewState => {
    const rest = state.filters.filter(f => f.column !== column);
    return { ...state, filters: values.length > 0 ? [...rest, { column, op: 'in', value: [...values].sort().join(',') }] : rest };
  };
  const toggle = (f: Facet, value: string) => viewStateHref(href, stateFor(f.column, f.current.includes(value) ? f.current.filter(v => v !== value) : [...f.current, value]), prefix, others);
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
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </div>
  );
}
