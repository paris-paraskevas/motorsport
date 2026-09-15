'use client';

import { useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import {
  REGION_TEMPLATES,
  SHIPPED_PRESETS,
  TEMPLATE_OPTION_GROUPS,
  clonePresets,
  resolveTemplateOptions,
  templateOptionClasses,
  type RegionTemplateKey,
  type TemplateOptionGroupKey,
  type TemplatePresets,
} from '@/lib/design/template-options';
import type { Appearance, EditableAppearance } from '@/lib/design/appearance';
import { Pills } from './PropertyPane';

// Templates (APEX: Shared Components › Templates › a template › Template
// Options, where the Preset of each group is set at the template level). One
// region template today, Standard; the five looks arrive with P1.1 and take a
// presets set each. The presets ride the Appearance document (the application
// row's `ui` column) and save through its route on its stamp, so a change
// reaches every region on Use Template Defaults the way a changed face does.
// The sample region under the presets is drawn with the very classes the
// served page will use.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function TemplatesEditor({
  loaded,
  readOnly,
  onSaved,
}: {
  loaded: EditableAppearance;
  readOnly: boolean;
  onSaved: (next: EditableAppearance) => void;
}) {
  const [draft, setDraft] = useState<TemplatePresets>(() => clonePresets(loaded.appearance.templates));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState<EditableAppearance | null>(null);

  // A new document from the server replaces the draft (adjusted during render,
  // React's own pattern for state that follows a prop).
  const [seen, setSeen] = useState(loaded);
  if (loaded !== seen) {
    setSeen(loaded);
    setDraft(clonePresets(loaded.appearance.templates));
    setConflict(null);
    setError(null);
  }

  const canSave = loaded.updatedAt !== null;
  const changed = !same(draft, loaded.appearance.templates);
  const disabled = readOnly || !canSave;
  const setPreset = (template: RegionTemplateKey, group: TemplateOptionGroupKey, id: string) =>
    setDraft(d => ({ ...d, [template]: { ...d[template], [group]: id } }));

  async function save() {
    if (busy || disabled || !changed) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    setConflict(null);
    try {
      const appearance: Appearance = { ...loaded.appearance, templates: draft };
      const res = await fetch('/api/admin/design/appearance', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appearance, updatedAt: loaded.updatedAt }),
      });
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as { current?: EditableAppearance | null };
        setConflict(d.current ?? null);
        return;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `Save failed (${res.status})`);
        return;
      }
      const d = (await res.json()) as { appearance: Appearance; updatedAt: string };
      onSaved({ appearance: d.appearance, updatedAt: d.updatedAt });
      setSaved(true);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Templates</h2>
      <p className="m-0 mb-4 max-w-[76ch] text-13 text-text-muted">
        The region templates and their Template Options. A preset is what a region on Use Template Defaults draws for that
        group; change it here and every such region follows, while a region that picked its own option keeps it. The five
        looks arrive with a later step; today every region uses Standard.
      </p>

      {REGION_TEMPLATES.map(template => {
        const presets = draft[template.key];
        const parts = templateOptionClasses(resolveTemplateOptions(undefined, draft, template.key));
        return (
          <section key={template.key} aria-labelledby={`tpl-${template.key}`} className="mb-6 border border-border">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <h3 id={`tpl-${template.key}`} className="m-0 text-15 font-semibold text-text">
                  {template.label}
                </h3>
                <p className="m-0 text-12 text-text-muted">{template.description}</p>
              </div>
              <span className="font-mono text-10 uppercase tracking-[0.12em] text-text-faint">Used by every region of every page</span>
            </div>

            <div className="grid gap-5 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid content-start gap-4">
                <h4 className="m-0 font-mono text-10 uppercase tracking-[0.14em] text-text-faint">Template Options · the preset of each group</h4>
                {TEMPLATE_OPTION_GROUPS.map(group => (
                  <div key={group.key} className="grid gap-1.5 border-b border-border pb-3 last:border-b-0">
                    <div className="text-13 font-medium text-text">{group.label}</div>
                    <Pills
                      label={`${template.label} preset for ${group.label}`}
                      items={group.options.map(o => ({ key: o.id, label: o.label, title: o.help }))}
                      current={presets[group.key]}
                      disabled={disabled}
                      onPick={id => setPreset(template.key, group.key, id)}
                    />
                    <p className="m-0 text-12 text-text-muted">{group.help}</p>
                  </div>
                ))}
              </div>

              <div className="grid content-start gap-2">
                <h4 className="m-0 font-mono text-10 uppercase tracking-[0.14em] text-text-faint">A region on the presets</h4>
                <div className="border border-border bg-bg p-4" data-template-sample="">
                  <div className={parts.wrapper}>
                    <h2 className={parts.heading}>Winners by decade</h2>
                    <div className={parts.paragraphs}>
                      <p className={parts.body}>The Autodromo opened in 1922 and has hosted a round of the championship every season but one.</p>
                      <p className={parts.body}>Its banking stands where it was left in 1969.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={TB_PRIMARY} disabled={disabled || !changed || busy} onClick={save}>
          {busy && <Loader2 size={13} className="animate-spin" />} Save
        </button>
        {changed && !busy && (
          <button type="button" className={TB} onClick={() => setDraft(clonePresets(loaded.appearance.templates))}>
            <RotateCcw size={13} /> Discard changes
          </button>
        )}
        {!same(draft, SHIPPED_PRESETS) && !busy && !disabled && (
          <button type="button" className={PBTN} onClick={() => setDraft(clonePresets(SHIPPED_PRESETS))}>
            Back to the shipped presets
          </button>
        )}
        <span className="font-mono text-10 uppercase tracking-[0.12em] text-text-faint" role="status">
          {!canSave ? 'No application row: read-only.' : readOnly ? 'Read-only on this copy of the site.' : saved && !changed ? 'Saved.' : changed ? 'Unsaved changes.' : ''}
        </span>
      </div>
      {error && (
        <p className="mt-2 text-12 text-negative" role="alert">
          {error}
        </p>
      )}
      {conflict && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-12 text-text-muted" role="alert">
          <span>The appearance was saved again after you loaded it.</span>
          <button type="button" className={PBTN} onClick={() => onSaved(conflict)}>
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
