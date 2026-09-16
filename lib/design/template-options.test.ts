import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REGION_TEMPLATE,
  DEFAULT_TOKEN,
  REGION_TEMPLATES,
  REGION_TEMPLATE_KEYS,
  SHIPPED_PRESETS,
  TEMPLATE_OPTION_GROUPS,
  isRegionTemplateKey,
  optionById,
  parseRegionTemplate,
  parseTemplateOptions,
  parseTemplatePresets,
  presetOf,
  regionTemplate,
  resolveTemplateOptions,
  templateOptionClasses,
  templateOptionsSummary,
  usesDefaults,
  type TemplatePresets,
} from './template-options';

const ROOMY: TemplatePresets = { ...SHIPPED_PRESETS, standard: { ...SHIPPED_PRESETS.standard, spacing: 'SPACING_ROOMY' } };

describe('the groups and the templates (the components programme, P1.2)', () => {
  it('has the five groups in the ledger’s order, unique upper-case identifiers, and the first option of each group as the shipped preset', () => {
    expect(TEMPLATE_OPTION_GROUPS.map(g => g.label)).toEqual(['Spacing', 'Heading style', 'Rule', 'Emphasis', 'Width']);
    const ids = TEMPLATE_OPTION_GROUPS.flatMap(g => g.options.map(o => o.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Z][A-Z0-9_]*$/);
    for (const g of TEMPLATE_OPTION_GROUPS) {
      expect(g.options.length).toBeGreaterThanOrEqual(3);
      expect(SHIPPED_PRESETS.standard[g.key]).toBe(g.options[0].id);
    }
    expect(REGION_TEMPLATES[0].key).toBe(DEFAULT_REGION_TEMPLATE);
    expect(optionById('HEADING_HEADLINE')?.label).toBe('Headline');
    expect(optionById('NOPE')).toBeUndefined();
  });
});

describe('the five region templates, the looks (the components programme, P1.1)', () => {
  it('names the five in the ledger’s order, today’s key kept under the label Plain, each with its Universal Theme counterpart or marked ours', () => {
    expect([...REGION_TEMPLATE_KEYS]).toEqual(['standard', 'boxed', 'band', 'aside', 'hero']);
    expect(REGION_TEMPLATES.map(t => t.label)).toEqual(['Plain', 'Boxed', 'Band', 'Aside', 'Hero']);
    expect(REGION_TEMPLATES.map(t => t.apex)).toEqual(['Content Block', 'Standard', null, null, 'Hero']);
    expect(REGION_TEMPLATES.filter(t => t.bleeds).map(t => t.key)).toEqual(['band']);
    expect(regionTemplate('boxed').label).toBe('Boxed');
    expect(regionTemplate('nope' as never).key).toBe('standard');
    expect(isRegionTemplateKey('aside')).toBe(true);
    expect(isRegionTemplateKey('Aside')).toBe(false);
  });

  it('adds the options the looks need to the global groups, first options unchanged, and ships a preset per template', () => {
    expect(TEMPLATE_OPTION_GROUPS.find(g => g.key === 'heading')?.options.map(o => o.id)).toEqual(['HEADING_LABEL', 'HEADING_HEADLINE', 'HEADING_DISPLAY', 'HEADING_QUIET', 'HEADING_HIDDEN']);
    expect(TEMPLATE_OPTION_GROUPS.find(g => g.key === 'emphasis')?.options.map(o => o.id)).toEqual(['EMPHASIS_NORMAL', 'EMPHASIS_MUTED', 'EMPHASIS_ACCENT', 'EMPHASIS_STRONG']);
    expect(optionById('HEADING_DISPLAY')?.label).toBe('Display');
    expect(optionById('HEADING_QUIET')?.label).toBe('Quiet label');
    expect(optionById('EMPHASIS_STRONG')?.classes).toEqual({ body: 'text-text' });
    expect(SHIPPED_PRESETS.boxed).toEqual(SHIPPED_PRESETS.standard);
    expect(SHIPPED_PRESETS.band).toEqual({ ...SHIPPED_PRESETS.standard, emphasis: 'EMPHASIS_STRONG' });
    expect(SHIPPED_PRESETS.aside).toEqual({ ...SHIPPED_PRESETS.standard, heading: 'HEADING_QUIET', emphasis: 'EMPHASIS_MUTED' });
    expect(SHIPPED_PRESETS.hero).toEqual({ ...SHIPPED_PRESETS.standard, heading: 'HEADING_DISPLAY', rule: 'RULE_BELOW', emphasis: 'EMPHASIS_STRONG' });
    expect(presetOf('heading', SHIPPED_PRESETS, 'hero')).toBe('HEADING_DISPLAY');
    expect(resolveTemplateOptions(undefined, SHIPPED_PRESETS, 'hero')).toMatchObject({ heading: 'HEADING_DISPLAY', rule: 'RULE_BELOW', emphasis: 'EMPHASIS_STRONG' });
    // A region’s own pick still beats its template’s preset.
    expect(resolveTemplateOptions([DEFAULT_TOKEN, 'HEADING_LABEL'], SHIPPED_PRESETS, 'hero').heading).toBe('HEADING_LABEL');
  });

  it('dresses each look: a box of its own inside the cell, the body’s base type, the presets on the parts; Plain and Hero draw no box', () => {
    const plain = templateOptionClasses(resolveTemplateOptions(undefined, SHIPPED_PRESETS, 'standard'), 'standard');
    expect(plain.box).toBe('');
    expect(plain.body).toBe('font-serif text-16 leading-relaxed text-text-muted');
    const boxed = templateOptionClasses(resolveTemplateOptions(undefined, SHIPPED_PRESETS, 'boxed'), 'boxed');
    expect(boxed.box).toBe('border border-border bg-surface p-4');
    expect(boxed.body).toBe(plain.body);
    expect(boxed.heading).toBe(plain.heading);
    const band = templateOptionClasses(resolveTemplateOptions(undefined, SHIPPED_PRESETS, 'band'), 'band');
    expect(band.box).toBe('border-y border-border bg-surface-elevated py-6 px-4 md:px-6 lg:px-8');
    expect(band.body).toBe('font-serif text-16 leading-relaxed text-text');
    const aside = templateOptionClasses(resolveTemplateOptions(undefined, SHIPPED_PRESETS, 'aside'), 'aside');
    expect(aside.box).toBe('border-l-2 border-brand pl-4');
    expect(aside.body).toBe('font-serif text-15 leading-relaxed text-text-faint');
    expect(aside.heading).toContain('text-text-faint');
    expect(aside.heading).not.toContain('border-b');
    const hero = templateOptionClasses(resolveTemplateOptions(undefined, SHIPPED_PRESETS, 'hero'), 'hero');
    expect(hero.box).toBe('');
    expect(hero.heading.split(' ')).toEqual(expect.arrayContaining(['mb-3', 'font-serif', 'text-34', 'md:text-40', 'text-text']));
    expect(hero.heading).not.toContain('font-mono');
    expect(hero.body).toBe('font-serif text-20 leading-snug text-text');
    expect(hero.wrapper.split(' ')).toEqual(expect.arrayContaining(['border-b', 'border-border', 'pb-4']));
    // Without a template the classes are Plain’s: what every stored region drew before this slot.
    expect(templateOptionClasses(resolveTemplateOptions(undefined, SHIPPED_PRESETS))).toEqual(plain);
  });

  it('parses a region’s template: absent, empty and the default read as absent; a look is kept; anything else is a problem for the writer', () => {
    expect(parseRegionTemplate(undefined)).toEqual({ value: undefined });
    expect(parseRegionTemplate(null)).toEqual({ value: undefined });
    expect(parseRegionTemplate('')).toEqual({ value: undefined });
    expect(parseRegionTemplate('standard')).toEqual({ value: undefined });
    expect(parseRegionTemplate('boxed')).toEqual({ value: 'boxed' });
    expect(parseRegionTemplate('nope')).toEqual({ value: undefined, problem: 'the template must be one of standard, boxed, band, aside, hero' });
    expect(parseRegionTemplate(3)).toEqual({ value: undefined, problem: 'the template must be one of standard, boxed, band, aside, hero' });
  });
});

