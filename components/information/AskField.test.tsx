import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AskField } from './AskField';

describe('AskField', () => {
  it('shows its whole hint on a phone: the 12px mono field at 390px holds about forty characters, so the placeholder stays within that and keeps an example (the operator’s report, 2026-09-26)', () => {
    const html = renderToStaticMarkup(<AskField entries={[]} />);
    const placeholder = /placeholder="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(placeholder.length).toBeGreaterThan(0);
    expect(placeholder.length).toBeLessThanOrEqual(40);
    expect(placeholder).toContain('what is DRS');
  });
});
