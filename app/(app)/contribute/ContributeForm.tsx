'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Paperclip, X } from 'lucide-react';

// Accepted file types + cap must mirror lib/feeder (ACCEPTED_EXTENSIONS / FILE_MAX_BYTES).
const ACCEPT = '.csv,.xlsx,.xls,.pdf,.json,.txt,.tsv';
const MAX_BYTES = 2 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INPUT =
  'w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-border-strong transition-colors duration-(--duration-fast)';

/** Read a File into raw base64 (strips the `data:...;base64,` prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => reject(new Error('could not read the file'));
    reader.readAsDataURL(file);
  });
}

export function ContributeForm() {
  const ref = useSearchParams().get('ref') ?? '';
  const [seriesName, setSeriesName] = useState('');
  const [email, setEmail] = useState('');
  const [season, setSeason] = useState('');
  const [note, setNote] = useState('');
  const [dataUrl, setDataUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState(''); // honeypot — real users never see this
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const fileTooBig = file != null && file.size > MAX_BYTES;
  const valid =
    seriesName.trim().length > 0 &&
    EMAIL_RE.test(email.trim()) &&
    consent &&
    (file != null || dataUrl.trim().length > 0) &&
    !fileTooBig;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const filePayload = file
        ? { name: file.name, type: file.type || 'application/octet-stream', dataBase64: await fileToBase64(file) }
        : null;
      const res = await fetch('/api/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesName,
          contactEmail: email,
          season,
          note,
          dataUrl,
          file: filePayload,
          consent,
          company,
          ref,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || `error (${res.status})`);
      setResult({ ok: true, msg: '' });
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : 'Something went wrong — please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (result?.ok) {
    return (
      <div className="rounded-2xl border border-border bg-surface-elevated p-8 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-fill/15 text-brand">
          <Check size={22} />
        </div>
        <h2 className="font-display text-xl font-extrabold uppercase tracking-wide text-text">Got it — thank you</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-muted">
          Your submission is in. We’ll review the data and email you at <span className="text-text">{email || 'your address'}</span> if we
          need anything to add your series.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Honeypot: off-screen, not tab-reachable, autocomplete off. */}
      <div aria-hidden className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden">
        <label>
          Company
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={e => setCompany(e.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs text-text-muted">
          Series / championship name <span className="text-brand">*</span>
        </span>
        <input
          type="text"
          required
          value={seriesName}
          onChange={e => setSeriesName(e.target.value)}
          placeholder="e.g. Champions of the Future — Euro"
          maxLength={120}
          className={INPUT}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs text-text-muted">
            Your email <span className="text-brand">*</span>
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@series.com"
            maxLength={200}
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-text-muted">Season (optional)</span>
          <input
            type="text"
            value={season}
            onChange={e => setSeason(e.target.value)}
            placeholder="e.g. 2026"
            maxLength={40}
            className={INPUT}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs text-text-muted">Link to your data (optional)</span>
        <input
          type="url"
          value={dataUrl}
          onChange={e => setDataUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/…"
          maxLength={500}
          className={INPUT}
        />
      </label>

      <div className="block">
        <span className="mb-1.5 block text-xs text-text-muted">…or attach a file (CSV, Excel, PDF, JSON, TXT — max 2 MB)</span>
        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2 text-sm text-text">
              <Paperclip size={14} className="shrink-0 text-text-faint" />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-text-faint">({(file.size / 1024).toFixed(0)} KB)</span>
            </span>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="Remove file"
              className="shrink-0 text-text-muted hover:text-text"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-surface/40 px-3 py-2.5 text-sm text-text-muted hover:border-border-strong hover:text-text transition-colors duration-(--duration-fast)">
            <Paperclip size={14} className="shrink-0" />
            Choose a file
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
        {fileTooBig && (
          <p className="mt-1 text-xs text-amber-400">That file is over 2 MB — please paste a link to it instead.</p>
        )}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs text-text-muted">Anything we should know? (optional)</span>
        <textarea
          rows={4}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Format notes, what the columns mean, where to find results each round…"
          maxLength={4000}
          className={`${INPUT} resize-none`}
        />
      </label>

      <label className="flex items-start gap-2.5 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
        />
        <span>
          I have the right to share this data and grant Paddock permission to display it. <span className="text-brand">*</span>
        </span>
      </label>

      {result && !result.ok && <div className="text-sm text-amber-400">{result.msg}</div>}

      <button
        type="submit"
        disabled={!valid || submitting}
        className="rounded-full bg-text px-5 py-2.5 text-sm font-semibold text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Send your data'}
      </button>
    </form>
  );
}
