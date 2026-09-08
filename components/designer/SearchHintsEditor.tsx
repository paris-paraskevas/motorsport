'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { SEARCH_HINT_MAX, searchHintProblem } from '@/lib/design/search-hint-defaults';
import type { EditableSearchHint } from '@/lib/design/search-hints';

// Search Hints (the alive search placeholder): the questions the header's
// search field shows in turn, a minute apart, after the first paint. Each is
// asked of the site's own search when it is added or reworded, and refused
// when it finds nothing, so the field never suggests a dead end. The list is
// the operator's: add, reword, move, remove, each through its own conditional
// statement on the row's stamp.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
const PBTN =
  'inline-flex items-center gap-1 border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-35';
const FIELD =
  'w-full border border-border-strong bg-bg px-2 py-1 text-12-5 leading-snug text-text focus:border-edit focus:outline-none disabled:opacity-60';

export function SearchHintsEditor({
  hints,
  readOnly,
  onSaved,
}: {
  hints: EditableSearchHint[];
  readOnly: boolean;
  onSaved: (hints: EditableSearchHint[]) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [conflict, setConflict] = useState<EditableSearchHint[] | null>(null);

  // New rows from the server replace the drafts (adjusted during render).
  const [seen, setSeen] = useState(hints);
  if (hints !== seen) {
    setSeen(hints);
    setDraft({});
    setConflict(null);
  }

  const textOf = (h: EditableSearchHint) => draft[h.id] ?? h.question;
  const addProblem = question ? searchHintProblem(question) : 'needs a question';

  async function call(method: 'POST' | 'PUT' | 'DELETE', url: string, body: unknown, what: string): Promise<{ hint?: EditableSearchHint } | null> {
    setBusy(what);
    setError(null);
    setNote(null);
    setConflict(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; hint?: EditableSearchHint; current?: EditableSearchHint[] | null };
      if (res.status === 409) {
        setConflict(d.current ?? []);
        return null;
      }
      if (!res.ok) {
        setError(d.error ?? `failed (${res.status})`);
        return null;
      }
      return d;
    } catch {
      setError('Network error. Try again.');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    if (busy || readOnly || addProblem) return;
    const d = await call('POST', '/api/admin/design/search-hints', { question }, 'add');
    if (d?.hint) {
      setQuestion('');
      setNote(`Added; it leads to ${d.hint.leadsTitle ?? d.hint.leadsTo ?? 'a page'}.`);
      onSaved([...hints, d.hint]);
    }
  }

  async function reword(h: EditableSearchHint) {
    const q = textOf(h).trim();
    if (busy || readOnly || q === h.question || searchHintProblem(q)) return;
    const d = await call('PUT', `/api/admin/design/search-hints/${h.id}`, { question: q, seq: h.seq, updatedAt: h.updatedAt }, h.id);
    if (d?.hint) {
      setNote(`Saved; it leads to ${d.hint.leadsTitle ?? d.hint.leadsTo ?? 'a page'}.`);
      onSaved(hints.map(x => (x.id === h.id ? d.hint! : x)));
    }
  }

  async function move(h: EditableSearchHint, dir: -1 | 1) {
    const i = hints.findIndex(x => x.id === h.id);
    const other = hints[i + dir];
    if (busy || readOnly || !other) return;
    // Two conditional updates, the neighbour's sequence taken and given back.
    const first = await call('PUT', `/api/admin/design/search-hints/${h.id}`, { question: h.question, seq: other.seq, updatedAt: h.updatedAt }, h.id);
    if (!first?.hint) return;
    const second = await call('PUT', `/api/admin/design/search-hints/${other.id}`, { question: other.question, seq: h.seq, updatedAt: other.updatedAt }, other.id);
    if (!second?.hint) return;
    onSaved(hints.map(x => (x.id === h.id ? first.hint! : x.id === other.id ? second.hint! : x)).sort((a, b) => a.seq - b.seq));
  }

  async function remove(h: EditableSearchHint) {
    if (busy || readOnly) return;
    const d = await call('DELETE', `/api/admin/design/search-hints/${h.id}`, undefined, h.id);
    if (d) onSaved(hints.filter(x => x.id !== h.id));
  }

  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Search Hints</h2>
      <p className="m-0 mb-4 max-w-[70ch] text-13 text-text-muted">
        Questions the header’s search field shows in turn, a minute apart, once the page has painted; before that, and
        for anyone who prefers reduced motion, it shows the text message “Browse the site, or search it”. Each question
        is asked of the site’s own search when it is added or reworded, and refused if it finds nothing, so the field
        never suggests a dead end.
      </p>

      {hints.length === 0 ? (
        <p className="mb-4 border border-dashed border-border px-3 py-4 text-12 text-text-faint">No questions yet: the field keeps its one text.</p>
      ) : (
        <div className="mb-4 border border-border-strong bg-surface">
          <table className="w-full border-collapse text-12">
            <thead>
              <tr className="text-left text-text-faint">
                <th className="px-2.5 py-2 font-semibold">Question</th>
                <th className="w-64 px-2.5 py-2 font-semibold">Leads to</th>
                <th className="w-44 px-2.5 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {hints.map((h, i) => {
                const changed = textOf(h).trim() !== h.question;
                const problem = searchHintProblem(textOf(h));
                return (
                  <tr key={h.id} className="border-t border-border align-top">
                    <td className="px-2.5 py-2">
                      <input
                        type="text"
                        value={textOf(h)}
                        maxLength={SEARCH_HINT_MAX}
                        disabled={readOnly || busy !== null}
                        aria-label={`Question ${i + 1}`}
                        className={FIELD}
                        onChange={e => setDraft(d => ({ ...d, [h.id]: e.target.value }))}
                      />
                      <div className="mt-1 flex justify-between font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
                        <span>{changed ? (problem ?? 'reworded, not saved') : `${h.question.length} / ${SEARCH_HINT_MAX}`}</span>
                        {changed && !problem && !readOnly && (
                          <button type="button" className={PBTN} onClick={() => void reword(h)} disabled={busy !== null}>
                            {busy === h.id ? 'Checking…' : 'Save'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-text-muted">
                      {h.leadsTo ? (
                        <a href={h.leadsTo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-edit hover:underline">
                          {h.leadsTitle ?? h.leadsTo} <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-text-faint">unknown</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      {!readOnly && (
                        <span className="inline-flex gap-1">
                          <button type="button" className={PBTN} disabled={busy !== null || i === 0} onClick={() => void move(h, -1)} aria-label={`Move question ${i + 1} earlier`}>
                            <ArrowUp size={10} />
                          </button>
                          <button type="button" className={PBTN} disabled={busy !== null || i === hints.length - 1} onClick={() => void move(h, 1)} aria-label={`Move question ${i + 1} later`}>
                            <ArrowDown size={10} />
                          </button>
                          <button type="button" className={`${PBTN} text-negative`} disabled={busy !== null} onClick={() => void remove(h)} aria-label={`Remove question ${i + 1}`}>
                            <Trash2 size={10} /> Remove
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {conflict && (
        <div className="mb-3 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text">
          <p className="m-0">The hints were saved again after you loaded them. Reload to see what is stored now.</p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={PBTN} onClick={() => onSaved(conflict)}>
              Reload
            </button>
          </div>
        </div>
      )}

      {!readOnly && (
        <section className="max-w-[80ch] border border-border-strong bg-surface p-3">
          <h3 className="m-0 mb-2 text-13 font-bold text-text">Add a question</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid flex-1 gap-1 text-11 text-text-muted">
              Question, as a reader would type it
              <input
                type="text"
                value={question}
                maxLength={SEARCH_HINT_MAX}
                placeholder="When is the next Formula 1 race?"
                aria-label="New question"
                className={FIELD}
                onChange={e => setQuestion(e.target.value)}
              />
            </label>
            <button type="button" className={TB_PRIMARY} disabled={busy !== null || Boolean(addProblem)} onClick={() => void add()}>
              {busy === 'add' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {busy === 'add' ? 'Checking…' : 'Add'}
            </button>
          </div>
          <p className={`m-0 mt-2 font-mono text-9 uppercase tracking-[0.1em] ${error ? 'text-negative' : 'text-text-faint'}`}>
            {error ?? note ?? (question ? (addProblem ?? 'ready: the search is asked when you add it') : `${hints.length} question${hints.length === 1 ? '' : 's'}`)}
          </p>
        </section>
      )}
      {readOnly && error && <p className="text-12 text-negative">{error}</p>}
    </div>
  );
}
