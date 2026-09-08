'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  ACTION_NAME_MAX,
  EFFECTS_MAX,
  EFFECT_ACTIONS,
  EFFECT_LABELS,
  TIMER_MAX_SECONDS,
  TIMER_MIN_SECONDS,
  TRIGGER_EVENTS,
  TRIGGER_LABELS,
  type DynamicAction,
  type Effect,
  type EffectAction,
  type Region,
  type Trigger,
  type TriggerEvent,
} from '@/lib/design/page-document';
import { DESTINATIONS } from '@/lib/design/destinations';

// The Dynamic Actions pane (APEX: the Dynamic Actions tab, Phase 3 step 5):
// behaviour for a row page without code. Each action has a name, a When (a
// click on a region, the page loading, a timer, a region scrolling into view)
// and one or more effects (show, hide or toggle a region, scroll to one, go to
// a destination from the catalogue). Every select offers only this page's
// regions and the catalogue's destinations, so nothing typed is code; the
// document parser names what is still missing and holds Save.

const PBTN =
  'inline-flex items-center gap-1 border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';
const LABEL = 'grid gap-1 text-11 text-text-muted';

const GO_OPTIONS = Object.entries(DESTINATIONS)
  .filter(([, d]) => d.kind !== 'action')
  .map(([key, d]) => ({ key, label: d.label }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** A fresh action id: action-1, action-2. */
export function nextActionId(taken: readonly string[]): string {
  let n = 1;
  while (taken.includes(`action-${n}`)) n++;
  return `action-${n}`;
}

function triggerFor(event: TriggerEvent, regions: readonly Region[], previous?: Trigger): Trigger {
  const firstRegion = regions[0]?.id ?? '';
  const region = previous && 'region' in previous ? previous.region : firstRegion;
  if (event === 'click' || event === 'visible') return { event, region };
  if (event === 'timer') return { event, seconds: 60 };
  return { event };
}

function effectFor(action: EffectAction, regions: readonly Region[], previous?: Effect): Effect {
  if (action === 'go') return { action, dest: previous && previous.action === 'go' ? previous.dest : (GO_OPTIONS[0]?.key ?? 'home') };
  const region = previous && previous.action !== 'go' ? previous.region : (regions[0]?.id ?? '');
  return { action, region };
}

export function DynamicActionsEditor({
  actions,
  regions,
  readOnly,
  onChange,
}: {
  actions: DynamicAction[];
  regions: Region[];
  readOnly: boolean;
  onChange: (actions: DynamicAction[]) => void;
}) {
  const patch = (id: string, fn: (a: DynamicAction) => DynamicAction) => onChange(actions.map(a => (a.id === id ? fn(a) : a)));
  const add = () => {
    const id = nextActionId(actions.map(a => a.id));
    onChange([...actions, { id, name: '', when: triggerFor('click', regions), do: [effectFor('toggle', regions)] }]);
  };
  const regionOptions = regions.map(r => ({ key: r.id, label: `${r.title || r.id} (${r.id})` }));

  return (
    <section className="mt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-13 font-bold text-text">Dynamic Actions</h3>
        {!readOnly && (
          <button type="button" className={PBTN} disabled={regions.length === 0} onClick={add} title={regions.length === 0 ? 'Add a region first' : undefined}>
            <Plus size={10} /> Add a dynamic action
          </button>
        )}
      </div>
      <p className="m-0 mb-3 max-w-[76ch] text-12 text-text-muted">
        Behaviour without code: when something happens on the page, one or more effects run in the visitor’s browser.
        Regions and destinations are chosen from lists; nothing here is typed as code. A region marked “hidden at first”
        stays out of sight until an action shows it.
      </p>
      {actions.length === 0 ? (
        <p className="border border-dashed border-border px-3 py-3 text-12 text-text-faint">None yet.</p>
      ) : (
        <div className="grid gap-3">
          {actions.map(a => (
            <div key={a.id} className="grid gap-3 border border-border-strong bg-surface p-3">
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label className={LABEL}>
                  Name
                  <input
                    type="text"
                    value={a.name}
                    maxLength={ACTION_NAME_MAX}
                    disabled={readOnly}
                    placeholder={a.id}
                    aria-label={`Name of ${a.id}`}
                    className={FIELD}
                    onChange={e => patch(a.id, x => ({ ...x, name: e.target.value }))}
                  />
                </label>
                {!readOnly && (
                  <button type="button" className={`${PBTN} text-negative`} onClick={() => onChange(actions.filter(x => x.id !== a.id))} aria-label={`Remove ${a.id}`}>
                    <Trash2 size={10} /> Remove
                  </button>
                )}
              </div>

              <fieldset className="m-0 grid gap-2 border-0 p-0 md:grid-cols-2">
                <legend className="mb-1 text-11 font-semibold text-text">When</legend>
                <label className={LABEL}>
                  Event
                  <select
                    value={a.when.event}
                    disabled={readOnly}
                    aria-label={`When of ${a.id}`}
                    className={FIELD}
                    onChange={e => patch(a.id, x => ({ ...x, when: triggerFor(e.target.value as TriggerEvent, regions, x.when) }))}
                  >
                    {TRIGGER_EVENTS.map(ev => (
                      <option key={ev} value={ev}>
                        {TRIGGER_LABELS[ev]}
                      </option>
                    ))}
                  </select>
                </label>
                {(a.when.event === 'click' || a.when.event === 'visible') && (
                  <label className={LABEL}>
                    Region
                    <select
                      value={a.when.region}
                      disabled={readOnly}
                      aria-label={`Trigger region of ${a.id}`}
                      className={FIELD}
                      onChange={e => patch(a.id, x => ({ ...x, when: { event: x.when.event as 'click' | 'visible', region: e.target.value } }))}
                    >
                      {regionOptions.map(o => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {a.when.event === 'timer' && (
                  <label className={LABEL}>
                    Every, in seconds ({TIMER_MIN_SECONDS} to {TIMER_MAX_SECONDS})
                    <input
                      type="number"
                      min={TIMER_MIN_SECONDS}
                      max={TIMER_MAX_SECONDS}
                      value={a.when.seconds}
                      disabled={readOnly}
                      aria-label={`Timer of ${a.id}`}
                      className={FIELD}
                      onChange={e => patch(a.id, x => ({ ...x, when: { event: 'timer', seconds: Math.round(Number(e.target.value)) || 0 } }))}
                    />
                  </label>
                )}
              </fieldset>

              <fieldset className="m-0 grid gap-2 border-0 p-0">
                <legend className="mb-1 text-11 font-semibold text-text">Do</legend>
                {a.do.map((e, i) => (
                  <div key={i} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                    <label className={LABEL}>
                      Effect {i + 1}
                      <select
                        value={e.action}
                        disabled={readOnly}
                        aria-label={`Effect ${i + 1} of ${a.id}`}
                        className={FIELD}
                        onChange={ev => patch(a.id, x => ({ ...x, do: x.do.map((d, j) => (j === i ? effectFor(ev.target.value as EffectAction, regions, d) : d)) }))}
                      >
                        {EFFECT_ACTIONS.map(act => (
                          <option key={act} value={act}>
                            {EFFECT_LABELS[act]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {e.action === 'go' ? (
                      <label className={LABEL}>
                        Destination
                        <select
                          value={e.dest}
                          disabled={readOnly}
                          aria-label={`Destination of effect ${i + 1} of ${a.id}`}
                          className={FIELD}
                          onChange={ev => patch(a.id, x => ({ ...x, do: x.do.map((d, j) => (j === i ? { action: 'go', dest: ev.target.value } : d)) }))}
                        >
                          {GO_OPTIONS.map(o => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className={LABEL}>
                        Region
                        <select
                          value={e.region}
                          disabled={readOnly}
                          aria-label={`Region of effect ${i + 1} of ${a.id}`}
                          className={FIELD}
                          onChange={ev =>
                            patch(a.id, x => ({
                              ...x,
                              do: x.do.map((d, j) => (j === i && d.action !== 'go' ? { action: d.action, region: ev.target.value } : d)),
                            }))
                          }
                        >
                          {regionOptions.map(o => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        className={PBTN}
                        disabled={a.do.length <= 1}
                        onClick={() => patch(a.id, x => ({ ...x, do: x.do.filter((_, j) => j !== i) }))}
                        aria-label={`Remove effect ${i + 1} of ${a.id}`}
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <button
                    type="button"
                    className={`${PBTN} justify-self-start`}
                    disabled={a.do.length >= EFFECTS_MAX}
                    onClick={() => patch(a.id, x => ({ ...x, do: [...x.do, effectFor('show', regions)] }))}
                  >
                    <Plus size={10} /> Add an effect
                  </button>
                )}
              </fieldset>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
