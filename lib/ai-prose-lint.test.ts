import { describe, it, expect } from 'vitest';
import { lintAiProse, lintSummary, maskNonProse } from './ai-prose-lint';

function ids(md: string): string[] {
  return lintAiProse(md).map(f => f.id);
}

describe('maskNonProse', () => {
  it('blanks em-dashes inside inline code, fenced blocks, embeds and URLs', () => {
    const md = 'A `x — y` b\n\n```\nc — d\n```\n\n[[chart series=a—b]]\n\n[t](http://x.com/a—b) <http://y.com/—>';
    const masked = maskNonProse(md);
    expect(masked).not.toContain('—'); // every dash lived in code/embed/url
    expect(masked.length).toBe(md.length); // length preserved
    expect((masked.match(/\n/g) || []).length).toBe((md.match(/\n/g) || []).length); // newlines preserved
  });
  it('keeps prose text outside code/links', () => {
    expect(maskNonProse('real prose `code` more prose')).toContain('real prose');
    expect(maskNonProse('real prose `code` more prose')).toContain('more prose');
  });
});

describe('lintAiProse — dashes (error)', () => {
  it('flags every em-dash in prose', () => {
    const flags = lintAiProse('It was fast — very fast — indeed.');
    const em = flags.find(f => f.id === 'em-dash');
    expect(em?.severity).toBe('error');
    expect(em?.count).toBe(2);
  });
  it('does NOT flag em-dashes inside code or a URL', () => {
    expect(ids('`a — b` and [x](http://s/—)')).not.toContain('em-dash');
  });
  it('flags a space-padded en-dash but NOT tight ranges', () => {
    expect(ids('a gap – a lifetime')).toContain('en-dash-as-punctuation');
    expect(ids('P1–P5 over laps 10–15 in 2024–2026')).not.toContain('en-dash-as-punctuation');
  });
  it('em-dash match offset points at the dash in the raw string', () => {
    const md = 'abc — def';
    const em = lintAiProse(md).find(f => f.id === 'em-dash')!;
    expect(md[em.matches[0].start]).toBe('—');
  });
});

describe('lintAiProse — constructions & vocab (warning)', () => {
  it('flags "not only … but also"', () => {
    expect(ids('He was not only quick but also consistent.')).toContain('not-only-but-also');
  });
  it('flags the "not just X, it\'s Y" antithesis', () => {
    expect(ids("It's not just a win, it's a statement.")).toContain('antithesis');
  });
  it('flags AI-favoured vocab', () => {
    expect(ids('Let us delve into this rich tapestry.')).toEqual(expect.arrayContaining(['vocab-ai']));
  });
  it('flags filler transitions sentence-initial and mid-paragraph', () => {
    expect(ids('The pace was good. Furthermore, the tyres held.')).toContain('filler-transition');
    expect(ids('Moreover, it rained.')).toContain('filler-transition');
  });
  it('only flags intensifiers past the density threshold', () => {
    expect(ids('It was truly fast.')).not.toContain('intensifier');
    expect(ids('It was truly fast and genuinely remarkable.')).toContain('intensifier');
  });
});

describe('lintAiProse — motorsport false-positive guards', () => {
  it('does NOT flag a literal chicane navigation', () => {
    expect(ids('He navigates the chicane cleanly.')).not.toContain('navigate-metaphor');
  });
  it('flags the metaphorical navigate as info only', () => {
    const f = lintAiProse('teams navigate the complexities of the new rules');
    expect(f.find(x => x.id === 'navigate-metaphor')?.severity).toBe('info');
  });
  it('treats "boasts" as info, not warning (standard auto journalism)', () => {
    const f = lintAiProse('The car boasts 1000 horsepower.');
    const soft = f.find(x => x.id === 'soft-vocab');
    expect(soft?.severity).toBe('info');
  });
});

describe('lintSummary', () => {
  it('counts by severity', () => {
    const s = lintSummary(lintAiProse('Fast — quick. We delve into the tapestry.'));
    expect(s.errors).toBe(1); // one em-dash
    expect(s.warnings).toBeGreaterThanOrEqual(1); // vocab-ai
  });
  it('returns [] for empty input', () => {
    expect(lintAiProse('')).toEqual([]);
  });
});
