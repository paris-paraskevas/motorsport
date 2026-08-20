'use client';
import { useEffect, useRef, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { useFocusTrap } from '@/lib/useFocusTrap';

const CONTACT_OPEN_EVENT = 'paddock:open-contact';

export function openContactModal() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONTACT_OPEN_EVENT));
}

// The footer's Contact entry (the header pill died with the four-door shell).
// Lives here rather than in Footer.tsx because opening the modal needs a client
// handler and the footer is a server component.
export function ContactFooterButton() {
  return (
    <button
      type="button"
      onClick={openContactModal}
      data-heatmap-id="footer:contact"
      className="block w-full py-1 text-left text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
    >
      Contact
    </button>
  );
}

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'bug', label: 'Bug report' },
  { value: 'feature', label: 'Feature request' },
  { value: 'suggestion', label: 'Suggested change' },
] as const;
type Category = (typeof CATEGORIES)[number]['value'];

const FIELD_CLASS =
  'w-full border border-border-strong bg-surface-elevated px-3 py-2.5 font-mono text-[12px] text-text placeholder:text-text-muted outline-none transition-colors duration-(--duration-fast) focus:border-text';

// The one contact form — shared by the footer's modal and the /contact page
// (where the Account "Export your data" row lands; round-2 fix ① — the row
// shipped in 0.298.0 before the route existed). Paper register: square
// fields, mono labels, ink submit. `onCancel` renders the modal's Cancel
// button; the page omits it.
export function ContactForm({ onCancel }: { onCancel?: () => void }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<Category>('general');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Prefill the signed-in address once Clerk resolves — adjusted DURING render
  // (the sanctioned prev-value pattern; an effect would trip the repo's
  // set-state-in-effect error rule). Never clobbers typing: fires once, and
  // only into an empty field.
  const primary =
    isLoaded && isSignedIn ? user?.primaryEmailAddress?.emailAddress ?? '' : '';
  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && primary !== '') {
    setPrefilled(true);
    if (email === '') setEmail(primary);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message, category }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `error (${res.status})`);
      }
      setResult({ ok: true, msg: 'Thanks — message received.' });
      setMessage('');
    } catch (err) {
      setResult({
        ok: false,
        msg: err instanceof Error ? err.message : 'Failed to send.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const valid = email.includes('@') && message.trim().length >= 5;

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Your email
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={FIELD_CLASS}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Category
        </span>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as Category)}
          className={FIELD_CLASS}
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Message
        </span>
        <textarea
          required
          rows={5}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="What's on your mind?"
          className={`${FIELD_CLASS} resize-none`}
        />
      </label>

      {result && (
        <div
          role="status"
          aria-live="polite"
          className={`font-mono text-[11px] uppercase tracking-[0.12em] ${
            result.ok ? 'text-text' : 'text-brand'
          }`}
        >
          {result.msg}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint transition-colors duration-(--duration-fast) hover:text-text"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!valid || submitting}
          className="inline-flex min-h-10 items-center bg-text px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  );
}

export function ContactModal() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(CONTACT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONTACT_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus into the dialog on open, trap Tab, Escape-to-close, restore focus on
  // close. `open` gates it — this dialog stays mounted and renders null when
  // shut (which also unmounts the form, so every open starts fresh).
  useFocusTrap(panelRef, () => setOpen(false), open);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Contact"
      onClick={() => setOpen(false)}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md overflow-hidden border-[1.5px] border-text bg-surface-elevated shadow-2xl shadow-black/60"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Mail size={18} className="text-text-muted" />
              <h2 className="font-serif text-[19px] font-semibold text-text">Contact</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mr-1.5 p-1.5 text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
            >
              <X size={18} />
            </button>
          </div>
          <ContactForm onCancel={() => setOpen(false)} />
        </div>
      </div>
    </div>
  );
}
