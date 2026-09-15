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

/** The region templates (APEX: region templates; P1.1 brings the five looks).
 *  One today: the region as the site draws it, named as the Universal Theme
 *  names its default region template. */
export const REGION_TEMPLATE_KEYS = ['standard'] as const;
export type RegionTemplateKey = (typeof REGION_TEMPLATE_KEYS)[number];
export const DEFAULT_REGION_TEMPLATE: RegionTemplateKey = 'standard';
export const REGION_TEMPLATES: readonly { key: RegionTemplateKey; label: string; description: string }[] = [
  { key: 'standard', label: 'Standard', description: 'The region as the site draws it: the title as a small label over the content, no box, no rule.' },
];

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
      { id: 'EMPHASIS_ACCENT', label: 'Accent', help: 'A rule in the brand colour on the region’s left, the content indented from it.', classes: { wrapper: 'border-l-2 border-brand pl-4', body: 'text-text-muted' } },
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

/** What the code ships: the first option of every group, on every template. */
export const SHIPPED_PRESETS: TemplatePresets = Object.fromEntries(
  REGION_TEMPLATE_KEYS.map(t => [t, Object.fromEntries(TEMPLATE_OPTION_GROUPS.map(g => [g.key, g.options[0].id]))]),
) as TemplatePresets;

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
  /** The region's title element. */
  heading: string;
  /** The body text (a paragraph, a caption's lead). */
  body: string;
  /** The container of the paragraphs: their gap. */
  paragraphs: string;
}

const BODY_BASE = 'font-serif text-16 leading-relaxed';

/** The Heading style option that draws no title; the heading part is then
 *  `sr-only` alone, with no gap from Spacing, since nothing is drawn. */
export const HIDDEN_HEADING = 'HEADING_HIDDEN';

/** The classes per part for a resolved set, the options' fragments joined in
 *  group order; the body's base type comes first, then Emphasis's colour. */
export function templateOptionClasses(resolved: Record<TemplateOptionGroupKey, string>): TemplateOptionClasses {
  const parts: Record<RegionPart, string[]> = { wrapper: [], heading: [], body: [BODY_BASE], paragraphs: [] };
  for (const group of TEMPLATE_OPTION_GROUPS) {
    const option = group.options.find(o => o.id === resolved[group.key]) ?? group.options[0];
    for (const part of ['wrapper', 'heading', 'body', 'paragraphs'] as const) {
      const c = option.classes[part];
      if (c) parts[part].push(c);
    }
  }
  return {
    wrapper: parts.wrapper.join(' '),
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
