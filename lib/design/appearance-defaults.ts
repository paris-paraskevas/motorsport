// Appearance (APEX: User Interface Attributes): the typography and shape tokens
// the site reads at render, as one document on the application row. The four
// faces by role, the root font size, the body leading, the spacing unit, the
// corner radius and the motion setting. Client-safe: the designer's editor
// draws from it, the server loader (appearance.ts) falls back to it, and the
// layout turns the loaded document into a style block.
//
// THE RAILS. Faces come from a fixed catalogue bundled at build (lib/fonts.ts):
// a face not declared there cannot load, so adding one is a deploy, like a new
// component kind. Numbers pass a legibility gate the way colours pass the
// contrast gate. Nothing here can carry CSS: a document is keys and numbers,
// and the style block is generated from them.

export const FACE_ROLES = ['sans', 'serif', 'mono', 'condensed'] as const;
export type FaceRole = (typeof FACE_ROLES)[number];

/** What each role sets, in the operator's words, with a sample line in its register. */
export const FACE_ROLE_LABELS: Record<FaceRole, { label: string; sets: string; sample: string }> = {
  sans: { label: 'Body', sets: 'paragraphs, menus, buttons, most of the site', sample: 'The pit wall called him in a lap early.' },
  serif: { label: 'Headlines', sets: 'page titles, headlines, editorial prose', sample: 'Antonelli wins the Italian Grand Prix' },
  mono: { label: 'Data', sets: 'times, points, labels in small capitals', sample: '1:51:15.281 · +3.857 · 267' },
  condensed: { label: 'Names', sets: 'driver and team names on data surfaces', sample: 'VERSTAPPEN · Red Bull Racing' },
};

export interface Face {
  key: string;
  label: string;
  /** The CSS variable next/font puts on <html> for this face (lib/fonts.ts). */
  variable: string;
  /** The roles the editor offers it for. */
  roles: readonly FaceRole[];
  /** Whether the bundled subsets include Greek (names on body surfaces need it). */
  greek: boolean;
}

/** The catalogue, in the editor's order. Every entry is a Google Fonts family
 *  under an open licence (SIL OFL or Apache 2.0, Google Fonts distributes no
 *  other kind), self-hosted at build. The text faces are offered for body and
 *  headlines alike; a mono face fills the data role only, a condensed one the
 *  names role only. */
export const FACES: readonly Face[] = [
  { key: 'plex-sans', label: 'IBM Plex Sans', variable: '--font-plex-sans', roles: ['sans', 'serif'], greek: true },
  { key: 'source-sans-3', label: 'Source Sans 3', variable: '--font-source-sans-3', roles: ['sans', 'serif'], greek: true },
  { key: 'fira-sans', label: 'Fira Sans', variable: '--font-fira-sans', roles: ['sans', 'serif'], greek: true },
  { key: 'newsreader', label: 'Newsreader', variable: '--font-newsreader', roles: ['serif', 'sans'], greek: false },
  { key: 'source-serif-4', label: 'Source Serif 4', variable: '--font-source-serif-4', roles: ['serif', 'sans'], greek: true },
  { key: 'literata', label: 'Literata', variable: '--font-literata', roles: ['serif', 'sans'], greek: true },
  { key: 'plex-mono', label: 'IBM Plex Mono', variable: '--font-plex-mono', roles: ['mono'], greek: false },
  { key: 'jetbrains-mono', label: 'JetBrains Mono', variable: '--font-jetbrains-mono', roles: ['mono'], greek: false },
  { key: 'source-code-pro', label: 'Source Code Pro', variable: '--font-source-code-pro', roles: ['mono'], greek: false },
  { key: 'plex-condensed', label: 'IBM Plex Sans Condensed', variable: '--font-plex-condensed', roles: ['condensed'], greek: false },
  { key: 'roboto-condensed', label: 'Roboto Condensed', variable: '--font-roboto-condensed', roles: ['condensed'], greek: false },
  { key: 'fira-sans-condensed', label: 'Fira Sans Condensed', variable: '--font-fira-sans-condensed', roles: ['condensed'], greek: false },
];

