import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './content';

// Security-audit coverage for the sanitised markdown→HTML pipeline. The output
// of renderMarkdown feeds dangerouslySetInnerHTML in the blog + the file-backed
// legal/About/History tabs, so these tests pin BOTH halves of the contract:
//   1. dangerous HTML is stripped (the XSS fix), and
//   2. the constructs operator content actually uses survive unchanged.

describe('renderMarkdown — sanitisation (XSS fix)', () => {
  it('drops <script> tags', async () => {
    const html = await renderMarkdown('Hello <script>alert(1)</script> world');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
    expect(html).toContain('Hello');
    expect(html).toContain('world');
  });

  it('strips javascript: URLs from links but keeps the text', async () => {
    const html = await renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('click');
  });

  it('strips inline event-handler attributes', async () => {
    const html = await renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });

  it('strips <iframe> embeds', async () => {
    const html = await renderMarkdown('<iframe src="https://evil.example"></iframe>');
    expect(html).not.toContain('<iframe');
  });

  it('strips style attributes / <style> blocks', async () => {
    const html = await renderMarkdown('<div style="position:fixed">x</div>');
    expect(html).not.toContain('style=');
  });
});

describe('renderMarkdown — trusted content is preserved', () => {
  it('renders GFM tables', async () => {
    const html = await renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>1</td>');
  });

  it('renders markdown hard-breaks as <br> (legal address blocks)', async () => {
    const html = await renderMarkdown('Line one  \nLine two');
    expect(html).toMatch(/<br\s*\/?>/);
  });

  it('keeps safe https links with their href', async () => {
    const html = await renderMarkdown('[F1](https://www.formula1.com)');
    expect(html).toContain('href="https://www.formula1.com"');
  });

  it('renders headings, emphasis and blockquotes', async () => {
    const html = await renderMarkdown('## Heading\n\n**bold** _em_\n\n> quote');
    expect(html).toContain('<h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>em</em>');
    expect(html).toContain('<blockquote>');
  });

  it('returns empty string for blank input', async () => {
    expect(await renderMarkdown('   ')).toBe('');
  });
});

describe('renderMarkdown — footnote anchors line up', () => {
  it('produces matching footnote ids and hrefs (in-page scroll works)', async () => {
    const html = await renderMarkdown('A claim.[^1]\n\n[^1]: The source.');

    // The note + backref targets must exist as real element ids.
    expect(html).toContain('id="user-content-fn-1"');
    expect(html).toContain('id="user-content-fnref-1"');

    // Every footnote href must resolve to an element id present in the output,
    // i.e. no dangling anchors (this is exactly what the doubled-prefix bug
    // breaks — href="#user-content-fn-1" vs id="user-content-user-content-fn-1").
    const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const target of hrefs) {
      expect(ids.has(target)).toBe(true);
    }

    // And the prefix must not have been doubled.
    expect(html).not.toContain('user-content-user-content-');
  });
});
