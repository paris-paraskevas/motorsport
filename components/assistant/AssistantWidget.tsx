'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { UserCog, X, Send, ThumbsUp, ThumbsDown, Plus, History, Trash2 } from 'lucide-react';
import type { ChatMessage } from '@/lib/assistant/prompt';
import { parseInline } from '@/lib/assistant/render';

// Floating "Race Engineer" help chat — a persistent launcher (bottom-right, above
// the mobile bottom bar) that opens a conversational panel on every app page.
// The /api/assistant route owns auth + rate limits + the model call; this widget
// just renders the conversation and its states. Multi-turn: it POSTs the running
// history each send. Account-gated: signed-out users get a sign-in prompt.
const MAX_LEN = 1000;
const CHAT_KEY = 'paddock:assistant:chat'; // legacy single-conversation store (migrated on load)
const CONVS_KEY = 'paddock:assistant:conversations'; // Conversation[]
const ACTIVE_KEY = 'paddock:assistant:active'; // id of the open conversation
const RATED_KEY = 'paddock:assistant:rated';
const MAX_CONVS = 30; // cap stored history
const SUGGESTIONS = [
  'How do I follow a series?',
  'How does the prediction game work?',
  'Where are the standings?',
  'How do I customise my home?',
];

// A stored help conversation. Kept client-side (localStorage) — the widget is a
// stateless help chat, so per-device history is enough and it keeps working for
// signed-out users. Its display title is derived (first user line), not stored.
interface Conversation {
  id: string;
  messages: ChatMessage[];
  updatedAt: number;
}

