// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DebugPanel } from './DebugPanel';
import { bindActions } from './DynamicActions';
import { resetClientEntries } from '@/lib/design/debug-client';
import type { DebugReport } from '@/lib/design/debug';

// The Debug panel (P1.9): the step graph above the rows, a click on a bar jumps
// to its step, the browser's own lines (the dynamic actions bound and fired)
// follow the server's, Export writes JSON, Refresh and Close call back.

const report: DebugReport = {
  cid: 'ab12cd34',
  level: 6,
  page: '/history/monza',
  startedAt: '2026-09-10T13:00:00.000Z',
  totalMs: 88.5,
  entries: [
    { at: 0, level: 4, phase: 'resolve', text: '/history/monza', ms: 20 },
    { at: 20, level: 4, phase: 'session', text: 'the visitor', ms: 8 },
    { at: 30, level: 4, phase: 'render', text: '2 components', ms: 55 },
    { at: 85, level: 4, phase: 'render:wire', text: 'The wire', ms: 41.5, src: ['snapshot:news:aggregate:'], run: 'news:aggregate:3 · warm-live-data#77 · 2026-09-10 11:21Z · F 1200ms · W 35ms' },
    { at: 86, level: 6, phase: 'authz:members', text: 'Members: scheme signed_in refused for you' },
  ],
};

beforeEach(() => {
  resetClientEntries();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('matchMedia', () => ({ matches: true, media: '', addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DebugPanel', () => {
  it("draws the step graph above the rows, a click jumps to the step, and the browser's own lines follow", () => {
    // A page's dynamic action bound and fired writes to the browser log the panel shows.
    document.body.innerHTML = '<div data-region="lead">Lead</div><div data-region="wire" hidden>Wire</div>';
    const unbind = bindActions([{ id: 'a1', name: 'Unfold', when: { event: 'click', region: 'lead' }, do: [{ action: 'toggle', region: 'wire' }] }], document);
    fireEvent.click(document.querySelector('[data-region="lead"]')!);
    unbind();
    render(<DebugPanel report={report} loading={false} onRefresh={vi.fn()} onClose={vi.fn()} />);
    const panel = screen.getByRole('dialog', { name: 'Debug' });
    expect(within(panel).getByText('id ab12cd34')).toBeTruthy();
    expect(within(panel).getByText('App Trace')).toBeTruthy();
    expect(within(panel).getByText('88.5 ms')).toBeTruthy();
    const bars = within(within(panel).getByLabelText('Step timing')).getAllByRole('button');
    expect(bars.map(b => b.title)).toEqual(['resolve 20 ms', 'session 8 ms', 'render 55 ms']);
    fireEvent.click(bars[2]);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(within(panel).getByText('render:wire')).toBeTruthy();
    expect(within(panel).getByText('snapshot:news:aggregate:')).toBeTruthy();
    expect(within(panel).getByText(/warm-live-data#77/)).toBeTruthy();
    expect(within(panel).getByText('authz:members')).toBeTruthy();
    expect(within(panel).getByText('bind')).toBeTruthy();
    expect(within(panel).getByText('1 dynamic action bound')).toBeTruthy();
    expect(within(panel).getByText('action:a1')).toBeTruthy();
    expect(within(panel).getByText('Unfold on click: toggle wire')).toBeTruthy();
  });

  it('exports the trace with the browser lines as JSON, refreshes and closes; says so while tracing', () => {
    const onRefresh = vi.fn();
    const onClose = vi.fn();
    const blobs: Blob[] = [];
    Object.assign(URL, { createObjectURL: vi.fn((b: Blob) => (blobs.push(b), 'blob:x')), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<DebugPanel report={report} loading={false} onRefresh={onRefresh} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(click).toHaveBeenCalled();
    expect(blobs).toHaveLength(1);
    expect(blobs[0].type).toBe('application/json');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close Debug' }));
    expect(onClose).toHaveBeenCalled();
    cleanup();
    render(<DebugPanel report={null} loading={true} onRefresh={onRefresh} onClose={onClose} />);
    expect(screen.getByText('tracing…')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Export' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
