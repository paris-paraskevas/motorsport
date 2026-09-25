'use client';
import Link from 'next/link';
import { useCallback, useState, type FormEvent } from 'react';
import { GoogleButton } from './GoogleButton';
import { Turnstile } from './Turnstile';
import { call, CodeInput, errorOf, Field, go, Note, PRIMARY, Problem, QUIET, TextInput } from './fields';

// The sign-in page's form (PA A3): email and password, a six-digit code by email instead, Google's button, and the way
// to a new password. Every step posts to the site's own routes; a success is a full navigation to the way back, so the
// server renders with the session. The notice at the foot stays for thirty days after the switch (A4 removes it).
export const NOTICE_UNTIL = '2026-11-01';
type CodeKind = 'email' | 'recovery';

export function SignInForm({ next, siteKey, googleClientId, today = new Date() }: { next: string; siteKey: string | null; googleClientId: string | null; today?: Date }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeKind, setCodeKind] = useState<CodeKind | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const onToken = useCallback((token: string | null) => setCaptcha(token), []);
  const spend = () => setRound(r => r + 1);

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const answer = await call('/api/auth/password', 'POST', { email, password, captchaToken: captcha ?? undefined, next });
    spend();
    if (answer.ok) return go(typeof answer.body.next === 'string' ? answer.body.next : next);
    setBusy(false);
    setProblem(errorOf(answer));
  };
  const sendCode = async (kind: CodeKind) => {
    setBusy(true);
    setProblem(null);
    const answer = await call(kind === 'email' ? '/api/auth/code' : '/api/auth/reset', 'POST', { email, captchaToken: captcha ?? undefined });
    spend();
    setBusy(false);
    if (!answer.ok) return setProblem(errorOf(answer));
    setCode('');
    setCodeKind(kind);
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!codeKind) return;
    setBusy(true);
    setProblem(null);
    const answer = await call('/api/auth/verify', 'POST', { email, token: code, type: codeKind, next });
    if (answer.ok) return go(codeKind === 'recovery' ? '/settings/account?reset=1' : typeof answer.body.next === 'string' ? answer.body.next : next);
    setBusy(false);
    setProblem(errorOf(answer));
  };

  if (codeKind) {
    return (
      <form onSubmit={verify} className="flex flex-col gap-5">
        <header>
          <h1 className="font-serif text-38 font-medium leading-none tracking-[-0.02em] text-text md:text-46">Check your email</h1>
          <p className="mt-2 font-serif text-16 leading-snug text-text-muted">
            {codeKind === 'recovery' ? 'If an account exists for ' : 'We sent a six-digit code to '}
            <span className="text-text">{email}</span>
            {codeKind === 'recovery' ? ', a six-digit code is on its way. Enter it to set a new password.' : '.'}
          </p>
        </header>
        <Field id="code" label="Code">
          <CodeInput id="code" name="code" value={code} onChange={e => setCode(e.target.value)} autoFocus required />
        </Field>
        <Problem>{problem}</Problem>
        <button type="submit" className={PRIMARY} disabled={busy}>
          Continue
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={QUIET} disabled={busy} onClick={() => void sendCode(codeKind)}>
            Send a new code
          </button>
          <button type="button" className={QUIET} disabled={busy} onClick={() => setCodeKind(null)}>
            Back
          </button>
        </div>
        <Turnstile siteKey={siteKey} onToken={onToken} round={round} />
      </form>
    );
  }

  return (
    <form onSubmit={signIn} className="flex flex-col gap-5">
      <header>
        <h1 className="font-serif text-38 font-medium leading-none tracking-[-0.02em] text-text md:text-46">Sign in to Paddock</h1>
        <p className="mt-2 font-serif text-16 leading-snug text-text-muted">Your followed series, notifications and predictions, on every device.</p>
      </header>
      <GoogleButton clientId={googleClientId} next={next} onError={setProblem} />
      {googleClientId && (
        <p className="flex items-center gap-3 font-mono text-11 uppercase tracking-[0.16em] text-text-faint" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </p>
      )}
      <Field id="email" label="Email">
        <TextInput id="email" type="email" name="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
      </Field>
      <Field
        id="password"
        label="Password"
        hint={
          <button type="button" className={QUIET} disabled={busy || !email} onClick={() => void sendCode('recovery')}>
            Forgot it?
          </button>
        }
      >
        <TextInput id="password" type="password" name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
      </Field>
      <Turnstile siteKey={siteKey} onToken={onToken} round={round} />
      <Problem>{problem}</Problem>
      <button type="submit" className={PRIMARY} disabled={busy}>
        Sign in
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={QUIET} disabled={busy || !email} onClick={() => void sendCode('email')}>
          Email me a code instead
        </button>
        <Link href={next === '/' ? '/sign-up' : `/sign-up?next=${encodeURIComponent(next)}`} className={QUIET}>
          New to Paddock? Create an account
        </Link>
      </div>
      {today.toISOString().slice(0, 10) < NOTICE_UNTIL && <Note>Paddock has moved sign-in. Use the same email and password, Google, or a code by email.</Note>}
    </form>
  );
}
