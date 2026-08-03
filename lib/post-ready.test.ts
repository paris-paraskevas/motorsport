import { describe, expect, it } from 'vitest';
import { autoLinkBody, countHeadings, countInternalLinks, readinessChecks } from './post-ready';

const VER = { name: 'Max Verstappen', url: '/drivers/max-verstappen' };
const F1 = { name: 'Formula 1', url: '/series/f1' };

describe('counts', () => {
  it('counts ##/### headings only', () => {
    const body = '# h1\n## h2\n### h3\n#### h4\n##nospace\nplain';
    expect(countHeadings(body)).toBe(2);
  });

  it('counts internal links only', () => {
    const body = 'see [F1](/series/f1) and [FIA](https://fia.com) and [x](/drivers/a)';
    expect(countInternalLinks(body)).toBe(2);
  });
});

describe('readinessChecks', () => {
  it('applies the thresholds: 2+ headings, 1+ internal link', () => {
    const base = { summary: 's', seriesSlug: 'f1', heroImage: 'https://x/y.jpg' };
    const thin = readinessChecks({ ...base, body: '## one\nplain' });
    expect(thin.find(c => c.key === 'headings')?.ok).toBe(false);
    expect(thin.find(c => c.key === 'links')?.ok).toBe(false);
    const ready = readinessChecks({ ...base, body: '## one\n## two\n[x](/series/f1)' });
    expect(ready.find(c => c.key === 'headings')?.ok).toBe(true);
    expect(ready.find(c => c.key === 'links')?.ok).toBe(true);
  });

  it('treats null series and blank cover as not ok', () => {
    const checks = readinessChecks({ summary: 's', seriesSlug: null, heroImage: '  ', body: '' });
    expect(checks.find(c => c.key === 'series')?.ok).toBe(false);
    expect(checks.find(c => c.key === 'cover')?.ok).toBe(false);
  });
});

describe('autoLinkBody', () => {
  it('links the first mention only', () => {
    const { body, added } = autoLinkBody('Max Verstappen led. Max Verstappen won.', [VER]);
    expect(body).toBe('[Max Verstappen](/drivers/max-verstappen) led. Max Verstappen won.');
    expect(added).toEqual([{ name: 'Max Verstappen', url: '/drivers/max-verstappen' }]);
  });

  it('never touches masked regions: existing links, headings, quotes, code, embeds, URLs', () => {
    const src = [
      '## Max Verstappen wins',
      '> Max Verstappen said so',
      '`Max Verstappen`',
      '[Max Verstappen](/drivers/max-verstappen)',
      '[[chart series=f1]]',
      'https://example.com/Max Verstappen', // URL masks only the token; the name after the space is real prose
    ].join('\n');
    const { added } = autoLinkBody(src, [VER]);
    // The only linkable mention is the prose tail after the URL ("Verstappen"
    // alone is not the entity; the URL mask ends at the space) — the full name
    // is split by the mask, so nothing links.
    expect(added).toEqual([]);
  });

  it('prefers the longest name and never nests', () => {
    const KIMI = { name: 'Kimi Antonelli', url: '/drivers/kimi-antonelli' };
    const KIMI_SHORT = { name: 'Kimi', url: '/drivers/wrong' };
    const { body } = autoLinkBody('Kimi Antonelli was fastest.', [KIMI_SHORT, KIMI]);
    expect(body).toBe('[Kimi Antonelli](/drivers/kimi-antonelli) was fastest.');
  });

  it('is case-sensitive and boundary-guarded', () => {
    expect(autoLinkBody('formula 1 in lowercase', [F1]).added).toEqual([]);
    expect(autoLinkBody('Verstappenesque Max Verstappenesque', [VER]).added).toEqual([]);
  });

  it('handles Greek names on Unicode boundaries', () => {
    const GR = { name: 'Στέλιος Χριστόπουλος', url: '/authors/stylianos' };
    const { body, added } = autoLinkBody('Γράφει ο Στέλιος Χριστόπουλος σήμερα.', [GR]);
    expect(added).toHaveLength(1);
    expect(body).toContain('[Στέλιος Χριστόπουλος](/authors/stylianos)');
  });

  it('is insert-only: removing the added syntax reproduces the input', () => {
    const src = 'Max Verstappen beat the Formula 1 field.';
    const { body } = autoLinkBody(src, [VER, F1]);
    const stripped = body.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    expect(stripped).toBe(src);
  });

  it('dedupes duplicate entity names, first wins', () => {
    const dupe = [VER, { name: 'Max Verstappen', url: '/drivers/max-verstappen-24h' }];
    const { added } = autoLinkBody('Max Verstappen.', dupe);
    expect(added).toEqual([{ name: 'Max Verstappen', url: '/drivers/max-verstappen' }]);
  });
});
