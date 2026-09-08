'use client';

import { useState, type CSSProperties } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import {
  APPEARANCE_RANGES,
  FACE_ROLES,
  FACE_ROLE_LABELS,
  MOTIONS,
  MOTION_LABELS,
  MOTION_MS,
  SHIPPED_APPEARANCE,
  appearanceWarnings,
  faceByKey,
  facesForRole,
  isShippedAppearance,
  parseAppearance,
  roundTo,
  type Appearance,
  type FaceRole,
  type Motion,
  type NumericKey,
} from '@/lib/design/appearance-defaults';
import type { EditableAppearance } from '@/lib/design/appearance';

// Appearance (APEX: User Interface Attributes): the four faces by role, the root
// size, the leading, the density, the corners and the motion of the whole site,
// as one screen with a live preview. One document, one Save: a change of size,
// face and leading lands together or not at all, on the stamp that was loaded;
// a document that moved comes back as a conflict with Reload. Nothing here can
// type CSS: the faces come from the catalogue bundled at build, and every
// number passes the legibility gate before Save is armed.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';

const clone = (a: Appearance): Appearance => ({ ...a, faces: { ...a.faces } });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function AppearanceEditor({
  loaded,
  readOnly,
  onSaved,
}: {
  loaded: EditableAppearance;
  readOnly: boolean;
  onSaved: (next: EditableAppearance) => void;
}) {
  const [draft, setDraft] = useState<Appearance>(() => clone(loaded.appearance));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState<EditableAppearance | null>(null);

  // A new document from the server replaces the draft (adjusted during render,
  // React's own pattern for state that follows a prop).
  const [seen, setSeen] = useState(loaded);
  if (loaded !== seen) {
    setSeen(loaded);
    setDraft(clone(loaded.appearance));
    setConflict(null);
    setError(null);
  }

  const canSave = loaded.updatedAt !== null;
  const parsed = parseAppearance(draft);
  const problems = parsed.problems;
  const warnings = appearanceWarnings(parsed.value);
  const changed = !same(draft, loaded.appearance);
  const disabled = readOnly || !canSave;

  const setFace = (role: FaceRole, key: string) => setDraft(d => ({ ...d, faces: { ...d.faces, [role]: key } }));
  const setNumber = (key: NumericKey, n: number) => setDraft(d => ({ ...d, [key]: n }));
  const setMotion = (motion: Motion) => setDraft(d => ({ ...d, motion }));

  async function save() {
    if (busy || disabled || problems.length > 0 || !changed) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    setConflict(null);
    try {
      const res = await fetch('/api/admin/design/appearance', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appearance: parsed.value, updatedAt: loaded.updatedAt }),
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
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Appearance</h2>
      <p className="m-0 mb-4 max-w-[76ch] text-13 text-text-muted">
        The type and the shape of the whole site, for every theme: which face fills each role, how large the type is,
        how much air sits between things, how round the corners are, how quickly things move. Faces come from a list
        bundled with the site (adding one is a new version); every number is checked for legibility before it can be
        saved. What the site shipped is what it does when nothing is stored.
      </p>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-4">
          <Section title="Faces" hint="One face per role. The sample line is set in the face you chose.">
            {FACE_ROLES.map(role => {
              const face = faceByKey(draft.faces[role]);
              return (
                <div key={role} className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3 py-1.5">
                  <label htmlFor={`face-${role}`} className="pt-1 text-12 text-text-muted">
                    <span className="block font-semibold text-text">{FACE_ROLE_LABELS[role].label}</span>
                    <span className="block text-11 text-text-faint">{FACE_ROLE_LABELS[role].sets}</span>
                  </label>
                  <div className="grid gap-1">
                    <select
                      id={`face-${role}`}
                      value={draft.faces[role]}
                      disabled={disabled}
                      className={`${FIELD} max-w-[280px]`}
                      onChange={e => setFace(role, e.target.value)}
                    >
                      {facesForRole(role).map(f => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                          {role === 'sans' && !f.greek ? ' (no Greek)' : ''}
                        </option>
                      ))}
                    </select>
                    <span
                      aria-hidden="true"
                      className="truncate text-15 text-text"
                      style={{ fontFamily: face ? `var(${face.variable})` : undefined }}
                    >
                      {FACE_ROLE_LABELS[role].sample}
                    </span>
                  </div>
                </div>
              );
            })}
          </Section>

          <Section title="Size and leading" hint="The root size moves every text size, every space and every width set in rem. The leading is inherited by whatever does not set its own.">
            <NumberRow name="baseSize" value={draft.baseSize} disabled={disabled} onChange={n => setNumber('baseSize', n)} />
            <NumberRow name="leading" value={draft.leading} disabled={disabled} onChange={n => setNumber('leading', n)} />
          </Section>

          <Section title="Space and shape" hint="Density is the unit every padding, gap and margin is a multiple of. Corners round the cards and controls; the site's square edges stay square.">
            <NumberRow name="density" value={draft.density} disabled={disabled} onChange={n => setNumber('density', n)} />
            <NumberRow name="radius" value={draft.radius} disabled={disabled} onChange={n => setNumber('radius', n)} />
          </Section>

          <Section title="Motion" hint="How long transitions take, site-wide. Readers who ask their system for less motion are honoured regardless.">
            <div className="flex flex-wrap gap-x-5 gap-y-1 py-1">
              {MOTIONS.map(m => (
                <label key={m} className={`inline-flex items-center gap-1.5 text-12 ${disabled ? 'opacity-60' : 'cursor-pointer'} ${draft.motion === m ? 'text-text' : 'text-text-muted'}`}>
                  <input
                    type="radio"
                    name="motion"
                    value={m}
                    checked={draft.motion === m}
                    disabled={disabled}
                    className="accent-(--edit)"
                    onChange={() => setMotion(m)}
                  />
                  {MOTION_LABELS[m].label}
                  <span className="text-text-faint">· {MOTION_LABELS[m].means}</span>
                </label>
              ))}
            </div>
          </Section>
        </div>

        <div className="grid content-start gap-2">
          <span className="font-mono text-9 uppercase tracking-[0.12em] text-text-faint">Preview · a page in these values</span>
          <Preview a={parsed.value} />
          <ul className="m-0 grid list-none gap-0.5 p-0 font-mono text-9 uppercase tracking-[0.1em]">
            <li className="flex justify-between text-text-faint">
              <span>Base size</span>
              <span className="tabular-nums">{Number.isFinite(draft.baseSize) ? `${draft.baseSize} px` : '—'} · 14 to 20</span>
            </li>
            <li className="flex justify-between text-text-faint">
              <span>Leading</span>
              <span className="tabular-nums">{Number.isFinite(draft.leading) ? draft.leading : '—'} · 1.3 to 1.8</span>
            </li>
            <li className="flex justify-between text-text-faint">
              <span>Density</span>
              <span className="tabular-nums">{Number.isFinite(draft.density) ? `${draft.density} rem` : '—'} · 0.2 to 0.35</span>
            </li>
            <li className="flex justify-between text-text-faint">
              <span>Corners</span>
              <span className="tabular-nums">{Number.isFinite(draft.radius) ? `${draft.radius} px` : '—'} · 0 to 16</span>
            </li>
            {problems.map(p => (
              <li key={p} className="text-negative normal-case tracking-normal">
                {p}
              </li>
            ))}
            {warnings.map(w => (
              <li key={w} className="text-brand normal-case tracking-normal">
                {w}
              </li>
            ))}
            {problems.length === 0 && (
              <li className="text-text-faint">{isShippedAppearance(parsed.value) ? 'as shipped' : 'passes the legibility gate'}</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={TB_PRIMARY}
          disabled={busy || disabled || !changed || problems.length > 0}
          onClick={() => void save()}
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? 'Saving…' : 'Save'}
        </button>
        {changed && !busy && (
          <button type="button" className={TB} onClick={() => setDraft(clone(loaded.appearance))}>
            <RotateCcw size={13} /> Discard changes
          </button>
        )}
        {!isShippedAppearance(parsed.value) && !busy && !disabled && (
          <button type="button" className={PBTN} onClick={() => setDraft(clone(SHIPPED_APPEARANCE))}>
            Back to the shipped values
          </button>
        )}
        <span className="font-mono text-10 uppercase tracking-[0.12em] text-text-faint">
          {!canSave
            ? 'the application row is not there yet'
            : changed
              ? problems.length > 0
                ? 'unsaved · a value fails the gate'
                : 'unsaved'
              : saved
                ? 'Saved · the site picks it up within a minute'
                : isShippedAppearance(loaded.appearance)
                  ? 'Stored · as shipped'
                  : 'Stored'}
        </span>
      </div>
      {conflict && (
        <div className="mt-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text">
          <p className="m-0">
            The appearance was saved again after you loaded it. Reload to see what is stored now; your unsaved changes
            are dropped, because the appearance is one document and not a field.
          </p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={PBTN} onClick={() => onSaved(conflict)}>
              Reload
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-12 text-negative">{error}</p>}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="border border-border-strong bg-surface p-3">
      <h3 className="m-0 text-13 font-bold text-text">{title}</h3>
      <p className="m-0 mb-2 text-11 text-text-faint">{hint}</p>
      {children}
    </section>
  );
}

function NumberRow({
  name,
  value,
  disabled,
  onChange,
}: {
  name: NumericKey;
  value: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  const spec = APPEARANCE_RANGES[name];
  const ok = Number.isFinite(value) && value >= spec.min && value <= spec.max;
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)_96px] items-center gap-3 py-1.5">
      <label htmlFor={`num-${name}`} className="text-12 font-semibold text-text">
        {spec.label}
      </label>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={ok ? value : spec.min}
        disabled={disabled}
        aria-label={`${spec.label} slider`}
        className="accent-(--edit)"
        onChange={e => onChange(roundTo(e.target.valueAsNumber, spec.decimals))}
      />
      <span className="inline-flex items-center gap-1">
        <input
          id={`num-${name}`}
          type="number"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={Number.isFinite(value) ? value : ''}
          disabled={disabled}
          className={`${FIELD} w-[4.5rem] font-mono text-11 tabular-nums ${ok ? '' : 'border-negative'}`}
          onChange={e => onChange(e.target.value.trim() === '' ? NaN : Number(e.target.value))}
        />
        <span className="text-11 text-text-faint">{spec.unit}</span>
      </span>
    </div>
  );
}

