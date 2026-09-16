// Template options (APEX: Template Options, Template Option Groups, Presets,
// the Default and Global Template Options), the components programme, P1.2.
// Client-safe: the Property Editor's dialog, the Templates screen, the document
// parser and the served page all read from this one module.
//
// APEX's model, kept: a template option is a named CSS modifier with an
// upper-case identifier; a GROUP collects related options, and at the template
// level one option of the group is the PRESET; a component either uses the
// template's defaults (`#DEFAULT#`, "not written to an actual component" so
// the defaults can be changed centrally) or picks its own. The ledger's
// acceptance for P1.2 makes the presets what `#DEFAULT#` resolves to: a region
// on Use Template Defaults follows the template's presets live, a region that
// picked an option in a group keeps that pick, and its other groups still
// follow. The five groups are global (defined once, for every region
// template); the presets are per template, as APEX sets them.
//
// THE RAILS. Every option maps to classes the site already uses, by part of
// the region (the wrapper, the heading, the body text, the paragraph gaps);
// nothing here can carry CSS, and the first option of every group is what the
// site drew before this slot, so the shipped presets change nothing for
// readers until the operator changes one.

export const DEFAULT_TOKEN = '#DEFAULT#' as const;

/** The region templates, the five looks (APEX: Appearance › Template; the
 *  components programme, P1.1). A look is a box drawn inside the region's grid
 *  cell (none for Plain and Hero), the body text's base type, and its presets
 *  over the five groups (SHIPPED_PRESETS). An option adds its classes to other
 *  parts or other properties, so no look and no option set one CSS property on
 *  one element, and no class order is relied on. Today's one template keeps its
 *  stored key `standard` under the label Plain: a region with no template reads
 *  as Plain, and every stored page draws as it did. Each names its Universal
 *  Theme counterpart (rule 3; read from the UT 26.1 app's Components page,
 *  2026-09-16) or is ours, with the reason. */
export const REGION_TEMPLATE_KEYS = ['standard', 'boxed', 'band', 'aside', 'hero'] as const;
export type RegionTemplateKey = (typeof REGION_TEMPLATE_KEYS)[number];
export const DEFAULT_REGION_TEMPLATE: RegionTemplateKey = 'standard';

export interface RegionTemplate {
  key: RegionTemplateKey;
  label: string;
  description: string;
  /** The Universal Theme template it answers to; null marks it ours, `why` says why. */
  apex: string | null;
  why?: string;
  /** Classes of the box drawn inside the cell around the region's content; '' draws none. */
  box: string;
  /** The body text's base type (face, size, leading); Emphasis adds the colour. */
  body: string;
  /** The box runs to the page's edges where the region reaches them (RowPageView's bandBleed). */
  bleeds: boolean;
}

const BODY = 'font-serif text-16 leading-relaxed';

export const REGION_TEMPLATES: readonly RegionTemplate[] = [
  { key: 'standard', label: 'Plain', description: 'The title as a small label over the text, no box, no rule: the region as the site draws it.', apex: 'Content Block', box: '', body: BODY, bleeds: false },
  { key: 'boxed', label: 'Boxed', description: 'The site’s card: a hairline box on the surface colour, the label and the text inside it.', apex: 'Standard', box: 'border border-border bg-surface p-4', body: BODY, bleeds: false },
  {
    key: 'band',
    label: 'Band',
    description: 'A strip across the whole row on the elevated surface, running to the page’s edges, a hairline above and below.',
    apex: null,
    why: 'the Universal Theme has no full-row band; Hero is the nearest, and Hero here is the display headline',
    box: 'border-y border-border bg-surface-elevated py-6 px-4 md:px-6 lg:px-8',
    body: BODY,
    bleeds: true,
  },
  {
    key: 'aside',
    label: 'Aside',
    description: 'A pull-out: a rule in the brand colour on the left, the text a size smaller and fainter.',
    apex: null,
    why: 'the Universal Theme has no pull-out template',
    box: 'border-l-2 border-brand pl-4',
    body: 'font-serif text-15 leading-relaxed',
    bleeds: false,
  },
  { key: 'hero', label: 'Hero', description: 'The title as a display headline in the page’s serif with a lead paragraph in the full ink, a hairline to close.', apex: 'Hero', box: '', body: 'font-serif text-20 leading-snug', bleeds: false },
];

