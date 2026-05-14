'use client';
import { useEffect, useState } from 'react';
import { Mail, X } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

const CONTACT_OPEN_EVENT = 'paddock:open-contact';

export function openContactModal() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONTACT_OPEN_EVENT));
}

export function ContactModal() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const onOpen = () => {
      setResult(null);
      setMessage('');
      if (isLoaded && isSignedIn && user) {
        const primary = user.primaryEmailAddress?.emailAddress ?? '';
        setEmail(primary);
      }
      setOpen(true);
    };
    window.addEventListener(CONTACT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONTACT_OPEN_EVENT, onOpen);
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message }),
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
    <div
      className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-3 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Contact"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl shadow-black/60 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Mail size={18} className="text-zinc-400" />
              <h2 className="text-zinc-50 text-base font-semibold">Contact</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="p-1.5 -mr-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-900 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="block text-xs text-zinc-400 mb-1.5">Your email</span>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-zinc-400 mb-1.5">Message</span>
              <textarea
                required
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors resize-none"
              />
            </label>

            {result && (
              <div
                className={`text-sm ${
                  result.ok ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {result.msg}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-zinc-500 hover:text-zinc-200 px-3 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!valid || submitting}
                className="text-sm font-medium text-zinc-950 bg-zinc-100 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-4 py-2 transition-colors"
              >
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
