import type { PresetColumn, Shape } from '@/lib/design/presets';
import { encodeViewState, sortHref, sortable, stateEntries, viewStateHref, type ViewState } from '@/lib/design/view-state';
import type { RegionControls } from './DataRegionViews';

// The Interactive Report's Actions menu (P2.3; APEX: the menu above the report with Select Columns, Sort, Reset and the
// rest). APEX's is a JavaScript menu; ours is a disclosure, a GET form and plain links, so a page keeps its cache and ships
// no client script for it: the address carries the state (lib/design/view-state.ts), the middleware serves the variant. The
// Table gets Select Columns and Reset; the Cards, whose columns are slots, get Sort by and Reset; Download CSV joins when the
// region has it on (PR B), and the Views menu stands beside Actions with the saved views.

const LABEL = 'font-mono text-10 uppercase tracking-[0.14em] text-text-faint';
const LINK = 'underline-offset-4 hover:text-tint hover:underline';
const BUTTON = 'inline-flex min-h-9 items-center bg-text px-4 font-mono text-10 font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted';

/** The rest of the address's state as hidden inputs: every other region's keys, and this region's but the one the form sets. */
function Hidden({ controls, except }: { controls: RegionControls; except: 'cols' }) {
  const own: ViewState = { ...controls.state };
  delete own[except];
  const entries = [...stateEntries(controls.others, controls.key), ...new URLSearchParams(encodeViewState(own, controls.key)).entries()];
  return (
    <>
      {entries.map(([k, v], i) => (
        <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

/** The Views menu (P2.3 PR B; APEX: the saved reports' select list): Primary, the region as designed, then the Alternatives
 *  the designer saved, each a link carrying `view=<key>` alone for this region (the other regions' states ride along); the
 *  one the address names is marked. */
function ViewsMenu({ controls }: { controls: RegionControls }) {
  if (!controls.views) return null;
  const to = (key: string | null) => viewStateHref(controls.href, key === null ? { filters: [] } : { filters: [], view: key }, controls.key, controls.others);
  const item = (key: string | null, name: string) => (
    <a key={key ?? ''} href={to(key)} rel="nofollow" className={`${LABEL} ${LINK} text-text-muted`} aria-current={controls.views!.current === key ? 'true' : undefined}>
      {name}
      {controls.views!.current === key ? ' ●' : ''}
    </a>
  );
  return (
    <details>
      <summary className={`${LABEL} cursor-pointer select-none text-text-muted`}>Views</summary>
      <div className="mt-2 flex flex-col gap-2 border border-border bg-surface p-3">
        {item(null, 'Primary')}
        {controls.views.list.map(v => item(v.key, v.name))}
      </div>
    </details>
  );
}

export function DataRegionControls(props: { controls: RegionControls; shape: Shape; shown: readonly PresetColumn[]; nameLabel: string; sortLinks: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-start gap-4">
      {props.controls.actions && <ActionsMenu {...props} />}
      <ViewsMenu controls={props.controls} />
    </div>
  );
}

function ActionsMenu({ controls, shape, shown, nameLabel, sortLinks }: { controls: RegionControls; shape: Shape; shown: readonly PresetColumn[]; nameLabel: string; sortLinks: boolean }) {
  const labelOf = (c: PresetColumn) => (c.key === 'name' ? nameLabel : c.label);
  const current = controls.state.sort;
  return (
    <details>
      <summary className={`${LABEL} cursor-pointer select-none text-text-muted`}>Actions</summary>
      <div className="mt-2 flex flex-col gap-3 border border-border bg-surface p-3">
        {sortLinks ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={LABEL}>Sort by</span>
            {shape.columns.filter(sortable).map(c => (
              <a key={c.key} href={sortHref(controls.href, controls.state, c.key, controls.key, controls.others)} rel="nofollow" className={`${LABEL} ${LINK} text-text-muted`} aria-current={current?.column === c.key ? 'true' : undefined}>
                {labelOf(c)}
                {current?.column === c.key ? (current.desc ? ' ▼' : ' ▲') : ''}
              </a>
            ))}
          </div>
        ) : (
          <form method="get" action={controls.href} className="flex flex-col gap-2">
            <Hidden controls={controls} except="cols" />
            <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
              <legend className={`${LABEL} mb-1`}>Select Columns</legend>
              {shape.columns
                .filter(c => c.type !== 'image')
                .map(c => (
                  <label key={c.key} className="inline-flex items-center gap-1.5 font-mono text-11 text-text-muted">
                    <input type="checkbox" name={`${controls.key}cols`} value={c.key} defaultChecked={controls.state.cols ? controls.state.cols.includes(c.key) : shown.some(x => x.key === c.key)} className="h-3.5 w-3.5 accent-text" />
                    {labelOf(c)}
                  </label>
                ))}
            </fieldset>
            <div>
              <button type="submit" className={BUTTON}>
                Apply
              </button>
            </div>
          </form>
        )}
        {controls.download && (
          <a href={controls.download} rel="nofollow" className={`${LABEL} ${LINK} self-start text-text-muted`}>
            Download CSV
          </a>
        )}
        <a href={controls.href} rel="nofollow" className={`${LABEL} ${LINK} self-start text-text-muted`}>
          Reset
        </a>
      </div>
    </details>
  );
}
