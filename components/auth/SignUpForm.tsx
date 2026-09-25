'use client';
import Link from 'next/link';
import { useCallback, useState, type FormEvent } from 'react';
import { GoogleButton } from './GoogleButton';
import { Turnstile } from './Turnstile';
import { call, CodeInput, errorOf, Field, go, PRIMARY, Problem, QUIET, TextInput } from './fields';

// The sign-up page's form (PA A3): a name, an email and a password, then the six-digit code the email carries; Google's
// button beside it. The welcome email goes once the code is confirmed (the route sends it).
export const PASSWORD_HINT = 'At least 8 characters.';

export function SignUpForm({ next, siteKey, googleClientId }: { next: string; siteKey: string | null; googleClientId: string | null }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const onToken = useCallback((token: string | null) => setCaptcha(token), []);

  const signUp = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const answer = await call('/api/auth/sign-up', 'POST', { name, email, password, captchaToken: captcha ?? undefined, next });
    setRound(r => r + 1);
    if (answer.ok && answer.body.confirm === false) return go(typeof answer.body.next === 'string' ? answer.body.next : next);
    setBusy(false);
    if (!answer.ok) return setProblem(errorOf(answer));
    setCode('');
    setSent(true);
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const answer = await call('/api/auth/verify', 'POST', { email, token: code, type: 'signup', next });
    if (answer.ok) return go(typeof answer.body.next === 'string' ? answer.body.next : next);
    setBusy(false);
    setProblem(errorOf(answer));
  };
  const resend = async () => {
    setBusy(true);
    setProblem(null);
    const answer = await call('/api/auth/sign-up', 'POST', { name, email, password, captchaToken: captcha ?? undefined, next });
    setRound(r => r + 1);
    setBusy(false);
    if (!answer.ok) setProblem(errorOf(answer));
  };

  if (sent) {
    return (
      <form onSubmit={verify} className="flex flex-col gap-5">
        <header>
          <h1 className="font-serif text-38 font-medium leading-none tracking-[-0.02em] text-text md:text-46">Check your email</h1>
          <p className="mt-2 font-serif text-16 leading-snug text-text-muted">
            We sent a six-digit code to <span className="text-text">{email}</span>. Enter it to finish.
          </p>
        </header>
        <Field id="code" label="Code">
          <CodeInput id="code" name="code" value={code} onChange={e => setCode(e.target.value)} autoFocus required />
        </Field>
        <Problem>{problem}</Problem>
        <button type="submit" className={PRIMARY} disabled={busy}>
          Create my account
        </button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={QUIET} disabled={busy} onClick={() => void resend()}>
            Send a new code
          </button>
          <button type="button" className={QUIET} disabled={busy} onClick={() => setSent(false)}>
            Back
          </button>
        </div>
        <Turnstile siteKey={siteKey} onToken={onToken} round={round} />
      </form>
    );
  }

  return (
    <form onSubmit={signUp} className="flex flex-col gap-5">
      <header>
        <h1 className="font-serif text-38 font-medium leading-none tracking-[-0.02em] text-text md:text-46">Create an account</h1>
        <p className="mt-2 font-serif text-16 leading-snug text-text-muted">Follow your series, get notified before lights-out, and play the prediction game.</p>
      </header>
      <GoogleButton clientId={googleClientId} next={next} onError={setProblem} />
      {googleClientId && (
        <p className="flex items-center gap-3 font-mono text-11 uppercase tracking-[0.16em] text-text-faint" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </p>
      )}
      <Field id="name" label="Name">
        <TextInput id="name" type="text" name="name" autoComplete="name" placeholder="How the site should call you" value={name} onChange={e => setName(e.target.value)} required maxLength={80} autoFocus />
      </Field>
      <Field id="email" label="Email">
        <TextInput id="email" type="email" name="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
      </Field>
      <Field id="password" label="Password" hint={<span className="font-mono text-11 text-text-faint">{PASSWORD_HINT}</span>}>
        <TextInput id="password" type="password" name="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
      </Field>
      <Turnstile siteKey={siteKey} onToken={onToken} round={round} />
      <Problem>{problem}</Problem>
      <button type="submit" className={PRIMARY} disabled={busy}>
        Continue
      </button>
      <p className="text-right">
        <Link href={next === '/' ? '/sign-in' : `/sign-in?next=${encodeURIComponent(next)}`} className={QUIET}>
          Already have an account? Sign in
        </Link>
      </p>
    </form>
  );
}