describe('parseTemplateOptions', () => {
  it('reads absent as absent, canonicalises the list with #DEFAULT# first and the identifiers in group order, and leaves out a list that only says defaults', () => {
    expect(parseTemplateOptions(undefined)).toEqual({ value: undefined, problems: [] });
    expect(parseTemplateOptions(null)).toEqual({ value: undefined, problems: [] });
    expect(parseTemplateOptions([DEFAULT_TOKEN])).toEqual({ value: undefined, problems: [] });
    expect(parseTemplateOptions(['WIDTH_READING', 'SPACING_COMPACT', DEFAULT_TOKEN, 'SPACING_COMPACT'])).toEqual({
      value: [DEFAULT_TOKEN, 'SPACING_COMPACT', 'WIDTH_READING'],
      problems: [],
    });
    expect(parseTemplateOptions([])).toEqual({ value: [], problems: [] });
  });

  it('refuses what is not a list of strings, an identifier the code does not have, and two options of one group', () => {
    expect(parseTemplateOptions('SPACING_COMPACT').problems).toEqual(['the template options must be a list']);
    expect(parseTemplateOptions([3]).problems).toEqual(['the template options must be a list of identifiers']);
    expect(parseTemplateOptions(['SPACING_HUGE']).problems).toEqual(['names a template option the code does not have (SPACING_HUGE)']);
    expect(parseTemplateOptions(['SPACING_COMPACT', 'SPACING_ROOMY']).problems).toEqual(['picks two options of Spacing (SPACING_COMPACT, SPACING_ROOMY)']);
  });
});

