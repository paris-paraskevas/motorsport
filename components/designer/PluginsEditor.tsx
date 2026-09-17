'use client';

import { useState } from 'react';
import { Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { BAR_ICON_NAMES } from '@/components/BottomBar';
import { DEFINITIONS, EMPTY_OVERLAY, definitionKind, mergeDefinition, parseOverlay, type DefinitionOverlay, type EditableDefinition } from '@/lib/design/component-definitions';
import { findSource } from '@/lib/design/sources';
import type { AttributeDefinition, AttributeKind, AttributeScope, ComponentDefinition } from '@/lib/design/components';

// Plug-ins (the components programme, P2.0, PR B; APEX: Plug-ins, the
// definition of a component type): every definition in a table with its type,
// attributes, events, Utilization (the live pages whose newest revision uses
// it) and History (its row's stamp, or shipped); one opened below with its
// attributes by group, its events, capabilities and slots. Add Attribute and
// Add Group grow an overlay the operator saves as the definition's row (one
// conditional write on the stamp loaded; a row that moved comes back as a
// conflict with Reload). A shipped attribute is the code's: shown, never
// removed here; an added one leaves unless a page still carries its value,
// which the route refuses in words. The code draws each component: an added
// attribute is stored on the regions and shown in the Property Editor, and a
// renderer reads it when one is written to.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';
const CHIP = 'inline-block border px-1.5 py-0.5 font-mono text-9 uppercase tracking-[0.12em]';
const TH = 'px-2.5 py-1.5 text-left font-mono text-9 font-normal uppercase tracking-[0.14em] text-text-faint';
const TD = 'px-2.5 py-1.5 align-top text-12';

const KINDS: { key: AttributeKind; label: string }[] = [
  { key: 'text', label: 'Text' },
  { key: 'number', label: 'Number' },
  { key: 'boolean', label: 'Yes/No' },
  { key: 'choice', label: 'Select list' },
  { key: 'colour', label: 'Colour' },
  { key: 'icon', label: 'Icon' },
  { key: 'link', label: 'Link to a page' },
];
const KIND_LABEL = Object.fromEntries(KINDS.map(k => [k.key, k.label])) as Record<AttributeKind, string>;
const SCOPES: { key: AttributeScope; label: string }[] = [
  { key: 'component', label: 'Component: each region has its own value' },
  { key: 'application', label: 'Application: one value, under Component Settings' },
  { key: 'report', label: 'Report: each multi-row region' },
];
const NEW_GROUP = '__new__';

/** A key from words: lower-case letters, digits and underscores, starting with a letter. */
const slug = (s: string) => {
  const k = s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return !k ? '' : /^[a-z]/.test(k) ? k : `a_${k}`.slice(0, 40);
};
const stampText = (s: string | null) => (s ? `${s.replace('T', ' ').slice(0, 16)}Z` : 'shipped');
const pagesText = (n: number) => `${n} ${n === 1 ? 'page' : 'pages'}`;
const valueText = (a: AttributeDefinition) => (a.kind === 'boolean' ? (a.default ? 'yes' : 'no') : a.kind === 'icon' ? String(a.default) || 'none' : a.kind === 'link' ? String(a.default) || 'nowhere' : String(a.default) || '(empty)');

interface AddForm {
  label: string;
  kind: AttributeKind;
  scope: AttributeScope;
  def: string;
  min: string;
  max: string;
  maxLength: string;
  options: string;
  group: string;
  newGroup: string;
  help: string;
}
const FRESH: AddForm = { label: '', kind: 'text', scope: 'component', def: '', min: '0', max: '100', maxLength: '200', options: '', group: '', newGroup: '', help: '' };

/** The options of a select list, one per line: `key = Label`, `key: Label` or `key`. */
function optionsOf(text: string): { key: string; label: string }[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => {
      const m = l.match(/^([^=:]+?)\s*[=:]\s*(.+)$/);
      return m ? { key: slug(m[1]).replace(/_/g, '-'), label: m[2].trim() } : { key: slug(l).replace(/_/g, '-'), label: l };
    });
}

