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
const pills = (group: string) => screen.getByRole('group', { name: `Standard preset for ${group}` });
const pressed = (group: string) => within(pills(group)).getAllByRole('button').find(b => b.getAttribute('aria-pressed') === 'true')?.textContent;
const sample = () => document.querySelector('[data-template-sample] h2')?.getAttribute('class') ?? '';
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
  it('lists the Standard template with the five groups, the shipped preset pressed in each, a sample region drawn with them, and Save off', () => {
    render(<TemplatesEditor loaded={loaded} readOnly={false} onSaved={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Standard' })).toBeTruthy();
    expect(['Spacing', 'Heading style', 'Rule', 'Emphasis', 'Width'].map(pressed)).toEqual(['Standard', 'Label', 'None', 'Normal', 'Full']);
    expect(sample()).toContain('font-mono');
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