export function isRegionTemplateKey(x: unknown): x is RegionTemplateKey {
  return typeof x === 'string' && (REGION_TEMPLATE_KEYS as readonly string[]).includes(x);
}

/** A template by key; Plain for a key the code does not have. */
export function regionTemplate(key: RegionTemplateKey | undefined): RegionTemplate {
  return REGION_TEMPLATES.find(t => t.key === key) ?? REGION_TEMPLATES[0];
}

/** Parse a region's template as stored (`template` on the region): absent,
 *  null, empty and the default read as absent, since absent means Plain; a
 *  look is kept; anything else is a problem for the writer. */
export function parseRegionTemplate(raw: unknown): { value: RegionTemplateKey | undefined; problem?: string } {
  if (raw === undefined || raw === null || raw === '' || raw === DEFAULT_REGION_TEMPLATE) return { value: undefined };
  if (isRegionTemplateKey(raw)) return { value: raw };
  return { value: undefined, problem: `the template must be one of ${REGION_TEMPLATE_KEYS.join(', ')}` };
}

export const TEMPLATE_OPTION_GROUP_KEYS = ['spacing', 'heading', 'rule', 'emphasis', 'width'] as const;
export type TemplateOptionGroupKey = (typeof TEMPLATE_OPTION_GROUP_KEYS)[number];

/** The parts of a region an option may class. */
export type RegionPart = 'wrapper' | 'heading' | 'body' | 'paragraphs';

export interface TemplateOption {
  /** APEX: the Identifier, upper case, never renamed once a document carries it. */
  id: string;
  /** APEX: the Name. */
  label: string;
  /** APEX: the Help Text. */
  help: string;
  /** APEX: the Classes, by the part they go on. */
  classes: Partial<Record<RegionPart, string>>;
}

export interface TemplateOptionGroup {
  key: TemplateOptionGroupKey;
  /** APEX: the group's Name. */
  label: string;
  /** APEX: the Help Text. */
  help: string;
  /** APEX: the Null Text, what a region draws in this group when nothing applies; here the first option's meaning. */
  nullText: string;
  /** The first option is what the site drew before P1.2. */
  options: readonly TemplateOption[];
}

