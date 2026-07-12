import { describe, it, expect } from 'vitest';
import { parseBodySegments, parseEmbedArgs, renderPostBody, renderPreviewHtml } from './blog-embeds';
import { renderMarkdown } from './content';

describe('parseEmbedArgs', () => {
  it('parses unquoted, double-quoted and single-quoted values', () => {
    expect(parseEmbedArgs('series=f1 title="Two words" note=\'a b\'')).toEqual({
      series: 'f1',
      title: 'Two words',
      note: 'a b',
    });
  });

  it('lowercases keys and returns {} for no args', () => {
    expect(parseEmbedArgs('Series=f1')).toEqual({ series: 'f1' });
    expect(parseEmbedArgs('')).toEqual({});
  });
});

describe('parseBodySegments', () => {
  it('returns a single markdown segment when there are no embeds', () => {
    const segs = parseBodySegments('# Hello\n\nSome **prose** here.');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ kind: 'markdown', text: '# Hello\n\nSome **prose** here.' });
  });

  it('splits an own-line shortcode into markdown / embed / markdown', () => {
    const segs = parseBodySegments('Intro line.\n\n[[chart series=f1]]\n\nOutro line.');
    expect(segs.map(s => s.kind)).toEqual(['markdown', 'embed', 'markdown']);
    expect(segs[1]).toEqual({ kind: 'embed', spec: { type: 'chart', args: { series: 'f1' } } });
    expect((segs[0] as { text: string }).text).toContain('Intro line.');
    expect((segs[2] as { text: string }).text).toContain('Outro line.');
  });

  it('ignores a `[[...]]` that is not the whole line', () => {
    const segs = parseBodySegments('See [[chart series=f1]] inline, not an embed.');
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe('markdown');
  });

  it('does not treat shortcodes inside a fenced code block as embeds', () => {
    const body = 'Before.\n\n```\n[[chart series=f1]]\n```\n\nAfter.';
    const segs = parseBodySegments(body);
    expect(segs.map(s => s.kind)).toEqual(['markdown']);
    expect((segs[0] as { text: string }).text).toContain('[[chart series=f1]]');
  });

  it('drops the empty run between two adjacent embeds', () => {
    const segs = parseBodySegments('[[chart series=f1]]\n\n[[standings series=f1]]');
    expect(segs.map(s => s.kind)).toEqual(['embed', 'embed']);
  });

  it('returns [] for an empty body', () => {
    expect(parseBodySegments('')).toEqual([]);
    expect(parseBodySegments('   \n\n')).toEqual([]);
  });
});

describe('renderPostBody', () => {
  it('renders markdown runs to html and passes embed specs through', async () => {
    const { segments } = await renderPostBody('## Title\n\nBody text.\n\n[[chart series=f1]]');
    expect(segments.map(s => s.kind)).toEqual(['html', 'embed']);
    expect((segments[0] as { html: string }).html).toContain('Body text.');
    expect(segments[1]).toEqual({ kind: 'embed', spec: { type: 'chart', args: { series: 'f1' } } });
  });

  it('keeps heading ids unique + ToC aligned across an embed boundary', async () => {
    const { segments, toc } = await renderPostBody(
      '## Recap\n\ntext\n\n[[chart series=f1]]\n\n## Recap\n\nmore',
    );
    expect(toc.map(t => t.id)).toEqual(['recap', 'recap-1']);
    const htmlA = (segments[0] as { html: string }).html;
    const htmlC = (segments[2] as { html: string }).html;
    expect(htmlA).toContain('id="recap"');
    expect(htmlC).toContain('id="recap-1"');
  });
});

describe('renderPreviewHtml', () => {
  it('is byte-identical to renderMarkdown for a body with no embeds', async () => {
    const md = '## Heading\n\nSome **prose** with a [link](https://x.test) and a list:\n\n- one\n- two';
    expect(await renderPreviewHtml(md)).toEqual(await renderMarkdown(md));
  });

  it('renders an embed as a labelled placeholder, not the live widget or raw shortcode', async () => {
    const html = await renderPreviewHtml('Intro.\n\n[[chart series=f1]]\n\nOutro.');
    expect(html).toContain('chart embed');
    expect(html).toContain('series=f1');
    expect(html).not.toContain('[[chart'); // not the raw token
    expect(html).toContain('Intro.');
    expect(html).toContain('Outro.');
  });

  it('escapes author-controlled arg values in the placeholder', async () => {
    const html = await renderPreviewHtml('[[chart series="a<b>c"]]');
    expect(html).not.toContain('a<b>');
    expect(html).toContain('a&lt;b&gt;c');
  });
});