function convTitle(c: Conversation): string {
  const first = c.messages.find((m) => m.role === 'user')?.content?.trim();
  if (!first) return 'New chat';
  return first.length > 42 ? `${first.slice(0, 42)}…` : first;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Math.random().toString(36).slice(2)}-${performance.now().toString(36)}`;
  }
}

export function AssistantWidget() {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keyed by answer text (not index) so ratings survive a reload + stay aligned
  // even if the persisted history is capped/re-indexed.
  const [rated, setRated] = useState<Record<string, 'up' | 'down'>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // The open conversation's messages are the chat's source of truth; setMessages
  // writes back into that conversation so send()/rating below stay unchanged.
  const messages = useMemo(
    () => convs.find((c) => c.id === activeId)?.messages ?? [],
    [convs, activeId],
  );
  const setMessages = (updater: ChatMessage[] | ((m: ChatMessage[]) => ChatMessage[])) =>
    setConvs((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: typeof updater === 'function' ? updater(c.messages) : updater,
              updatedAt: Date.now(),
            }
          : c,
      ),
    );

  const newChat = () => {
    const current = convs.find((c) => c.id === activeId);
    if (current && current.messages.length === 0) {
      setShowHistory(false); // already on a blank chat — don't pile up empties
      return;
    }
    const id = newId();
    setConvs((prev) => [{ id, messages: [], updatedAt: Date.now() }, ...prev]);
    setActiveId(id);
    setInput('');
    setError(null);
    setShowHistory(false);
  };

  const openConv = (id: string) => {
    setActiveId(id);
    setError(null);
    setShowHistory(false);
  };

  const deleteConv = (id: string) => {
    const next = convs.filter((c) => c.id !== id);
    if (next.length === 0) {
      const nid = newId();
      setConvs([{ id: nid, messages: [], updatedAt: Date.now() }]);
      setActiveId(nid);
      return;
    }
    setConvs(next);
    if (id === activeId) setActiveId(next[0].id);
  };

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  // Load conversations (localStorage), migrating the pre-v2 single-chat store.
  useEffect(() => {
    try {
      const rawConvs = localStorage.getItem(CONVS_KEY);
      let list: Conversation[] = rawConvs ? JSON.parse(rawConvs) : [];
      if (!Array.isArray(list)) list = [];
      list = list.filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages));
      if (list.length === 0) {
        const legacy = localStorage.getItem(CHAT_KEY);
        const msgs = legacy ? JSON.parse(legacy) : null;
        if (Array.isArray(msgs) && msgs.length) {
          list = [{ id: newId(), messages: msgs as ChatMessage[], updatedAt: Date.now() }];
        }
      }
      if (list.length === 0) list = [{ id: newId(), messages: [], updatedAt: Date.now() }];
      const storedActive = localStorage.getItem(ACTIVE_KEY) || '';
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from localStorage (client-only; can't run during render)
      setConvs(list);
      setActiveId(list.some((c) => c.id === storedActive) ? storedActive : list[0].id);
      const rawRated = localStorage.getItem(RATED_KEY);
      const storedRated = rawRated ? JSON.parse(rawRated) : null;
      if (storedRated && typeof storedRated === 'object' && !Array.isArray(storedRated)) {
        setRated(storedRated as Record<string, 'up' | 'down'>);
      }
    } catch {
      /* ignore corrupt/blocked storage */
    }
  }, []);
  // Persist conversations + which one is open (each trimmed to the last 40 turns).
  useEffect(() => {
    if (convs.length === 0) return;
    try {
      localStorage.setItem(
        CONVS_KEY,
        JSON.stringify(convs.slice(0, MAX_CONVS).map((c) => ({ ...c, messages: c.messages.slice(-40) }))),
      );
      localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
      /* ignore */
    }
  }, [convs, activeId]);
  useEffect(() => {
    try {
      localStorage.setItem(RATED_KEY, JSON.stringify(rated));
    } catch {
      /* ignore */
    }
  }, [rated]);

  async function send(preset?: string) {
    const q = (preset ?? input).trim();
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

  async function rate(answer: string, rating: 'up' | 'down', question: string) {
    if (!question || rated[answer]) return;
    setRated(r => ({ ...r, [answer]: rating }));
    try {
      await fetch('/api/assistant/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, rating }),
      });
    } catch {
      /* best-effort — feedback is fire-and-forget */
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
        className={`${anchor} inline-flex h-14 w-14 lg:h-[4.5rem] lg:w-[4.5rem] items-center justify-center border-[1.5px] border-text bg-text text-bg shadow-lg transition-transform duration-(--duration-fast) hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg`}
      >
        <UserCog className="size-6 lg:size-9" aria-hidden />
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
        <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-fill/15 text-brand">
          <UserCog size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-bold uppercase tracking-wide text-text">Race Engineer</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">Paddock help</div>
        </div>
        {isSignedIn && (
          <>
            <button
              type="button"
              onClick={newChat}
              aria-label="New conversation"
              title="New conversation"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-text"
            >
              <Plus size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              aria-label={showHistory ? 'Back to conversation' : 'Past conversations'}
              aria-pressed={showHistory}
              title="Past conversations"
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-(--duration-fast) hover:bg-surface hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-text ${showHistory ? 'bg-surface text-text' : 'text-text-muted'}`}
            >
              <History size={16} aria-hidden />
            </button>
          </>
        )}
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
        ) : showHistory ? (
          <div className="space-y-1">
            {convs.length === 1 && convs[0].messages.length === 0 ? (
              <p className="px-1 py-2 text-sm text-text-muted">No past conversations yet.</p>
            ) : (
              [...convs]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                      c.id === activeId ? 'bg-surface text-text' : 'text-text-muted hover:bg-surface'
                    }`}
                  >
                    <button type="button" onClick={() => openConv(c.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate">{convTitle(c)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteConv(c.id)}
                      aria-label={`Delete conversation: ${convTitle(c)}`}
                      className="shrink-0 text-text-faint opacity-0 transition-opacity hover:text-red-400 focus:opacity-100 focus:outline-none group-hover:opacity-100"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                ))
            )}
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <>
                <Bubble role="assistant">
                  Box, box. Ask me how to use Paddock — following series, customising your
                  home, the prediction game, finding standings or results.
                </Bubble>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-xs text-text-muted transition-colors duration-(--duration-fast) hover:border-brand hover:text-text"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            {messages.map((m, i) => (
              <div key={i}>
                <Bubble role={m.role}>
                  {m.role === 'assistant' ? (
                    <RichText text={m.content} onNavigate={() => setOpen(false)} />
                  ) : (
                    m.content
                  )}
                </Bubble>
                {m.role === 'assistant' && (
                  <div className="mt-1 flex items-center gap-2 pl-1">
                    {rated[m.content] ? (
                      <span className="font-mono text-[10px] text-text-faint">thanks for the feedback</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => rate(m.content, 'up', messages[i - 1]?.content ?? '')}
                          aria-label="Helpful"
                          className="text-text-faint transition-colors hover:text-emerald-400"
                        >
                          <ThumbsUp size={13} aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => rate(m.content, 'down', messages[i - 1]?.content ?? '')}
                          aria-label="Not helpful"
                          className="text-text-faint transition-colors hover:text-red-400"
                        >
                          <ThumbsDown size={13} aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <Bubble role="assistant">
                <TypingDots />
              </Bubble>
            )}
            {error && (
              <div role="status" className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted">
                {error}
              </div>
            )}
            <div ref={endRef} />
          </>
        )}
      </div>

      {isSignedIn && !showHistory && (
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
              onClick={() => send()}
              disabled={input.trim().length < 3 || busy}
              aria-label="Send"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center bg-text text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted disabled:opacity-40"
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

// Three bouncing dots while the assistant is thinking — a lighter, safer
// "responsive" cue than streaming. Static (no bounce) under prefers-reduced-motion.
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" role="status" aria-label="Race Engineer is typing">
      {[0, 0.15, 0.3].map(delay => (
        <span
          key={delay}
          className="h-1.5 w-1.5 rounded-full bg-text-muted motion-safe:animate-bounce"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
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
          mine ? 'bg-brand-fill/15 text-text' : 'bg-surface text-text'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
