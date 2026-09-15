import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REGION_TEMPLATE,
  DEFAULT_TOKEN,
  REGION_TEMPLATES,
  SHIPPED_PRESETS,
  TEMPLATE_OPTION_GROUPS,
  optionById,
  parseTemplateOptions,
  parseTemplatePresets,
  presetOf,
  resolveTemplateOptions,
  templateOptionClasses,
  templateOptionsSummary,
  usesDefaults,
  type TemplatePresets,
} from './template-options';

const ROOMY: TemplatePresets = { standard: { ...SHIPPED_PRESETS.standard, spacing: 'SPACING_ROOMY' } };

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
    expect(REGION_TEMPLATES.map(t => t.key)).toEqual([DEFAULT_REGION_TEMPLATE]);
    expect(optionById('HEADING_HEADLINE')?.label).toBe('Headline');
    expect(optionById('NOPE')).toBeUndefined();
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
    const bad = parseTemplatePresets({ standard: { spacing: 'SPACING_HUGE', heading: 'RULE_ABOVE' }, hero: { spacing: 'SPACING_ROOMY' } });
    expect(bad.value).toEqual(SHIPPED_PRESETS);
    expect(bad.problems).toEqual([
      'Templates › Standard › Spacing: "SPACING_HUGE" is not one of its options',
      'Templates › Standard › Heading style: "RULE_ABOVE" is not one of its options',
      'Templates: names a template the code does not have (hero)',
    ]);
    expect(parseTemplatePresets('x').problems).toEqual(['Templates must be an object of template → presets']);
    expect(parseTemplatePresets({ standard: 'roomy' }).problems).toEqual(['Templates › Standard must be an object of group → option']);
  });
});