export function faceByKey(key: string): Face | undefined {
  return FACES.find(f => f.key === key);
}

/** The faces the editor offers for a role, catalogue order. */
export function facesForRole(role: FaceRole): Face[] {
  return FACES.filter(f => f.roles.includes(role));
}

export const MOTIONS = ['calm', 'normal', 'none'] as const;
export type Motion = (typeof MOTIONS)[number];
export const MOTION_LABELS: Record<Motion, { label: string; means: string }> = {
  calm: { label: 'Calm', means: 'transitions take about half again as long' },
  normal: { label: 'Normal', means: 'as the site shipped' },
  none: { label: 'None', means: 'no transitions at all' },
};

/** The three durations the stylesheet declares, in milliseconds, per setting.
 *  Normal is what app/globals.css ships; calm is ×1.6, rounded. */
export const MOTION_MS: Record<Motion, { fast: number; base: number; slow: number }> = {
  normal: { fast: 180, base: 280, slow: 520 },
  calm: { fast: 288, base: 448, slow: 832 },
  none: { fast: 0, base: 0, slow: 0 },
};

export interface Appearance {
  faces: Record<FaceRole, string>;
  /** The root font size in px; everything in rem follows it (the size ladder, the Tailwind scale, the spacing). */
  baseSize: number;
  /** The line height inherited by everything that does not set its own. */
  leading: number;
  /** Tailwind's spacing unit in rem: every padding, gap and margin utility is a multiple of it. */
  density: number;
  /** The radius of cards and controls in px; the site's square corners stay square. */
  radius: number;
  motion: Motion;
}

/** What the code ships, and the fallback for every failure. */
export const SHIPPED_APPEARANCE: Appearance = {
  faces: { sans: 'plex-sans', serif: 'newsreader', mono: 'plex-mono', condensed: 'plex-condensed' },
  baseSize: 16,
  leading: 1.5,
  density: 0.25,
  radius: 8,
  motion: 'normal',
};

export type NumericKey = 'baseSize' | 'leading' | 'density' | 'radius';

/** The legibility gate: what a number may be. `step` is the editor's control
 *  step; the gate checks range and decimals, not the step, so a typed value is
 *  never refused for landing between two notches. */
export const APPEARANCE_RANGES: Record<NumericKey, { label: string; min: number; max: number; step: number; decimals: number; unit: string }> = {
  baseSize: { label: 'Base size', min: 14, max: 20, step: 1, decimals: 0, unit: 'px' },
  leading: { label: 'Leading', min: 1.3, max: 1.8, step: 0.05, decimals: 2, unit: '' },
  density: { label: 'Density', min: 0.2, max: 0.35, step: 0.01, decimals: 2, unit: 'rem' },
  radius: { label: 'Corners', min: 0, max: 16, step: 1, decimals: 0, unit: 'px' },
};

/** A number rounded to the key's decimals, as a number (0.30 → 0.3). */
export function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/** Shortest decimal text for the stylesheet: 0.3 not 0.30, 1.5 not 1.50. */
function fmt(n: number): string {
  return String(n);
}

export interface ParsedAppearance {
  /** The document with every unusable key replaced by the shipped value. */
  value: Appearance;
  /** Why each unusable key was refused, in plain words; empty when everything was usable. */
  problems: string[];
}

/**
 * Parse one document (the `ui` column, or what the editor sends) into a usable
 * Appearance and the list of what was refused. The loader keeps `value` and
 * ignores `problems`; the write route refuses when `problems` is not empty. One
 * rule for both, so what the site would fall back on and what the editor may
 * save can never disagree. An absent key is not a problem: it is the shipped
 * value, which is how an empty document means "as shipped".
 */