export function PluginsEditor({
  definitions,
  readOnly,
  onSaved,
  onOpenPage,
}: {
  definitions: EditableDefinition[];
  readOnly: boolean;
  onSaved: (definitions: EditableDefinition[]) => void;
  /** Opens a page from Utilization in the Page Designer. */
  onOpenPage?: (id: string) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<DefinitionOverlay>(EMPTY_OVERLAY);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<AddForm>(FRESH);
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ bad: boolean; text: string } | null>(null);
  const [conflict, setConflict] = useState(false);

  const open = openKey ? (definitions.find(d => d.key === openKey) ?? null) : null;
  const shipped: ComponentDefinition | null = open ? (DEFINITIONS.find(d => d.key === open.key) ?? null) : null;
  const merged = shipped ? mergeDefinition(shipped, draft) : null;
  const dirty = open ? JSON.stringify(draft) !== JSON.stringify(open.overlay) : false;

  const openDefinition = (d: EditableDefinition) => {
    setOpenKey(d.key);
    setDraft(d.overlay);
    setAdding(false);
    setAddingGroup(false);
    setForm(FRESH);
    setStatus(null);
    setConflict(false);
  };

  const nextSeq = () => Math.max(0, ...(merged?.groups ?? []).map(g => g.seq)) + 10;

  /** The draft with more in it, read by the same rules the route applies; a problem stays here in words. */
  const tryDraft = (next: DefinitionOverlay) => {
    if (!shipped) return false;
    const parsed = parseOverlay(next, shipped);
    if (parsed.problems.length) {
      setStatus({ bad: true, text: parsed.problems.join('; ') });
      return false;
    }
    setDraft(parsed.value);
    setStatus(null);
    return true;
  };

  const addAttribute = () => {
    const key = slug(form.label);
    const attr: Record<string, unknown> = { key, label: form.label.trim(), kind: form.kind };
    if (form.scope !== 'component') attr.scope = form.scope;
    if (form.help.trim()) attr.help = form.help.trim();
    switch (form.kind) {
      case 'boolean':
        attr.default = form.def === 'yes';
        break;
      case 'number':
        attr.min = Number(form.min);
        attr.max = Number(form.max);
        attr.default = form.def.trim() === '' ? Number(form.min) : Number(form.def);
        break;
      case 'choice': {
        const options = optionsOf(form.options);
        attr.options = options;
        attr.default = form.def.trim() || options[0]?.key || '';
        break;
      }
      case 'text':
        attr.maxLength = Number(form.maxLength) || 200;
        attr.default = form.def;
        break;
      case 'colour':
        attr.default = form.def || '#8c1c13';
        break;
      case 'icon':
        attr.default = form.def;
        break;
      case 'link':
        attr.default = '';
        break;
    }
    const groups = [...draft.groups];
    if (form.group === NEW_GROUP) {
      const gkey = slug(form.newGroup);
      groups.push({ key: gkey, title: form.newGroup.trim(), seq: nextSeq() });
      attr.group = gkey;
    } else if (form.group) attr.group = form.group;
    if (tryDraft({ attributes: [...draft.attributes, attr as unknown as AttributeDefinition], groups })) {
      setAdding(false);
      setForm(FRESH);
    }
  };

  const addGroup = () => {
    if (tryDraft({ ...draft, groups: [...draft.groups, { key: slug(groupTitle), title: groupTitle.trim(), seq: nextSeq() }] })) {
      setAddingGroup(false);
      setGroupTitle('');
    }
  };

  const remove = (key: string) => {
    setDraft({ ...draft, attributes: draft.attributes.filter(a => a.key !== key) });
    setStatus(null);
  };

  const save = async () => {
    if (!open) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/design/definitions/${encodeURIComponent(open.key)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ overlay: draft, updatedAt: open.updatedAt }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; definition?: EditableDefinition };
      if (res.ok && d.definition) {
        const next = d.definition;
        onSaved(definitions.map(x => (x.key === next.key ? next : x)));
        setDraft(next.overlay);
        setStatus({ bad: false, text: 'Saved.' });
      } else {
        setStatus({ bad: true, text: d.error ?? `The definition could not be saved (HTTP ${res.status}).` });
        if (res.status === 409) setConflict(true);
      }
    } catch {
      setStatus({ bad: true, text: 'The definition could not be saved: network error.' });
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/design/definitions', { cache: 'no-store' });
      if (!res.ok) {
        setStatus({ bad: true, text: `The definitions could not be reloaded (HTTP ${res.status}).` });
        return;
      }
      const d = (await res.json()) as { definitions: EditableDefinition[] };
      onSaved(d.definitions);
      const again = openKey ? d.definitions.find(x => x.key === openKey) : null;
      if (again) setDraft(again.overlay);
      setConflict(false);
      setStatus({ bad: false, text: 'Reloaded.' });
    } catch {
      setStatus({ bad: true, text: 'The definitions could not be reloaded: network error.' });
    } finally {
      setBusy(false);
    }
  };

  const shippedKeys = new Set(shipped?.settings.map(s => s.key) ?? []);
  const groupsShown = merged ? [{ key: '', title: 'Settings' }, ...[...(merged.groups ?? [])].sort((a, b) => a.seq - b.seq)] : [];

  return (
    <div className="grid gap-4">
      <header className="grid gap-1">
        <h2 className="m-0 font-serif text-22 font-medium text-text">Plug-ins</h2>
        <p className="m-0 max-w-[72ch] text-12-5 text-text-muted">
          The definitions of the component types (APEX: Plug-ins): what each takes, in groups, its events and slots, where it is used and when it last changed. The code draws each; an attribute you add here is stored on the regions and shown in the Property Editor. A page carries every attribute of its components from its next save, so an added attribute leaves only while no page carries it.
        </p>
      </header>

      <div className="overflow-x-auto border border-border-strong bg-surface">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={TH}>Name</th>
              <th className={TH}>Type</th>
              <th className={TH}>Attributes</th>
              <th className={TH}>Events</th>
              <th className={TH}>Used on</th>
              <th className={TH}>Changed</th>
              <th className={TH}></th>
            </tr>
          </thead>
          <tbody>
            {definitions.map(d => {
              const application = d.definition.settings.filter(s => s.scope === 'application').length;
              return (
                <tr key={d.key} className={`border-b border-border ${openKey === d.key ? 'bg-edit-dim/40' : ''}`}>
                  <td className={TD}>
                    <b className="font-semibold text-text">{d.definition.name}</b>
                    <div className="font-mono text-10 text-text-faint">{d.key}</div>
                  </td>
                  <td className={TD}>{definitionKind(d.definition)}</td>
                  <td className={TD}>
                    {d.definition.settings.length}
                    {application > 0 ? ` (${application} application)` : ''}
                  </td>
                  <td className={TD}>{d.definition.events?.length ?? 0}</td>
                  <td className={TD}>{pagesText(d.usedOn.length)}</td>
                  <td className={`${TD} font-mono text-10 text-text-faint`}>{stampText(d.updatedAt)}</td>
                  <td className={TD}>
                    <button type="button" className={PBTN} aria-label={`Open ${d.definition.name}`} onClick={() => openDefinition(d)}>
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && shipped && merged && (
        <section aria-label={`Plug-in: ${shipped.name}`} className="grid gap-3 border border-border-strong bg-surface p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="m-0 font-serif text-18 font-medium text-text">{shipped.name}</h3>
            <span className="font-mono text-10 text-text-faint">{shipped.key}</span>
            <span className={`${CHIP} border-border-strong text-text-muted`}>{definitionKind(shipped)}</span>
            <span className="text-12 text-text-muted">{shipped.holds}</span>
          </div>

          {groupsShown.map(g => {
            const rows = merged.settings.filter(s => (s.group ?? '') === g.key);
            if (rows.length === 0) return null;
            return (
              <table key={g.key || 'settings'} className="w-full border-collapse border border-border">
                <caption className="px-2.5 py-1.5 text-left font-mono text-10 uppercase tracking-[0.14em] text-text-muted">{g.title}</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th className={TH}>Attribute</th>
                    <th className={TH}>Key</th>
                    <th className={TH}>Scope</th>
                    <th className={TH}>Type</th>
                    <th className={TH}>Default</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(s => {
                    const isShipped = shippedKeys.has(s.key);
                    return (
                      <tr key={s.key} className="border-b border-border last:border-b-0">
                        <td className={TD}>
                          <b className="font-semibold text-text">{s.label}</b>
                          {s.help && <div className="text-11 text-text-faint">{s.help}</div>}
                        </td>
                        <td className={`${TD} font-mono text-10 text-text-faint`}>{s.key}</td>
                        <td className={TD}>{s.scope ?? 'component'}</td>
                        <td className={TD}>{KIND_LABEL[s.kind]}</td>
                        <td className={`${TD} font-mono text-11`}>{valueText(s)}</td>
                        <td className={`${TD} whitespace-nowrap`}>
                          <span className={`${CHIP} ${isShipped ? 'border-border-strong text-text-faint' : 'border-edit text-edit'}`}>{isShipped ? 'shipped' : 'added'}</span>
                          {!isShipped && !readOnly && (
                            <button type="button" className={`${PBTN} ml-2 hover:border-negative hover:text-negative`} aria-label={`Remove ${s.key}`} onClick={() => remove(s.key)}>
                              <Trash2 className="inline h-3 w-3" aria-hidden="true" /> Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })}

          <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-12">
            <dt className="font-mono text-10 uppercase tracking-[0.14em] text-text-faint">Events</dt>
            <dd className="m-0 text-text-muted">{shipped.events?.length ? shipped.events.map(e => `${e.name} (${e.key})`).join(', ') : 'none declared yet; the first component that fires one wires the dynamic actions'}</dd>
            <dt className="font-mono text-10 uppercase tracking-[0.14em] text-text-faint">Capabilities</dt>
            <dd className="m-0 text-text-muted">
              template {shipped.capabilities?.template === false ? 'no' : 'yes'} · header and footer {shipped.capabilities?.headerFooter === false ? 'no' : 'yes'}
            </dd>
            <dt className="font-mono text-10 uppercase tracking-[0.14em] text-text-faint">Slots</dt>
            <dd className="m-0 text-text-muted">{shipped.slots?.length ? shipped.slots.map(s => `${s.name} (${s.accepts.join(', ')})`).join(', ') : 'none'}</dd>
            <dt className="font-mono text-10 uppercase tracking-[0.14em] text-text-faint">Sources</dt>
            <dd className="m-0 text-text-muted">{shipped.sources?.length ? shipped.sources.map(k => findSource(k)?.name ?? k).join(', ') : 'none; the component draws its own assembly'}</dd>
            <dt className="font-mono text-10 uppercase tracking-[0.14em] text-text-faint">Used on</dt>
            <dd className="m-0 text-text-muted">
              {open.usedOn.length === 0
                ? 'no page yet'
                : open.usedOn.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ', '}
                      {onOpenPage ? (
                        <button type="button" className="text-edit underline-offset-2 hover:underline" aria-label={`Open ${p.name}`} onClick={() => onOpenPage(p.id)}>
                          {p.name}
                        </button>
                      ) : (
                        p.name
                      )}
                    </span>
                  ))}
              {open.regions > 0 && <span className="text-text-faint"> · {open.regions} {open.regions === 1 ? 'region' : 'regions'}</span>}
            </dd>
            <dt className="font-mono text-10 uppercase tracking-[0.14em] text-text-faint">History</dt>
            <dd className="m-0 text-text-muted">{open.updatedAt ? `${stampText(open.updatedAt)} by ${open.updatedBy ?? 'unknown'}` : 'shipped with the code; no row yet'}</dd>
          </dl>

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={TB} disabled={busy} onClick={() => setAdding(a => !a)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add Attribute
              </button>
              <button type="button" className={TB} disabled={busy} onClick={() => setAddingGroup(a => !a)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add Group
              </button>
              <button type="button" className={TB_PRIMARY} disabled={busy || !dirty || conflict} onClick={() => void save()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null} Save
              </button>
              {conflict && (
                <button type="button" className={TB} disabled={busy} onClick={() => void reload()}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reload
                </button>
              )}
            </div>
          )}

          {adding && !readOnly && (
            <form
              aria-label="Add Attribute"
              className="grid gap-2 border border-border bg-bg p-3 sm:grid-cols-2"
              onSubmit={e => {
                e.preventDefault();
                addAttribute();
              }}
            >
              <label className="grid gap-1 text-11 text-text-muted">
                Label
                <input className={FIELD} value={form.label} maxLength={60} onChange={e => setForm({ ...form, label: e.target.value })} />
              </label>
              <label className="grid gap-1 text-11 text-text-muted">
                Type
                <select className={FIELD} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as AttributeKind, def: '' })}>
                  {KINDS.map(k => (
                    <option key={k.key} value={k.key}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-11 text-text-muted">
                Scope
                <select className={FIELD} value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value as AttributeScope })}>
                  {SCOPES.map(s => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-11 text-text-muted">
                Default
                {form.kind === 'boolean' ? (
                  <select className={FIELD} value={form.def || 'no'} onChange={e => setForm({ ...form, def: e.target.value })}>
                    <option value="no">no</option>
                    <option value="yes">yes</option>
                  </select>
                ) : form.kind === 'colour' ? (
                  <input type="color" className="h-[30px] w-16 cursor-pointer border border-border-strong bg-bg p-0" value={form.def || '#8c1c13'} onChange={e => setForm({ ...form, def: e.target.value })} />
                ) : form.kind === 'icon' ? (
                  <select className={FIELD} value={form.def} onChange={e => setForm({ ...form, def: e.target.value })}>
                    <option value="">none</option>
                    {BAR_ICON_NAMES.map(n => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                ) : form.kind === 'link' ? (
                  <input className={FIELD} value="Nowhere; set on each region" disabled readOnly />
                ) : form.kind === 'number' ? (
                  <input type="number" className={FIELD} value={form.def} onChange={e => setForm({ ...form, def: e.target.value })} />
                ) : (
                  <input className={FIELD} value={form.def} onChange={e => setForm({ ...form, def: e.target.value })} placeholder={form.kind === 'choice' ? 'the key of one option' : ''} />
                )}
              </label>
              {form.kind === 'number' && (
                <>
                  <label className="grid gap-1 text-11 text-text-muted">
                    Min
                    <input type="number" className={FIELD} value={form.min} onChange={e => setForm({ ...form, min: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-11 text-text-muted">
                    Max
                    <input type="number" className={FIELD} value={form.max} onChange={e => setForm({ ...form, max: e.target.value })} />
                  </label>
                </>
              )}
              {form.kind === 'text' && (
                <label className="grid gap-1 text-11 text-text-muted">
                  Max length
                  <input type="number" className={FIELD} min={1} max={200} value={form.maxLength} onChange={e => setForm({ ...form, maxLength: e.target.value })} />
                </label>
              )}
              {form.kind === 'choice' && (
                <label className="grid gap-1 text-11 text-text-muted sm:col-span-2">
                  Options (one per line, key = label)
                  <textarea className={`${FIELD} min-h-[72px] font-mono text-11`} value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} />
                </label>
              )}
              <label className="grid gap-1 text-11 text-text-muted">
                Group
                <select className={FIELD} value={form.group} onChange={e => setForm({ ...form, group: e.target.value })}>
                  <option value="">Settings (no group)</option>
                  {[...(merged.groups ?? [])]
                    .sort((a, b) => a.seq - b.seq)
                    .map(g => (
                      <option key={g.key} value={g.key}>
                        {g.title}
                      </option>
                    ))}
                  <option value={NEW_GROUP}>New group…</option>
                </select>
              </label>
              {form.group === NEW_GROUP && (
                <label className="grid gap-1 text-11 text-text-muted">
                  New group title
                  <input className={FIELD} value={form.newGroup} maxLength={60} onChange={e => setForm({ ...form, newGroup: e.target.value })} />
                </label>
              )}
              <label className="grid gap-1 text-11 text-text-muted sm:col-span-2">
                Help
                <input className={FIELD} value={form.help} maxLength={300} onChange={e => setForm({ ...form, help: e.target.value })} placeholder="What the value changes, in plain words." />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className={TB_PRIMARY} disabled={!form.label.trim() || (form.group === NEW_GROUP && !form.newGroup.trim())}>
                  Add
                </button>
                <button type="button" className={TB} onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {addingGroup && !readOnly && (
            <div className="flex flex-wrap items-end gap-2 border border-border bg-bg p-3">
              <label className="grid gap-1 text-11 text-text-muted">
                Group title
                <input className={FIELD} value={groupTitle} maxLength={60} onChange={e => setGroupTitle(e.target.value)} />
              </label>
              <button type="button" className={TB_PRIMARY} disabled={!groupTitle.trim()} onClick={addGroup}>
                Add group
              </button>
              <button type="button" className={TB} onClick={() => setAddingGroup(false)}>
                Cancel
              </button>
            </div>
          )}

          <p role="status" className={`m-0 text-12 ${status?.bad ? 'text-negative' : 'text-text-muted'}`}>
            {status?.text ?? ''}
          </p>
        </section>
      )}
    </div>
  );
}
