'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { POST_ARTICLE_CLASS } from './PostHeader';
import { lintAiProse, lintSummary } from '@/lib/ai-prose-lint';

// Markdown editor for the blog: a formatting toolbar (inserts markdown) over a
// plain textarea, plus a Write/Preview toggle whose preview is rendered by the
// SERVER (/api/blog/preview → the same renderMarkdown pipeline the published post
// uses). So the preview is byte-identical to what ships and there's no
// client-side markdown/sanitize drift — the exact risk the 2026-07-03 inline-edit
// spec flagged against a client-rendered preview. Body stays markdown (the
// toolbar only inserts **/##/> /etc.), so it round-trips cleanly with the plain
// textarea and the whole render pipeline.

const FIELD = 'w-full rounded border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint';

interface Tool {
  label: string;
  title: string;
  wrap?: [string, string];
  linePrefix?: string;
}

const TOOLS: Tool[] = [
  { label: 'B', title: 'Bold', wrap: ['**', '**'] },
  { label: 'I', title: 'Italic', wrap: ['_', '_'] },
  { label: 'H2', title: 'Heading', linePrefix: '## ' },
  { label: 'H3', title: 'Subheading', linePrefix: '### ' },
  { label: 'Quote', title: 'Quote', linePrefix: '> ' },
  { label: 'List', title: 'List item', linePrefix: '- ' },
  { label: 'Link', title: 'Link', wrap: ['[', '](https://)'] },
];

export function MarkdownEditor({
  value,
  onChange,
  rows = 8,
  ariaLabel = 'Body (markdown)',
  textClassName = 'font-mono text-xs',
  minHeightClass = '',
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  ariaLabel?: string;
  textClassName?: string;
  minHeightClass?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingSel = useRef<[number, number] | null>(null);
  const [preview, setPreview] = useState(false);
  const [html, setHtml] = useState('');
  const [showLint, setShowLint] = useState(false);
  // AI-writing lint: pure + fast, so recompute on the value (no debounce). Em/
  // en-dashes are errors (operator ban); constructions/vocab warnings; motorsport-
  // ambiguous words info. Advisory only — the author fixes, we never rewrite.
  const flags = useMemo(() => lintAiProse(value), [value]);
  const summary = useMemo(() => lintSummary(flags), [flags]);
  const jumpTo = useCallback((start: number, end: number) => {
    const ta = ref.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(start, end); // selecting the span scrolls it into view
  }, []);

  const apply = useCallback(
    (tool: Tool) => {
      const ta = ref.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      if (tool.wrap) {
        const [b, a] = tool.wrap;
        const sel = value.slice(start, end);
        onChange(value.slice(0, start) + b + sel + a + value.slice(end));
        // Keep the selection over the wrapped text (or place the cursor inside).
        pendingSel.current = [start + b.length, end + b.length];
      } else if (tool.linePrefix) {
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        onChange(value.slice(0, lineStart) + tool.linePrefix + value.slice(lineStart));
        pendingSel.current = [start + tool.linePrefix.length, end + tool.linePrefix.length];
      }
    },
    [value, onChange],
  );

  // Re-apply the selection after a toolbar edit re-renders the (controlled) textarea.
  useEffect(() => {
    if (pendingSel.current && ref.current) {
      const [s, e] = pendingSel.current;
      pendingSel.current = null;
      ref.current.focus();
      ref.current.setSelectionRange(s, e);
    }
  });

  // Debounced live preview through the server pipeline, only while preview is open
  // and there's something to render. setState lands inside the deferred timeout
  // callback (never synchronously in the effect body — that cascades renders).
  useEffect(() => {
    if (!preview || !value.trim()) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/blog/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body: value }),
        });
        const d = (await res.json().catch(() => ({}))) as { html?: string };
        if (!cancelled) setHtml(d.html ?? '');
      } catch {
        if (!cancelled) setHtml('');
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, preview]);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        {TOOLS.map(t => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            aria-label={t.title}
            onClick={() => apply(t)}
            disabled={preview}
            className="rounded border border-border bg-surface/60 px-2 py-1 font-mono text-[11px] font-semibold text-text-muted transition-colors hover:border-brand/50 hover:text-text disabled:opacity-40"
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowLint(s => !s)}
          aria-pressed={showLint}
          disabled={preview}
          title="Check for AI-writing tells"
          className={`ml-auto rounded border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors disabled:opacity-40 ${
            summary.errors
              ? 'border-red-500/60 text-red-400'
              : summary.warnings
                ? 'border-amber-500/50 text-amber-300'
                : showLint
                  ? 'border-brand/60 text-brand'
                  : 'border-border text-text-muted hover:text-text'
          }`}
        >
          Style{summary.errors || summary.warnings ? ` · ${summary.errors + summary.warnings}` : ''}
        </button>
        <button
          type="button"
          onClick={() => setPreview(p => !p)}
          aria-pressed={preview}
          className={`rounded border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
            preview ? 'border-brand/60 text-brand' : 'border-border text-text-muted hover:text-text'
          }`}
        >
          {preview ? 'Write' : 'Preview'}
        </button>
      </div>

      {!preview && (
        <p className="font-mono text-[10px] leading-relaxed text-text-faint">
          Data embeds (own line): <code>{'[[chart series=f1]]'}</code> ·{' '}
          <code>{'[[standings series=f1]]'}</code>. Render for series with per-round
          championship points; endurance series (WEC, IMSA, GT World, NLS) show a note instead.
        </p>
      )}

      {preview ? (
        <div className={`rounded border border-border bg-bg px-3 py-2 ${minHeightClass}`}>
          {!value.trim() ? (
            <p className="font-mono text-xs text-text-faint">Nothing to preview yet.</p>
          ) : html ? (
            <article className={POST_ARTICLE_CLASS}>
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </article>
          ) : (
            <p className="font-mono text-xs text-text-faint">Rendering…</p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          className={`${FIELD} ${textClassName} ${minHeightClass}`}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          placeholder="Body (markdown) — use the toolbar for bold, headings, links…"
          aria-label={ariaLabel}
          required
        />
      )}

      {!preview && showLint && (
        <div className="space-y-2 rounded border border-border bg-bg p-2.5">
          {flags.length === 0 ? (
            <p className="font-mono text-[11px] text-text-faint">No AI-writing tells found. Reads clean.</p>
          ) : (
            flags.map(f => (
              <div key={f.id} className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      f.severity === 'error'
                        ? 'bg-red-500'
                        : f.severity === 'warning'
                          ? 'bg-amber-400'
                          : 'bg-text-faint'
                    }`}
                  />
                  <span className="font-semibold text-text">{f.name}</span>
                  <span className="text-text-faint">×{f.count}</span>
                </div>
                <p className="text-[11px] leading-snug text-text-muted">{f.message}</p>
                <div className="flex flex-wrap gap-1">
                  {f.matches.slice(0, 6).map((mt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => jumpTo(mt.start, mt.end)}
                      className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-text-faint transition-colors hover:border-border-strong hover:text-text"
                    >
                      L{mt.line}
                    </button>
                  ))}
                  {f.matches.length > 6 && (
                    <span className="font-mono text-[10px] text-text-faint">+{f.matches.length - 6}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