/** The five groups, in the ledger's order; global to every region template. */
export const TEMPLATE_OPTION_GROUPS: readonly TemplateOptionGroup[] = [
  {
    key: 'spacing',
    label: 'Spacing',
    help: 'The air inside the region: the gap under its heading, the gap between its paragraphs, and for Roomy some room above and below it.',
    nullText: 'Default',
    options: [
      { id: 'SPACING_STANDARD', label: 'Standard', help: 'As the site draws it.', classes: { heading: 'mb-3', paragraphs: 'space-y-3' } },
      { id: 'SPACING_COMPACT', label: 'Compact', help: 'The gaps halved.', classes: { heading: 'mb-1.5', paragraphs: 'space-y-1.5' } },
      { id: 'SPACING_ROOMY', label: 'Roomy', help: 'The gaps doubled, and air above and below the region.', classes: { wrapper: 'py-4', heading: 'mb-5', paragraphs: 'space-y-6' } },
    ],
  },
  {
    key: 'heading',
    label: 'Heading style',
    help: 'How the region’s title is drawn. A component draws its own heading, so this has nothing to draw for it.',
    nullText: 'Default',
    options: [
      { id: 'HEADING_LABEL', label: 'Label', help: 'A small capitals label with a hairline under it, as the site draws it.', classes: { heading: 'border-b border-text pb-1 font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted' } },
      { id: 'HEADING_HEADLINE', label: 'Headline', help: 'The title in the page’s serif, larger, no hairline.', classes: { heading: 'font-serif text-20 font-medium leading-tight text-text' } },
      // P1.1: the Hero look's preset, the site's masthead type (RowPageView's h1).
      { id: 'HEADING_DISPLAY', label: 'Display', help: 'The title as a display headline in the page’s serif, as the page title is drawn.', classes: { heading: 'font-serif text-34 font-medium leading-none tracking-[-0.02em] text-text md:text-40' } },
      // P1.1: the Aside look's preset.
      { id: 'HEADING_QUIET', label: 'Quiet label', help: 'The small capitals label without its hairline, in the faint colour.', classes: { heading: 'font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-faint' } },
      { id: 'HEADING_HIDDEN', label: 'Hidden', help: 'The title is not drawn; the tree, Messages and assistive technology still know it.', classes: { heading: 'sr-only' } },
    ],
  },
  {
    key: 'rule',
    label: 'Rule',
    help: 'A hairline above or below the region, with its own padding.',
    nullText: 'Default',
    options: [
      { id: 'RULE_NONE', label: 'None', help: 'No rule, as the site draws it.', classes: {} },
      { id: 'RULE_ABOVE', label: 'Above', help: 'A hairline above the region.', classes: { wrapper: 'border-t border-border pt-4' } },
      { id: 'RULE_BELOW', label: 'Below', help: 'A hairline below the region.', classes: { wrapper: 'border-b border-border pb-4' } },
      { id: 'RULE_BOTH', label: 'Above and below', help: 'A hairline above and one below.', classes: { wrapper: 'border-t border-b border-border pt-4 pb-4' } },
    ],
  },
  {
    key: 'emphasis',
    label: 'Emphasis',
    help: 'The weight the region carries on the page: its text colour, or an accent rule on its left.',
    nullText: 'Default',
    options: [
      { id: 'EMPHASIS_NORMAL', label: 'Normal', help: 'The body text in the muted colour, as the site draws it.', classes: { body: 'text-text-muted' } },
      { id: 'EMPHASIS_MUTED', label: 'Muted', help: 'The body text in the faint colour, for an aside.', classes: { body: 'text-text-faint' } },
      { id: 'EMPHASIS_ACCENT', label: 'Accent', help: 'A rule in the brand colour on the region’s left, the content indented from it (an Aside already carries one).', classes: { wrapper: 'border-l-2 border-brand pl-4', body: 'text-text-muted' } },
      // P1.1: the Band and Hero looks' preset.
      { id: 'EMPHASIS_STRONG', label: 'Strong', help: 'The body text in the full ink.', classes: { body: 'text-text' } },
    ],
  },
  {
    key: 'width',
    label: 'Width',
    help: 'How wide the region’s content may run inside its columns.',
    nullText: 'Default',
    options: [
      { id: 'WIDTH_FULL', label: 'Full', help: 'The region’s columns, as the site draws it.', classes: {} },
      { id: 'WIDTH_READING', label: 'Reading', help: 'Held to a reading measure of about 65 characters.', classes: { wrapper: 'max-w-[65ch]' } },
      { id: 'WIDTH_NARROW', label: 'Narrow', help: 'Held to about 45 characters.', classes: { wrapper: 'max-w-[45ch]' } },
    ],
  },
];

/** A group by key; the keys are the five above. */
export function groupOf(key: TemplateOptionGroupKey): TemplateOptionGroup {
  return TEMPLATE_OPTION_GROUPS.find(g => g.key === key)!;
}

const OPTION_INDEX: ReadonlyMap<string, { group: TemplateOptionGroup; option: TemplateOption }> = new Map(
  TEMPLATE_OPTION_GROUPS.flatMap(group => group.options.map(option => [option.id, { group, option }] as const)),
);

export function optionById(id: string): TemplateOption | undefined {
  return OPTION_INDEX.get(id)?.option;
}

/** The preset per group, per template (APEX: the Preset, set at the template level). */
export type TemplatePresets = Record<RegionTemplateKey, Record<TemplateOptionGroupKey, string>>;

/** The first option of every group: what the site drew before P1.2, and Plain's presets. */
const FIRST = Object.fromEntries(TEMPLATE_OPTION_GROUPS.map(g => [g.key, g.options[0].id])) as Record<TemplateOptionGroupKey, string>;