export function parseAppearance(raw: unknown): ParsedAppearance {
  const problems: string[] = [];
  const value: Appearance = { ...SHIPPED_APPEARANCE, faces: { ...SHIPPED_APPEARANCE.faces } };
  if (raw === undefined || raw === null) return { value, problems };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { value, problems: ['the document must be an object'] };
  const r = raw as Record<string, unknown>;

  if (r.faces !== undefined) {
    if (!r.faces || typeof r.faces !== 'object' || Array.isArray(r.faces)) problems.push('faces must be an object of role → face');
    else {
      const faces = r.faces as Record<string, unknown>;
      for (const role of FACE_ROLES) {
        const key = faces[role];
        if (key === undefined) continue;
        const face = typeof key === 'string' ? faceByKey(key) : undefined;
        if (!face) problems.push(`${FACE_ROLE_LABELS[role].label}: "${String(key)}" is not a face in the catalogue`);
        else if (!face.roles.includes(role)) problems.push(`${FACE_ROLE_LABELS[role].label}: ${face.label} is not offered for this role`);
        else value.faces[role] = face.key;
      }
    }
  }

  for (const key of ['baseSize', 'leading', 'density', 'radius'] as const) {
    const v = r[key];
    if (v === undefined) continue;
    const spec = APPEARANCE_RANGES[key];
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
    if (!Number.isFinite(n)) problems.push(`${spec.label} must be a number`);
    else if (n < spec.min || n > spec.max) problems.push(`${spec.label} must be ${fmt(spec.min)} to ${fmt(spec.max)}${spec.unit ? ` ${spec.unit}` : ''}`);
    else value[key] = roundTo(n, spec.decimals);
  }

  if (r.motion !== undefined) {
    if (typeof r.motion === 'string' && (MOTIONS as readonly string[]).includes(r.motion)) value.motion = r.motion as Motion;
    else problems.push('Motion must be calm, normal or none');
  }

  return { value, problems };
}

/** Advice the gate does not refuse on: the body face without Greek means Greek
 *  names on body surfaces fall through to a system face, per glyph. */
export function appearanceWarnings(a: Appearance): string[] {
  const out: string[] = [];
  const body = faceByKey(a.faces.sans);
  if (body && !body.greek) out.push(`${body.label} carries no Greek: Greek names in body text fall to a system face`);
  return out;
}

export function isShippedAppearance(a: Appearance): boolean {
  return (
    FACE_ROLES.every(role => a.faces[role] === SHIPPED_APPEARANCE.faces[role]) &&
    a.baseSize === SHIPPED_APPEARANCE.baseSize &&
    a.leading === SHIPPED_APPEARANCE.leading &&
    a.density === SHIPPED_APPEARANCE.density &&
    a.radius === SHIPPED_APPEARANCE.radius &&
    a.motion === SHIPPED_APPEARANCE.motion
  );
}

/** The style block that makes a stored appearance real: one `:root` rule,
 *  later in the document than the stylesheet so it wins at equal specificity.
 *  The faces set the role variables the font stacks read (app/globals.css), the
 *  root size moves everything in rem, the leading is inherited by whatever does
 *  not set its own, `--spacing` is Tailwind's unit, the two radius tokens are
 *  the cards' and the primitives', the three durations are the motion. The
 *  dyslexic mode's rule carries an attribute and still wins over the faces.
 *  Empty when the appearance is what the site shipped. */
export function appearanceCss(a: Appearance): string {
  if (isShippedAppearance(a)) return '';
  const decls: string[] = [];
  for (const role of FACE_ROLES) {
    const face = faceByKey(a.faces[role]);
    if (face) decls.push(`--face-${role}:var(${face.variable})`);
  }
  decls.push(`font-size:${a.baseSize}px`);
  decls.push(`line-height:${fmt(a.leading)}`);
  decls.push(`--spacing:${fmt(a.density)}rem`);
  decls.push(`--radius:${a.radius}px`, `--radius-card:${a.radius}px`);
  const m = MOTION_MS[a.motion];
  decls.push(`--duration-fast:${m.fast}ms`, `--duration-base:${m.base}ms`, `--duration-slow:${m.slow}ms`);
  return `:root{${decls.join(';')}}`;
}
