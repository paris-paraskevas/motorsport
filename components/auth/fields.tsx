'use client';
import type { InputHTMLAttributes, ReactNode } from 'react';

// The auth screens' pieces (PA A3): the site's tokens, big type, one box per field, and the one call every form makes.

export const LABEL = 'mb-2 block font-mono text-11 uppercase tracking-[0.16em] text-text-muted';
export const INPUT = 'block w-full border border-border-strong bg-surface px-4 py-3 text-base text-text placeholder:text-text-faint outline-none transition-colors duration-(--duration-fast) focus:border-text';
export const PRIMARY = 'inline-flex w-full items-center justify-center gap-2 bg-text px-4 py-3 font-mono text-11 font-semibold uppercase tracking-[0.12em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted disabled:cursor-wait disabled:opacity-60';
export const QUIET = 'font-mono text-11 uppercase tracking-[0.12em] text-text-muted underline underline-offset-4 transition-colors duration-(--duration-fast) hover:text-text disabled:opacity-60';

/** One box per field: the label (for the input of the id given), a hint or an action at its right, the input under. */
export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-mono text-11 uppercase tracking-[0.16em] text-text-muted">
          {label}
        </label>
        {hint}
      </div>
      {children}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT} ${props.className ?? ''}`} />;
}

/** A six-digit code: wide, spaced, numeric. */
export function CodeInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={7} {...props} className={`${INPUT} text-center font-mono text-2xl tracking-[0.5em] ${props.className ?? ''}`} />;
}

export function Problem({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="border-l-4 border-brand pl-3 text-sm leading-snug text-text">
      {children}
    </p>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="border border-border bg-surface px-4 py-3 text-sm leading-snug text-text-muted">{children}</p>;
}

export interface Answer {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

/** One call to the site's own routes: JSON in, JSON out, the session's cookies set by the answer. */
export async function call(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<Answer> {
  try {
    const res = await fetch(path, {
      method,
      headers: body instanceof FormData ? {} : { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    });
    const json = ((await res.json().catch(() => ({}))) as Record<string, unknown>) ?? {};
    return { ok: res.ok, status: res.status, body: json };
  } catch {
    return { ok: false, status: 0, body: { error: 'The site could not be reached. Check the connection and try again.' } };
  }
}

/** The error an answer carries, else a plain one. */
export function errorOf(answer: Answer, fallback = 'Something went wrong. Try again.'): string {
  return typeof answer.body.error === 'string' ? answer.body.error : fallback;
}

/** A full navigation, so the server renders with the new session. */
export function go(path: string): void {
  window.location.assign(path);
}