/** What the code ships, per template (P1.1): Plain and Boxed on the first
 *  options; Band in the full ink; Aside with the quiet label and the faint
 *  text; Hero with the display headline, the full ink and the hairline below. */
export const SHIPPED_PRESETS: TemplatePresets = {
  standard: { ...FIRST },
  boxed: { ...FIRST },
  band: { ...FIRST, emphasis: 'EMPHASIS_STRONG' },
  aside: { ...FIRST, heading: 'HEADING_QUIET', emphasis: 'EMPHASIS_MUTED' },
  hero: { ...FIRST, heading: 'HEADING_DISPLAY', rule: 'RULE_BELOW', emphasis: 'EMPHASIS_STRONG' },
};

export function clonePresets(p: TemplatePresets): TemplatePresets {
  return Object.fromEntries(REGION_TEMPLATE_KEYS.map(t => [t, { ...p[t] }])) as TemplatePresets;
}

/** The preset a group has on a template. */
export function presetOf(group: TemplateOptionGroupKey, presets: TemplatePresets, template: RegionTemplateKey = DEFAULT_REGION_TEMPLATE): string {
  return presets[template]?.[group] ?? SHIPPED_PRESETS[template][group];
}

/** Whether a region's list says Use Template Defaults; an absent list does. */
export function usesDefaults(list: readonly string[] | undefined): boolean {
  return list === undefined || list.includes(DEFAULT_TOKEN);
}

/**
 * Parse a region's template options as stored (`templateOptions` on the
 * region): a list of APEX's tokens, `#DEFAULT#` and option identifiers. The
 * value comes back canonical (`#DEFAULT#` first, then the identifiers in group
 * order, no repeats) and absent when the list says nothing but the defaults,
 * which is what an absent list means. The problems are for the writer: an
 * identifier the code does not have, two options of one group, or not a list.
 */
export function parseTemplateOptions(raw: unknown): { value: string[] | undefined; problems: string[] } {
  if (raw === undefined || raw === null) return { value: undefined, problems: [] };
  if (!Array.isArray(raw)) return { value: undefined, problems: ['the template options must be a list'] };
  if (!raw.every(t => typeof t === 'string')) return { value: undefined, problems: ['the template options must be a list of identifiers'] };
  const tokens = new Set(raw as string[]);
  const problems: string[] = [];
  const picked = new Map<TemplateOptionGroupKey, string[]>();
  for (const token of tokens) {
    if (token === DEFAULT_TOKEN) continue;
    const hit = OPTION_INDEX.get(token);
    if (!hit) problems.push(`names a template option the code does not have (${token})`);
    else picked.set(hit.group.key, [...(picked.get(hit.group.key) ?? []), token]);
  }
  for (const group of TEMPLATE_OPTION_GROUPS) {
    const ids = picked.get(group.key) ?? [];
    if (ids.length > 1) problems.push(`picks two options of ${group.label} (${ids.join(', ')})`);
  }
  if (problems.length > 0) return { value: undefined, problems };
  const value = [...(tokens.has(DEFAULT_TOKEN) ? [DEFAULT_TOKEN] : []), ...TEMPLATE_OPTION_GROUPS.flatMap(g => picked.get(g.key) ?? [])];
  return { value: value.length === 1 && value[0] === DEFAULT_TOKEN ? undefined : value, problems: [] };
}

/** The option that applies per group: the region's pick, else the template's
 *  preset when the region uses the defaults, else the group's first option. */
export function resolveTemplateOptions(
  list: readonly string[] | undefined,
  presets: TemplatePresets,
  template: RegionTemplateKey = DEFAULT_REGION_TEMPLATE,
): Record<TemplateOptionGroupKey, string> {
  const tokens = list ?? [DEFAULT_TOKEN];
  const defaults = tokens.includes(DEFAULT_TOKEN);
  const out = {} as Record<TemplateOptionGroupKey, string>;
  for (const group of TEMPLATE_OPTION_GROUPS) {
    const pick = tokens.find(t => group.options.some(o => o.id === t));
    out[group.key] = pick ?? (defaults ? presetOf(group.key, presets, template) : group.options[0].id);
  }
  return out;
}

