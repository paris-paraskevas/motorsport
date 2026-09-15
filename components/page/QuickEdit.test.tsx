// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QuickEdit } from './QuickEdit';
import { SHIPPED_APPEARANCE } from '@/lib/design/appearance-defaults';

// Quick Edit (P1.7; APEX: Quick Edit Mode jumps into Page Designer for the
// component under the pointer, Escape or a click outside exits; Edit Live
// Template Options shows the wrench that opens the Live Template Options
// dialog). The region wrappers are the served page's (`data-region`).

const PAGE = 'a1b2c3d4-0000-4000-8000-000000000010';
const region = (id: string, over: Record<string, unknown> = {}) => ({ id, kind: 'static', title: id, position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: id, ...over });
const detail = (over: Record<string, unknown> = {}) => ({
  page: { id: PAGE, path: '/history/monza', name: 'Monza, a history' },
  live: { id: 'r1', createdAt: 'x', publishedAt: 'x', author: null, base: null },
  newest: { id: 'r1', createdAt: 'x', publishedAt: 'x', author: null, base: null, problems: [], document: { version: 2, actions: [], regions: [region('intro'), region('aside', { seq: 20 })] } },
  revisions: [],
  ...over,
});

const fetchMock = vi.fn();
const openMock = vi.fn();
type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
function serve(d: unknown = detail(), post: () => unknown = () => json(200, { revision: { id: 'r2' } })) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (method === 'POST') return post();
    if (url.includes('/appearance')) return json(200, { appearance: SHIPPED_APPEARANCE, updatedAt: 'x' });
    return json(200, d);
  });
}

function page() {
  return (
    <div>
      <div id="region-intro" data-region="intro">
        INTRO
      </div>
      <div id="region-aside" data-region="aside">
        ASIDE
      </div>
      <p>OUTSIDE</p>
      <div data-developer-toolbar="">
        <button type="button">Quick Edit</button>
      </div>
    </div>
  );
}
const intro = () => document.querySelector('[data-region="intro"]') as HTMLElement;