describe('resolveTemplateOptions', () => {
  it('a pick beats the preset, the preset beats the first option under #DEFAULT#, and the first option applies with the defaults off', () => {
    expect(resolveTemplateOptions(undefined, SHIPPED_PRESETS)).toEqual({
      spacing: 'SPACING_STANDARD',
      heading: 'HEADING_LABEL',
      rule: 'RULE_NONE',
      emphasis: 'EMPHASIS_NORMAL',
      width: 'WIDTH_FULL',
    });
    expect(resolveTemplateOptions(undefined, ROOMY).spacing).toBe('SPACING_ROOMY');
    expect(resolveTemplateOptions([DEFAULT_TOKEN, 'SPACING_COMPACT'], ROOMY).spacing).toBe('SPACING_COMPACT');
    expect(resolveTemplateOptions([DEFAULT_TOKEN, 'HEADING_HIDDEN'], ROOMY)).toMatchObject({ spacing: 'SPACING_ROOMY', heading: 'HEADING_HIDDEN' });
    expect(resolveTemplateOptions([], ROOMY).spacing).toBe('SPACING_STANDARD');
    expect(resolveTemplateOptions(['RULE_BELOW'], ROOMY)).toMatchObject({ spacing: 'SPACING_STANDARD', rule: 'RULE_BELOW' });
    expect(usesDefaults(undefined)).toBe(true);
    expect(usesDefaults([DEFAULT_TOKEN, 'RULE_BELOW'])).toBe(true);
    expect(usesDefaults([])).toBe(false);
    expect(presetOf('spacing', ROOMY)).toBe('SPACING_ROOMY');
    expect(presetOf('spacing', ROOMY, 'standard')).toBe('SPACING_ROOMY');
  });

  it('composes the classes per part: the shipped options draw the region as today, and each option adds only its own part', () => {
    const today = templateOptionClasses(resolveTemplateOptions(undefined, SHIPPED_PRESETS));
    expect(today.wrapper).toBe('');
    expect(today.heading.split(' ').sort()).toEqual('mb-3 border-b border-text pb-1 font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted'.split(' ').sort());
    expect(today.body).toBe('font-serif text-16 leading-relaxed text-text-muted');
    expect(today.paragraphs).toBe('space-y-3');

    const styled = templateOptionClasses(resolveTemplateOptions(['SPACING_ROOMY', 'HEADING_HEADLINE', 'RULE_BOTH', 'EMPHASIS_ACCENT', 'WIDTH_READING'], SHIPPED_PRESETS));
    expect(styled.wrapper.split(' ')).toEqual(expect.arrayContaining(['py-4', 'border-t', 'border-b', 'border-border', 'pt-4', 'pb-4', 'border-l-2', 'border-brand', 'pl-4', 'max-w-[65ch]']));
    expect(styled.heading).toContain('font-serif');
    expect(styled.heading).not.toContain('border-b');
    expect(styled.heading).toContain('mb-5');
    expect(styled.paragraphs).toBe('space-y-6');

    const hidden = templateOptionClasses(resolveTemplateOptions(['HEADING_HIDDEN', 'EMPHASIS_MUTED', 'SPACING_COMPACT'], SHIPPED_PRESETS));
    expect(hidden.heading).toBe('sr-only');
    expect(hidden.body).toContain('text-text-faint');
    expect(hidden.body).not.toContain('text-text-muted');
    expect(hidden.paragraphs).toBe('space-y-1.5');
  });
});

describe('templateOptionsSummary', () => {
  it('reads as APEX’s button label: Use Template Defaults, then the picked options by name; None when nothing is on', () => {
    expect(templateOptionsSummary(undefined)).toBe('Use Template Defaults');
    expect(templateOptionsSummary([DEFAULT_TOKEN, 'SPACING_COMPACT', 'RULE_ABOVE'])).toBe('Use Template Defaults, Compact, Above');
    expect(templateOptionsSummary(['HEADING_HEADLINE'])).toBe('Headline');
    expect(templateOptionsSummary([])).toBe('None');
  });
});

describe('parseTemplatePresets', () => {
  it('an absent document is the shipped presets; a known preset is kept; the rest fall back and are named', () => {
    expect(parseTemplatePresets(undefined)).toEqual({ value: SHIPPED_PRESETS, problems: [] });
    expect(parseTemplatePresets({ standard: { spacing: 'SPACING_ROOMY' } })).toEqual({ value: ROOMY, problems: [] });
    // A document from before the five looks names Plain alone: the other four read shipped. A look’s own preset is kept.
    expect(parseTemplatePresets({ boxed: { rule: 'RULE_BOTH' } })).toEqual({ value: { ...SHIPPED_PRESETS, boxed: { ...SHIPPED_PRESETS.boxed, rule: 'RULE_BOTH' } }, problems: [] });
    const bad = parseTemplatePresets({ standard: { spacing: 'SPACING_HUGE', heading: 'RULE_ABOVE' }, carousel: { spacing: 'SPACING_ROOMY' } });
    expect(bad.value).toEqual(SHIPPED_PRESETS);
    expect(bad.problems).toEqual([
      'Templates › Plain › Spacing: "SPACING_HUGE" is not one of its options',
      'Templates › Plain › Heading style: "RULE_ABOVE" is not one of its options',
      'Templates: names a template the code does not have (carousel)',
    ]);
    expect(parseTemplatePresets('x').problems).toEqual(['Templates must be an object of template → presets']);
    expect(parseTemplatePresets({ standard: 'roomy' }).problems).toEqual(['Templates › Plain must be an object of group → option']);
  });
});