export interface TemplateOptionClasses {
  /** The region's wrapper (its grid cell): the rule, the width, the accent, the outer air. */
  wrapper: string;
  /** The look's box inside the cell (P1.1): the card, the band's strip, the aside's rule; '' draws none. */
  box: string;
  /** The region's title element. */
  heading: string;
  /** The body text (a paragraph, a caption's lead). */
  body: string;
  /** The container of the paragraphs: their gap. */
  paragraphs: string;
}

/** The Heading style option that draws no title; the heading part is then
 *  `sr-only` alone, with no gap from Spacing, since nothing is drawn. */
export const HIDDEN_HEADING = 'HEADING_HIDDEN';

/** The classes per part for a resolved set on a template, the options'
 *  fragments joined in group order; the body's base type is the template's,
 *  then Emphasis's colour; the box is the template's alone. */
export function templateOptionClasses(resolved: Record<TemplateOptionGroupKey, string>, template: RegionTemplateKey = DEFAULT_REGION_TEMPLATE): TemplateOptionClasses {
  const look = regionTemplate(template);
  const parts: Record<RegionPart, string[]> = { wrapper: [], heading: [], body: [look.body], paragraphs: [] };
  for (const group of TEMPLATE_OPTION_GROUPS) {
    const option = group.options.find(o => o.id === resolved[group.key]) ?? group.options[0];
    for (const part of ['wrapper', 'heading', 'body', 'paragraphs'] as const) {
      const c = option.classes[part];
      if (c) parts[part].push(c);
    }
  }
  return {
    wrapper: parts.wrapper.join(' '),
    box: look.box,
    heading: resolved.heading === HIDDEN_HEADING ? 'sr-only' : parts.heading.join(' '),
    body: parts.body.join(' '),
    paragraphs: parts.paragraphs.join(' '),
  };
}

/** The Template Options button's label, as APEX writes it: "Use Template
 *  Defaults" when the list says so, then the picked options by name. */
export function templateOptionsSummary(list: readonly string[] | undefined): string {
  const tokens = list ?? [DEFAULT_TOKEN];
  const names: string[] = [];
  if (tokens.includes(DEFAULT_TOKEN)) names.push('Use Template Defaults');
  for (const group of TEMPLATE_OPTION_GROUPS) {
    const pick = group.options.find(o => tokens.includes(o.id));
    if (pick) names.push(pick.label);
  }
  return names.length > 0 ? names.join(', ') : 'None';
}

/**
 * Parse the presets as the Appearance document stores them (`templates`:
 * template key → group key → option identifier). Lenient for the reader: the
 * shipped preset stands in for anything unusable; strict for the writer: every
 * problem is named. Absent is the shipped presets.
 */
export function parseTemplatePresets(raw: unknown): { value: TemplatePresets; problems: string[] } {
  const value = clonePresets(SHIPPED_PRESETS);
  if (raw === undefined || raw === null) return { value, problems: [] };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { value, problems: ['Templates must be an object of template → presets'] };
  const problems: string[] = [];
  for (const [key, presets] of Object.entries(raw as Record<string, unknown>)) {
    const template = REGION_TEMPLATES.find(t => t.key === key);
    if (!template) {
      problems.push(`Templates: names a template the code does not have (${key})`);
      continue;
    }
    if (!presets || typeof presets !== 'object' || Array.isArray(presets)) {
      problems.push(`Templates › ${template.label} must be an object of group → option`);
      continue;
    }
    for (const group of TEMPLATE_OPTION_GROUPS) {
      const id = (presets as Record<string, unknown>)[group.key];
      if (id === undefined) continue;
      if (typeof id === 'string' && group.options.some(o => o.id === id)) value[template.key][group.key] = id;
      else problems.push(`Templates › ${template.label} › ${group.label}: "${String(id)}" is not one of its options`);
    }
  }
  return { value, problems };
}
