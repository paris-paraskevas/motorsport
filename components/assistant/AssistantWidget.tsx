'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { Headset, X, Send } from 'lucide-react';
import type { ChatMessage } from '@/lib/assistant/prompt';
import { parseInline } from '@/lib/assistant/render';

// Floating "Race Engineer" help chat — a persistent launcher (bottom-right, above
// the mobile bottom bar) that opens a conversational panel on every app page.
// The /api/assistant route owns auth + rate limits + the model call; this widget
// just renders the conversation and its states. Multi-turn: it POSTs the running
// history each send. Account-gated: signed-out users get a sign-in prompt.
const MAX_LEN = 1000;

export function AssistantWidget() {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send() {
    const q = input.trim();
    if (q.length < 3 || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { answer?: string; message?: string };
      if (res.ok && data.answer) {
        setMessages(m => [...m, { role: 'assistant', content: data.answer as string }]);
      } else {
        setError(data.message ?? 'Something went wrong — please try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Ships DARK: no launcher until the operator flips NEXT_PUBLIC_ASSISTANT_ENABLED
  // to '1' (set it alongside GOOGLE_GENERATIVE_AI_API_KEY at go-live). Keeps a
  // non-functional "not available yet" chat button off users' screens meanwhile.
  // After hooks so the hook order is unconditional (rules-of-hooks).
  if (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED !== '1') return null;

  // Sits above the mobile bottom bar (h-14 + safe area); flush on lg (no bar).
  const anchor =
    'fixed right-4 z-40 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the Race Engineer help chat"
        className={`${anchor} inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand text-bg shadow-lg transition-transform duration-(--duration-fast) hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg`}
      >
        <Headset size={20} aria-hidden />
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Race Engineer"
      onKeyDown={e => {
        if (e.key === 'Escape') setOpen(false);
      }}
      className={`${anchor} flex w-[min(23rem,calc(100vw-2rem))] h-[70dvh] max-h-[34rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-2xl`}
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Headset size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-bold uppercase tracking-wide text-text">Race Engineer</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">Paddock help</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-text"
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {!isSignedIn ? (
          <div className="rounded-lg border border-border bg-surface px-3 py-3 text-sm text-text-muted">
            Sign in (it&apos;s free) to ask the Race Engineer how to use Paddock.
            <Link
              href="/sign-in"
              className="mt-3 block w-fit rounded-lg bg-text px-3 py-1.5 text-xs font-medium text-bg hover:opacity-90"
            >
              Sign in — it&apos;s free
            </Link>
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <Bubble role="assistant">
                Box, box. Ask me how to use Paddock — following series, customising your
                home, the prediction game, finding standings or results.
              </Bubble>
            )}
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role}>
                {m.role === 'assistant' ? (
                  <RichText text={m.content} onNavigate={() => setOpen(false)} />
                ) : (
                  m.content
                )}
              </Bubble>
            ))}
            {busy && <Bubble role="assistant">…</Bubble>}
            {error && (
              <div role="status" className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted">
                {error}
              </div>
            )}
            <div ref={endRef} />
          </>
        )}
      </div>

      {isSignedIn && (
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Ask the Race Engineer…"
              className="max-h-24 min-h-9 flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-text"
            />
            <button
              type="button"
              onClick={send}
              disabled={input.trim().length < 3 || busy}
              aria-label="Send"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-bg transition-opacity duration-(--duration-fast) hover:opacity-90 disabled:opacity-40"
            >
              <Send size={16} aria-hidden />
            </button>
          </div>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-text-faint">
            Beta — helps with using Paddock. For live results or standings, open the page.
            Don&apos;t share anything sensitive; questions go to a third-party model.
          </p>
        </div>
      )}
    </div>
  );
}

// Renders assistant text with the two markdown constructs the model uses: links
// and **bold** (see lib/assistant/render). Internal links navigate in-app and
// close the panel; external links open a new tab. No HTML is ever injected.
function RichText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const linkCls = 'underline decoration-brand decoration-2 underline-offset-2 hover:text-brand';
  return (
    <>
      {text.split('\n').map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          {parseInline(line).map((t, ti) => {
            if (t.kind === 'bold') return <strong key={ti}>{t.text}</strong>;
            if (t.kind === 'link') {
              return t.external ? (
                <a key={ti} href={t.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
                  {t.text}
                </a>
              ) : (
                <Link key={ti} href={t.href} onClick={onNavigate} className={linkCls}>
                  {t.text}
                </Link>
              );
            }
            return <span key={ti}>{t.text}</span>;
          })}
        </span>
      ))}
    </>
  );
}

function Bubble({ role, children }: { role: ChatMessage['role']; children: React.ReactNode }) {
  const mine = role === 'user';
  return (
    <div className={mine ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          mine ? 'bg-brand/15 text-text' : 'bg-surface text-text'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