/** A small page in the draft's type and spacing, so a change is seen before it
 *  is saved. Sizes are in em of the root size; spaces are multiples of the
 *  density; the faces are the roles' variables, which the console's <html>
 *  carries too. Colours are the console's: this preview is about type. */
function Preview({ a }: { a: Appearance }) {
  const face = (role: FaceRole) => `var(${faceByKey(a.faces[role])?.variable ?? '--font-plex-sans'})`;
  const sp = (n: number) => `${roundTo(a.density * n, 3)}rem`;
  const ms = MOTION_MS[a.motion];
  const root: CSSProperties = {
    fontFamily: face('sans'),
    fontSize: `${a.baseSize}px`,
    lineHeight: a.leading,
    background: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border-strong)',
  };
  return (
    <div aria-hidden="true" style={root}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: sp(2), padding: `${sp(2)} ${sp(3)}`, background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: face('mono'), fontSize: '0.625em', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Paddock<span style={{ color: 'var(--brand)' }}>•</span>Tracker
        </span>
        <span style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>Calendar · Learn · Series</span>
      </div>
      <div style={{ padding: sp(3) }}>
        <div style={{ fontFamily: face('mono'), fontSize: '0.625em', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
          Formula 1 · Round 13 · Sunday 6 September
        </div>
        <div style={{ fontFamily: face('serif'), fontSize: '2.375em', lineHeight: 1.05, letterSpacing: '-0.02em', fontWeight: 500, marginTop: sp(1) }}>
          Antonelli wins the Italian Grand Prix
        </div>
        <p style={{ margin: `${sp(2)} 0 0`, color: 'var(--text-muted)' }}>
          Qualifying starts in 2 h 14 min. The pit wall called him in a lap early and the undercut held to the flag.
        </p>
        <div style={{ marginTop: sp(3), border: '1px solid var(--border)', borderRadius: `${a.radius}px`, background: 'var(--surface)', padding: sp(2), display: 'grid', gap: sp(1.5) }}>
          {[
            ['1', 'Antonelli', 'Mercedes', '267'],
            ['2', 'Russell', 'Mercedes', '201'],
            ['3', 'Hamilton', 'Ferrari', '191'],
          ].map(([pos, name, team, pts]) => (
            <div key={pos} style={{ display: 'grid', gridTemplateColumns: '1.5em minmax(0,1fr) auto', alignItems: 'baseline', gap: sp(2) }}>
              <span style={{ fontFamily: face('mono'), fontSize: '0.6875em', color: 'var(--text-faint)' }}>{pos}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontFamily: face('condensed'), fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{name}</span>
                <span style={{ fontFamily: face('mono'), fontSize: '0.625em', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-faint)', marginLeft: sp(2) }}>{team}</span>
              </span>
              <span style={{ fontFamily: face('mono'), fontSize: '0.8125em', fontVariantNumeric: 'tabular-nums', color: 'var(--numeral)' }}>{pts}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp(3), marginTop: sp(3) }}>
          <span style={{ display: 'inline-block', padding: `${sp(1.5)} ${sp(3)}`, borderRadius: `${a.radius}px`, background: 'var(--text)', color: 'var(--bg)', fontSize: '0.875em', fontWeight: 600, transition: `transform ${ms.base}ms` }}>
            Full standings
          </span>
          <span style={{ fontFamily: face('mono'), fontSize: '0.625em', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Sat 6 Sep · 16:00 · motion {ms.base} ms
          </span>
        </div>
      </div>
    </div>
  );
}
