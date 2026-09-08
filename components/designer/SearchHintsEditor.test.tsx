// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchHintsEditor } from './SearchHintsEditor';
import type { EditableSearchHint } from '@/lib/design/search-hints';

const STAMP = '2026-09-08T18:00:00.505502+00:00';
const A = 'a1b2c3d4-0000-4000-8000-000000000001';
const B = 'a1b2c3d4-0000-4000-8000-000000000002';
const hints: EditableSearchHint[] = [
  { id: A, question: 'When is the next race?', seq: 10, leadsTo: '/calendar', leadsTitle: 'Calendar', updatedAt: STAMP },
  { id: B, question: 'Who leads the F1 standings?', seq: 20, leadsTo: '/series/f1/standings', leadsTitle: 'Formula 1 standings', updatedAt: STAMP },
];
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SearchHintsEditor', () => {
  it('lists the questions with where each leads, and adds one through the search', async () => {
    const onSaved = vi.fn();
    const added = { id: 'a1b2c3d4-0000-4000-8000-000000000003', question: 'How does a sprint weekend work?', seq: 30, leadsTo: '/information', leadsTitle: 'Information', updatedAt: STAMP };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ ok: true, hint: added }) });
    render(<SearchHintsEditor hints={hints} readOnly={false} onSaved={onSaved} />);
    expect(screen.getByRole('link', { name: /Calendar/ }).getAttribute('href')).toBe('/calendar');
    const add = () => screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement;
    expect(add().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('New question'), { target: { value: 'How does a sprint weekend work?' } });
    expect(screen.getByText('ready: the search is asked when you add it')).toBeTruthy();
    fireEvent.click(add());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith([...hints, added]));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/design/search-hints');
    expect(JSON.parse(String(init.body))).toEqual({ question: 'How does a sprint weekend work?' });
    expect(screen.getByText('Added; it leads to Information.')).toBeTruthy();
  });

  it('shows why a question was refused when the search finds nothing', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ error: 'This question leads nowhere: the site’s search finds nothing for it. Reword it so it finds a page.' }) });
    render(<SearchHintsEditor hints={hints} readOnly={false} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText('New question'), { target: { value: 'zzzz qqqq' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await screen.findByText(/leads nowhere/);
  });

  it('rewords a question through Save on its row, moves one, and removes one', async () => {
    const onSaved = vi.fn();
    const reworded = { ...hints[0], question: 'When is the next Grand Prix?', updatedAt: 'moved' };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, hint: reworded }) });
    render(<SearchHintsEditor hints={hints} readOnly={false} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Question 1'), { target: { value: 'When is the next Grand Prix?' } });
    expect(screen.getByText('reworded, not saved')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith([reworded, hints[1]]));
    let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/admin/design/search-hints/${A}`);
    expect(JSON.parse(String(init.body))).toEqual({ question: 'When is the next Grand Prix?', seq: 10, updatedAt: STAMP });

    onSaved.mockReset();
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, hint: { ...hints[1], seq: 10 } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, hint: { ...hints[0], seq: 20 } }) });
    fireEvent.click(screen.getByRole('button', { name: 'Move question 2 earlier' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith([{ ...hints[1], seq: 10 }, { ...hints[0], seq: 20 }]));

    onSaved.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, id: B }) });
    fireEvent.click(screen.getByRole('button', { name: 'Remove question 2' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith([hints[0]]));
    [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/admin/design/search-hints/${B}`);
    expect(init.method).toBe('DELETE');
  });

  it('read-only shows the questions and no controls', () => {
    render(<SearchHintsEditor hints={hints} readOnly onSaved={() => {}} />);
    expect((screen.getByLabelText('Question 1') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByLabelText('New question')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove question 1' })).toBeNull();
  });
});
