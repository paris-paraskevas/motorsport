// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthzEditor, newSchemeProblem } from './AuthzEditor';
import type { EditableAuthzScheme } from '@/lib/design/authz';

const STAMP = '2026-09-08T18:00:00.505502+00:00';
const schemes: EditableAuthzScheme[] = [
  { key: 'public', label: 'Public', type: 'public', value: null, message: null, updatedAt: STAMP },
  { key: 'signed_in', label: 'Signed in', type: 'signed_in', value: null, message: 'Sign in to see this.', updatedAt: STAMP },
  { key: 'contributor', label: 'Contributor', type: 'author', value: null, message: 'For approved writers.', updatedAt: STAMP },
  { key: 'administrator', label: 'Administrator', type: 'role', value: 'admin', message: null, updatedAt: STAMP },
  { key: 'moderators', label: 'Moderators', type: 'role', value: 'moderator', message: null, updatedAt: STAMP },
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

describe('newSchemeProblem', () => {
  it('names what is missing or wrong, and is null for a good scheme', () => {
    const base = { key: 'staff', label: 'Staff', type: 'signed_in' as const, value: '', message: '' };
    expect(newSchemeProblem({ ...base, key: '' }, [])).toBe('needs a key');
    expect(newSchemeProblem({ ...base, key: 'Staff' }, [])).toMatch(/lower-case/);
    expect(newSchemeProblem({ ...base, key: 'public' }, [])).toBe('that key exists already');
    expect(newSchemeProblem(base, ['staff'])).toBe('that key exists already');
    expect(newSchemeProblem({ ...base, label: ' ' }, [])).toBe('needs a label');
    expect(newSchemeProblem({ ...base, type: 'role', value: '' }, [])).toMatch(/needs the role/);
    expect(newSchemeProblem({ ...base, type: 'email_domain', value: 'nope' }, [])).toMatch(/domain/);
    expect(newSchemeProblem({ ...base, type: 'email_domain', value: 'Example.com' }, [])).toBeNull();
    expect(newSchemeProblem(base, [])).toBeNull();
  });
});

describe('AuthzEditor', () => {
  it('marks the shipped four as shipped with no Remove, and a scheme of the operator’s own as theirs with Remove', () => {
    render(<AuthzEditor schemes={schemes} readOnly={false} onSaved={() => {}} />);
    expect(screen.getAllByText(/· shipped$/)).toHaveLength(4);
    expect(screen.getAllByText(/· yours$/)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Remove signed_in' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove moderators' })).toBeTruthy();
  });

  it('adds a scheme through the form once it is complete, and hands the new list up', async () => {
    const onSaved = vi.fn();
    const scheme = { key: 'staff', label: 'Staff', type: 'email_domain', value: '@paddock-tracker.com', message: 'Staff only.', updatedAt: STAMP };
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ ok: true, scheme }) });
    render(<AuthzEditor schemes={schemes} readOnly={false} onSaved={onSaved} />);
    const add = () => screen.getByRole('button', { name: 'Add scheme' }) as HTMLButtonElement;
    expect(add().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Key of the new scheme'), { target: { value: 'Staff' } });
    fireEvent.change(screen.getByLabelText('Name of the new scheme'), { target: { value: 'Staff' } });
    fireEvent.change(screen.getByLabelText('Check of the new scheme'), { target: { value: 'email_domain' } });
    expect(screen.getByText('an email check needs a domain such as @example.com')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Value of the new scheme'), { target: { value: 'paddock-tracker.com' } });
    fireEvent.change(screen.getByLabelText('Message of the new scheme'), { target: { value: 'Staff only.' } });
    expect(add().disabled).toBe(false);
    fireEvent.click(add());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith([...schemes, scheme]));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/design/authz');
    expect(JSON.parse(String(init.body))).toEqual({ key: 'staff', label: 'Staff', type: 'email_domain', value: 'paddock-tracker.com', message: 'Staff only.' });
  });

  it('removes a scheme of the operator’s own in two steps and hands the shorter list up; a 409 shows why and keeps the rows', async () => {
    const onSaved = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, key: 'moderators' }) });
    render(<AuthzEditor schemes={schemes} readOnly={false} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove moderators' }));
    expect(screen.getByText('Remove this scheme?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByText('Remove this scheme?')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove moderators' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(schemes.filter(s => s.key !== 'moderators')));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/design/authz/moderators');
    expect(init.method).toBe('DELETE');
    cleanup();
    onSaved.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'This scheme is still used by a page, a region or a navigation entry. Change those first.', current: schemes }) });
    render(<AuthzEditor schemes={schemes} readOnly={false} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove moderators' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await screen.findByText(/still used by a page/);
    expect(onSaved).toHaveBeenCalledWith(schemes);
  });

  it('read-only shows neither the form nor Remove', () => {
    render(<AuthzEditor schemes={schemes} readOnly onSaved={() => {}} />);
    expect(screen.queryByText('A scheme of your own')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove moderators' })).toBeNull();
  });
});
