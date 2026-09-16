// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TemplatesEditor } from './TemplatesEditor';
import { SHIPPED_APPEARANCE } from '@/lib/design/appearance-defaults';
import { SHIPPED_PRESETS } from '@/lib/design/template-options';
import type { EditableAppearance } from '@/lib/design/appearance';

const STAMP = '2026-09-15T10:00:00.505502+00:00';
const loaded: EditableAppearance = { appearance: SHIPPED_APPEARANCE, updatedAt: STAMP };

const fetchMock = vi.fn();
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
// Five templates render at once (P1.1), so every helper is scoped to one of them; Plain, today's key `standard`, is the default.
const pills = (group: string, template = 'Plain') => screen.getByRole('group', { name: `${template} preset for ${group}` });
const pressed = (group: string, template = 'Plain') => within(pills(group, template)).getAllByRole('button').find(b => b.getAttribute('aria-pressed') === 'true')?.textContent;
const sample = (template = 'standard') => document.querySelector(`[data-template-sample="${template}"] h2`)?.getAttribute('class') ?? '';
const box = (template: string) => document.querySelector(`[data-template-sample="${template}"] [data-region-box]`)?.getAttribute('class') ?? null;
const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TemplatesEditor (the components programme, P1.2)', () => {
  it('lists the five templates with the five groups, each template’s shipped preset pressed, a sample region drawn in the look, and Save off (P1.1)', () => {
    render(<TemplatesEditor loaded={loaded} readOnly={false} onSaved={vi.fn()} />);
    for (const name of ['Plain', 'Boxed', 'Band', 'Aside', 'Hero']) expect(screen.getByRole('heading', { name })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Standard' })).toBeNull();
    const groups = ['Spacing', 'Heading style', 'Rule', 'Emphasis', 'Width'];
    expect(groups.map(g => pressed(g))).toEqual(['Standard', 'Label', 'None', 'Normal', 'Full']);
    expect(groups.map(g => pressed(g, 'Boxed'))).toEqual(['Standard', 'Label', 'None', 'Normal', 'Full']);
    expect(groups.map(g => pressed(g, 'Band'))).toEqual(['Standard', 'Label', 'None', 'Strong', 'Full']);
    expect(groups.map(g => pressed(g, 'Aside'))).toEqual(['Standard', 'Quiet label', 'None', 'Muted', 'Full']);
    expect(groups.map(g => pressed(g, 'Hero'))).toEqual(['Standard', 'Display', 'Below', 'Strong', 'Full']);
    // The sample wears the look: Plain no box, Boxed the card, Hero the display headline. Each names its counterpart (rule 3).
    expect(sample()).toContain('font-mono');
    expect(box('standard')).toBeNull();
    expect(box('boxed')).toContain('border-border');
    expect(box('band')).toContain('bg-surface-elevated');
    expect(sample('hero')).toContain('text-34');
    expect(screen.getByText('APEX: Content Block')).toBeTruthy();
    expect(screen.getAllByText('Ours').length).toBe(2);
    expect(save().disabled).toBe(true);
  });

  it('picking a preset arms Save and redraws the sample; Save puts the whole document with the stamp and hands back the answer', async () => {
    const onSaved = vi.fn();
    const next = { ...SHIPPED_APPEARANCE, templates: { standard: { ...SHIPPED_PRESETS.standard, heading: 'HEADING_HEADLINE' } } };
    fetchMock.mockResolvedValue(json(200, { ok: true, appearance: next, updatedAt: '2026-09-15T10:05:00.000001+00:00' }));
    render(<TemplatesEditor loaded={loaded} readOnly={false} onSaved={onSaved} />);
    fireEvent.click(within(pills('Heading style')).getByRole('button', { name: 'Headline' }));
    expect(pressed('Heading style')).toBe('Headline');
    expect(sample()).toContain('font-serif');
    expect(save().disabled).toBe(false);
    expect(screen.getByRole('status').textContent).toBe('Unsaved changes.');
    // Back to the shipped presets puts every group back; Discard changes puts the loaded document back.
    fireEvent.click(screen.getByRole('button', { name: 'Back to the shipped presets' }));
    expect(pressed('Heading style')).toBe('Label');
    expect(save().disabled).toBe(true);
    fireEvent.click(within(pills('Heading style')).getByRole('button', { name: 'Headline' }));
    fireEvent.click(screen.getByRole('button', { name: /Discard changes/ }));
    expect(pressed('Heading style')).toBe('Label');
    fireEvent.click(within(pills('Heading style')).getByRole('button', { name: 'Headline' }));
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/design/appearance');
    expect(init.method).toBe('PUT');
    const body = JSON.parse(String(init.body)) as { appearance: typeof SHIPPED_APPEARANCE; updatedAt: string };
    expect(body.updatedAt).toBe(STAMP);
    expect(body.appearance.faces).toEqual(SHIPPED_APPEARANCE.faces);
    expect(body.appearance.templates.standard.heading).toBe('HEADING_HEADLINE');
    expect(onSaved).toHaveBeenCalledWith({ appearance: next, updatedAt: '2026-09-15T10:05:00.000001+00:00' });
  });

  it('a moved stamp shows the conflict, and Reload hands the current document over', async () => {
    const onSaved = vi.fn();
    const current: EditableAppearance = { appearance: SHIPPED_APPEARANCE, updatedAt: '2026-09-15T10:03:00+00:00' };
    fetchMock.mockResolvedValue(json(409, { error: 'saved again', current }));
    render(<TemplatesEditor loaded={loaded} readOnly={false} onSaved={onSaved} />);
    fireEvent.click(within(pills('Spacing')).getByRole('button', { name: 'Roomy' }));
    fireEvent.click(save());
    await screen.findByText(/saved again after you loaded it/);
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onSaved).toHaveBeenCalledWith(current);
  });

  it('read-only, or no application row, disables the pills and Save', () => {
    render(<TemplatesEditor loaded={loaded} readOnly onSaved={vi.fn()} />);
    expect((within(pills('Spacing')).getByRole('button', { name: 'Roomy' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Read-only on this copy of the site.');
    cleanup();
    render(<TemplatesEditor loaded={{ appearance: SHIPPED_APPEARANCE, updatedAt: null }} readOnly={false} onSaved={vi.fn()} />);
    expect((within(pills('Width')).getByRole('button', { name: 'Narrow' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('No application row: read-only.');
  });
});
