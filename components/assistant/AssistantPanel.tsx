'use client';

import { useState } from 'react';

// Single-turn Q&A for the site-help assistant (multi-turn is a follow-up). Posts
// to /api/assistant, which owns auth + rate limits + the model call. The panel
// just renders states: idle, loading, answer, and the specific error messages
// the route returns (daily limit, busy, not-available-yet).
const MAX_LEN = 1000;

export function AssistantPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canAsk = question.trim().length >= 3 && !busy;

  async function ask() {
    if (!canAsk) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        answer?: string;
        message?: string;
        error?: string;
      };
      if (res.ok && data.answer) {
        setAnswer(data.answer);
      } else {
        setError(data.message ?? 'Something went wrong — please try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface-elevated p-4">
        <label htmlFor="assistant-q" className="sr-only">
          Ask a question about using Paddock
        </label>
        <textarea
          id="assistant-q"
          value={question}
          onChange={e => setQuestion(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask();
          }}
          rows={3}
          placeholder="How do I follow a series? Where are the standings? How does the prediction game work?"
          className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-text"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-text-faint">{question.trim().length}/{MAX_LEN}</span>
          <button
            type="button"
            onClick={ask}
            disabled={!canAsk}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-bg transition-opacity duration-(--duration-fast) hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Asking…' : 'Ask'}
          </button>
        </div>
      </div>

      {error && (
        <div role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-muted">
          {error}
        </div>
      )}

      {answer && (
        <div className="rounded-2xl border border-border bg-surface-elevated p-4">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Answer</div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">{answer}</div>
        </div>
      )}

      <p className="font-mono text-[11px] leading-relaxed text-text-faint">
        Beta — the assistant helps with using Paddock and may be imperfect. For live
        results, standings or times, open the relevant page. Don&apos;t share anything
        sensitive; questions are processed by a third-party model provider.
      </p>
    </div>
  );
}