beforeEach(() => {
  calls = [];
  fetchMock.mockReset();
  serve();
  vi.stubGlobal('fetch', fetchMock);
  openMock.mockReset();
  vi.stubGlobal('open', openMock);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 10, left: 20, width: 300, height: 40, right: 320, bottom: 50, x: 20, y: 10, toJSON: () => ({}) } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('QuickEdit (P1.7)', () => {
  it('Quick Edit Mode: the region under the pointer is outlined with its id, a click opens the designer on it in the one developer tab, Escape and a click outside exit, a click on a region or the toolbar does not', () => {
    const onExit = vi.fn();
    render(
      <>
        {page()}
        <QuickEdit mode="jump" pageId={PAGE} designerTab="paddock-designer" onExit={onExit} />
      </>,
    );
    expect(screen.queryByRole('button', { name: /in the designer$/ })).toBeNull();
    fireEvent.mouseOver(intro());
    const outline = screen.getByRole('button', { name: 'Open intro in the designer' });
    expect(outline.style.top).toBe('10px');
    expect(outline.style.left).toBe('20px');
    expect(outline.style.width).toBe('300px');
    expect(outline.textContent).toContain('intro');
    fireEvent.click(outline);
    expect(openMock).toHaveBeenCalledWith(`/admin/designer?ws=builder&page=${PAGE}&region=intro`, 'paddock-designer');
    fireEvent.mouseDown(intro());
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Quick Edit' }));
    expect(onExit).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByText('OUTSIDE'));
    expect(onExit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
    // The outline follows the region on scroll and resize: the rectangle is read again.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 110, left: 20, width: 300, height: 40, right: 320, bottom: 150, x: 20, y: 110, toJSON: () => ({}) } as DOMRect);
    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('button', { name: 'Open intro in the designer' }).style.top).toBe('110px');
  });

  it('the wrench names a page that was never published, rather than a newer draft', async () => {
    serve(detail({ live: null, newest: { ...detail().newest, publishedAt: null } }));
    render(
      <>
        {page()}
        <QuickEdit mode="live" pageId={PAGE} designerTab="paddock-designer" onExit={vi.fn()} />
      </>,
    );
    fireEvent.mouseOver(intro());
    const wrench = await screen.findByRole('button', { name: 'Edit the template options of intro' });
    await waitFor(() => expect(wrench.title).toMatch(/never been published/));
    expect((wrench as HTMLButtonElement).disabled).toBe(true);
  });

  it('Edit Live Template Options: the wrench opens the Template Options dialog with the region’s stored list, OK publishes the running document with the new list on the live base and reloads; Escape closes the dialog alone', async () => {
    const onExit = vi.fn();
    const reload = vi.fn();
    render(
      <>
        {page()}
        <QuickEdit mode="live" pageId={PAGE} designerTab="paddock-designer" onExit={onExit} reload={reload} />
      </>,
    );
    fireEvent.mouseOver(intro());
    const wrench = await screen.findByRole('button', { name: 'Edit the template options of intro' });
    await waitFor(() => expect((wrench as HTMLButtonElement).disabled).toBe(false));
    expect(calls.map(c => c.url)).toEqual([`/api/admin/design/pages/${PAGE}`, '/api/admin/design/appearance']);
    fireEvent.click(wrench);
    const dialog = screen.getByRole('dialog', { name: 'Template Options' });
    expect((within(dialog).getByLabelText('Spacing') as HTMLSelectElement).options[0].textContent).toBe('Default (Standard)');
    // Escape closes the dialog alone: Quick Edit stays on.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onExit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit the template options of intro' }));
    const again = screen.getByRole('dialog', { name: 'Template Options' });
    fireEvent.change(within(again).getByLabelText('Heading style'), { target: { value: 'HEADING_HEADLINE' } });
    fireEvent.click(within(again).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    const post = calls.find(c => c.method === 'POST')!;
    expect(post.url).toBe(`/api/admin/design/pages/${PAGE}/revisions`);
    expect(post.body).toMatchObject({ action: 'publish', base: 'r1' });
    const doc = (post.body as { document: { regions: { id: string; templateOptions?: string[] }[] } }).document;
    expect(doc.regions.find(r => r.id === 'intro')?.templateOptions).toEqual(['#DEFAULT#', 'HEADING_HEADLINE']);
    expect(doc.regions.find(r => r.id === 'aside')).not.toHaveProperty('templateOptions');
  });

  it('the wrench is disabled with the reason when a draft newer than the running page exists or the running revision carries problems; a 409 says so and offers Reload', async () => {
    serve(detail({ newest: { ...detail().newest, id: 'r2', publishedAt: null } }));
    const reload = vi.fn();
    const { unmount } = render(
      <>
        {page()}
        <QuickEdit mode="live" pageId={PAGE} designerTab="paddock-designer" onExit={vi.fn()} reload={reload} />
      </>,
    );
    fireEvent.mouseOver(intro());
    const wrench = await screen.findByRole('button', { name: 'Edit the template options of intro' });
    await waitFor(() => expect(wrench.title).toMatch(/draft newer than the running page/));
    expect((wrench as HTMLButtonElement).disabled).toBe(true);
    unmount();
    cleanup();

    serve(detail({ newest: { ...detail().newest, problems: ['region x: broken'] } }));
    const second = render(
      <>
        {page()}
        <QuickEdit mode="live" pageId={PAGE} designerTab="paddock-designer" onExit={vi.fn()} reload={reload} />
      </>,
    );
    fireEvent.mouseOver(intro());
    const broken = await screen.findByRole('button', { name: 'Edit the template options of intro' });
    await waitFor(() => expect(broken.title).toMatch(/running revision has problems/));
    second.unmount();
    cleanup();

    serve(detail(), () => json(409, { error: 'This page was published again after you loaded it.' }));
    render(
      <>
        {page()}
        <QuickEdit mode="live" pageId={PAGE} designerTab="paddock-designer" onExit={vi.fn()} reload={reload} />
      </>,
    );
    fireEvent.mouseOver(intro());
    const ok = await screen.findByRole('button', { name: 'Edit the template options of intro' });
    await waitFor(() => expect((ok as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(ok);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Template Options' })).getByRole('button', { name: 'OK' }));
    await screen.findByText(/published again after this tab loaded it/);
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
