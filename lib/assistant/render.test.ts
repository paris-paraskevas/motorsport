import { describe, it, expect } from 'vitest';
import { parseInline } from './render';

describe('parseInline', () => {
  it('plain text is one text token', () => {
    expect(parseInline('just some text')).toEqual([{ kind: 'text', text: 'just some text' }]);
  });

  it('parses an internal link', () => {
    expect(parseInline('[Standings](/series/f1/standings)')).toEqual([
      { kind: 'link', text: 'Standings', href: '/series/f1/standings', external: false },
    ]);
  });

  it('marks http(s) links external', () => {
    expect(parseInline('[F1 TV](https://f1tv.formula1.com/)')).toEqual([
      { kind: 'link', text: 'F1 TV', href: 'https://f1tv.formula1.com/', external: true },
    ]);
  });

  it('parses bold', () => {
    expect(parseInline('see **series** now')).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'bold', text: 'series' },
      { kind: 'text', text: ' now' },
    ]);
  });

  it('mixes text and a link', () => {
    expect(parseInline('Open [Calendar](/calendar) to see it')).toEqual([
      { kind: 'text', text: 'Open ' },
      { kind: 'link', text: 'Calendar', href: '/calendar', external: false },
      { kind: 'text', text: ' to see it' },
    ]);
  });

  it('never turns a bare path into a link', () => {
    expect(parseInline('go to /calendar')).toEqual([{ kind: 'text', text: 'go to /calendar' }]);
  });

  it('refuses non-http/non-internal schemes (no injection surface)', () => {
    // javascript:/data: hrefs never match the link pattern → stay literal text.
    expect(parseInline('[x](javascript:alert(1))')).toEqual([
      { kind: 'text', text: '[x](javascript:alert(1))' },
    ]);
  });
});
