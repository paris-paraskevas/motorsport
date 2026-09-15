'use client';

import { useState } from 'react';
import {
  DEFAULT_TOKEN,
  SHIPPED_PRESETS,
  TEMPLATE_OPTION_GROUPS,
  optionById,
  presetOf,
  templateOptionsSummary,
  usesDefaults,
  type TemplateOptionGroupKey,
  type TemplatePresets,
} from '@/lib/design/template-options';
import { Sheet } from './DesignerMenu';

// The Template Options attribute as APEX draws it (Appearance › Template
// Options; the 5.1 tutorial: "click the Template Options button (Use Template
// Defaults, Scroll - Default) … The Template Options dialog appears … For
// Common - Body Height, select 480px and click OK. The Template Options button
// updates"): a button whose label lists the selection, and a dialog with Use
// Template Defaults and one select per group under Common. The dialog keeps
// its picks in its own state and touches the document on OK alone, so Cancel,
// Escape and a click outside drop the edit.

const BUTTON =
  'w-full border border-border-strong bg-bg px-2 py-1 text-left text-12 leading-snug text-text transition-colors duration-(--duration-fast) hover:border-edit focus:border-edit focus:outline-none disabled:opacity-60';
const SELECT = 'w-full border border-border-strong bg-bg px-2 py-1 text-12 leading-snug text-text focus:border-edit focus:outline-none';

export function TemplateOptionsButton({
  id,
  value,
  presets,
  disabled,
  onChange,
}: {
  id?: string;
  /** The region's list as stored; absent means Use Template Defaults alone. */
  value: string[] | undefined;
  /** The templates' presets, for naming what Default draws; the shipped ones until loaded. */
  presets?: TemplatePresets;
  disabled?: boolean;
  /** The canonical list on OK; undefined when it says nothing but the defaults. */
  onChange: (next: string[] | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button id={id} type="button" className={BUTTON} disabled={disabled} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {templateOptionsSummary(value)}
      </button>
      {open && (
        <TemplateOptionsDialog
          value={value}
          presets={presets ?? SHIPPED_PRESETS}
          onCancel={() => setOpen(false)}
          onOk={next => {
            setOpen(false);
            onChange(next);
          }}
        />
      )}
    </>
  );
}

function picksOf(value: string[] | undefined): Partial<Record<TemplateOptionGroupKey, string>> {
  const out: Partial<Record<TemplateOptionGroupKey, string>> = {};
  for (const group of TEMPLATE_OPTION_GROUPS) {
    const pick = (value ?? []).find(t => group.options.some(o => o.id === t));
    if (pick) out[group.key] = pick;
  }
  return out;
}

export function TemplateOptionsDialog({
  value,
  presets,
  onOk,
  onCancel,
}: {
  value: string[] | undefined;
  presets: TemplatePresets;
  onOk: (next: string[] | undefined) => void;
  onCancel: () => void;
}) {
  const [defaults, setDefaults] = useState(() => usesDefaults(value));
  const [picks, setPicks] = useState(() => picksOf(value));
  const list = [...(defaults ? [DEFAULT_TOKEN] : []), ...TEMPLATE_OPTION_GROUPS.flatMap(g => (picks[g.key] ? [picks[g.key] as string] : []))];
  const next = list.length === 1 && list[0] === DEFAULT_TOKEN ? undefined : list;
  return (
    <Sheet
      title="Template Options"
      sub="Use Template Defaults follows the template’s presets; a group you set keeps its own."
      buttons={[{ label: 'Cancel' }, { label: 'OK', primary: true, run: () => onOk(next) }]}
      onClose={onCancel}
    >
      <div className="grid gap-4 px-[18px] py-4">
        <label className="flex items-center gap-2 text-12 text-text">
          <input type="checkbox" checked={defaults} onChange={e => setDefaults(e.target.checked)} />
          Use Template Defaults
        </label>
        <p className="m-0 text-12 text-text-muted">
          On, every group left at Default draws the template’s preset, and follows it when the preset changes. Off, a group left at Default draws as the site does.
        </p>
        <fieldset className="m-0 grid gap-3 border border-border p-3">
          <legend className="px-1 font-mono text-9 uppercase tracking-[0.12em] text-text-faint">Common</legend>
          {TEMPLATE_OPTION_GROUPS.map(group => {
            const preset = optionById(presetOf(group.key, presets));
            const picked = picks[group.key] ? optionById(picks[group.key] as string) : undefined;
            return (
              <div key={group.key} className="grid gap-1">
                <label htmlFor={`topt-${group.key}`} className="text-12 text-text">
                  {group.label}
                </label>
                <select
                  id={`topt-${group.key}`}
                  className={SELECT}
                  value={picks[group.key] ?? ''}
                  onChange={e => {
                    const id = e.target.value;
                    setPicks(p => {
                      const q = { ...p };
                      if (id) q[group.key] = id;
                      else delete q[group.key];
                      return q;
                    });
                  }}
                >
                  <option value="">{defaults && preset ? `${group.nullText} (${preset.label})` : group.nullText}</option>
                  {group.options.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="m-0 text-11 text-text-faint">{picked ? picked.help : group.help}</p>
              </div>
            );
          })}
        </fieldset>
      </div>
    </Sheet>
  );
}
