'use client';
import { useRouter } from 'next/navigation';
import { useContext, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AccountContext, initialsOf, type Account } from '@/lib/auth/client';
import { call, CodeInput, errorOf, go, INPUT, Note, PRIMARY, Problem, QUIET, type Answer } from './fields';

// The Account page's rows (PA A3; Clerk's Manage account before): name, photo, email (a code confirms the new address),
// password, where the person signs in from, every device signed out, the account deleted after the words are typed.
// Each edit goes through /api/account; the page then re-renders with the fresh claims and the header follows.
type Row = 'name' | 'email' | 'password' | 'delete';
export const DELETE_WORDS = 'Delete account';
const providerName = (p: string) => (p === 'email' ? 'email and password' : p === 'google' ? 'Google' : p);

export function AccountForm({ account, providers, resetPassword }: { account: Account; providers: string[]; resetPassword: boolean }) {
  const router = useRouter();
  const store = useContext(AccountContext);
  const [open, setOpen] = useState<Row | null>(resetPassword ? 'password' : null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [name, setName] = useState(account.name ?? '');
  const [email, setEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [words, setWords] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const finish = async (message: string) => {
    setDone(message);
    setOpen(null);
    setProblem(null);
    await store.refresh();
    router.refresh();
  };
  const run = async (fn: () => Promise<Answer>, message: string): Promise<Answer | null> => {
    setBusy(true);
    setProblem(null);
    setDone(null);
    const answer = await fn();
    setBusy(false);
    if (!answer.ok) {
      setProblem(errorOf(answer));
      return null;
    }
    await finish(message);
    return answer;
  };
  const show = (row: Row) => {
    setOpen(open === row ? null : row);
    setProblem(null);
    setDone(null);
    setPendingEmail(null);
  };

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    void run(() => call('/api/account', 'PATCH', { name }), 'Name saved.');
  };
  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    void run(() => call('/api/account', 'PATCH', { password }), 'Password saved.').then(a => a && setPassword(''));
  };
  const saveEmail = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const answer = await call('/api/account', 'PATCH', { email });
    setBusy(false);
    if (!answer.ok) return setProblem(errorOf(answer));
    setCode('');
    setPendingEmail(typeof answer.body.email === 'string' ? answer.body.email : email);
  };
  const confirmEmail = (e: FormEvent) => {
    e.preventDefault();
    void run(() => call('/api/auth/verify', 'POST', { email: pendingEmail, token: code, type: 'email_change' }), 'Email changed.').then(a => a && setPendingEmail(null));
  };
  const upload = (picked: File | undefined) => {
    if (!picked) return;
    const form = new FormData();
    form.set('file', picked);
    void run(() => call('/api/account/photo', 'POST', form), 'Photo saved.');
  };
  const removePhoto = () => void run(() => call('/api/account/photo', 'DELETE'), 'Photo removed.');
  const signOutEverywhere = async () => {
    setBusy(true);
    await call('/api/auth/sign-out', 'POST', { everywhere: true });
    go('/');
  };
  const remove = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    const answer = await call('/api/account', 'DELETE', { confirm: words });
    if (answer.ok) return go('/');
    setBusy(false);
    setProblem(errorOf(answer));
  };

  return (
    <div className="border-t border-border">
      {done && <p className="border-b border-border bg-surface px-1 py-3 text-sm text-text">{done}</p>}
      <Row label="Name" value={account.name ?? 'Not set'} action={<button type="button" className={QUIET} onClick={() => show('name')}>Edit</button>}>
        {open === 'name' && (
          <form onSubmit={saveName} className="flex flex-col gap-3">
            <input id="account-name" className={INPUT} type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={80} required autoFocus aria-label="Name" />
            <Problem>{problem}</Problem>
            <Actions busy={busy} onCancel={() => setOpen(null)} />
          </form>
        )}
      </Row>
      <Row
        label="Photo"
        value={
          <span className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-surface font-mono text-11 font-semibold uppercase text-text">
            {account.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initialsOf(account)
            )}
          </span>
        }
        action={
          <span className="flex flex-wrap gap-4">
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => upload(e.target.files?.[0])} aria-label="Choose a picture" />
            <button type="button" className={QUIET} disabled={busy} onClick={() => file.current?.click()}>
              Upload
            </button>
            {account.imageUrl && (
              <button type="button" className={QUIET} disabled={busy} onClick={removePhoto}>
                Remove
              </button>
            )}
          </span>
        }
      >
        {open === null && problem && <Problem>{problem}</Problem>}
      </Row>
      <Row label="Email" value={account.email ?? 'Not set'} action={<button type="button" className={QUIET} onClick={() => show('email')}>Change</button>}>
        {open === 'email' && !pendingEmail && (
          <form onSubmit={saveEmail} className="flex flex-col gap-3">
            <input id="account-email" className={INPUT} type="email" autoComplete="email" placeholder="The new address" value={email} onChange={e => setEmail(e.target.value)} required autoFocus aria-label="New email" />
            <Problem>{problem}</Problem>
            <Actions busy={busy} onCancel={() => setOpen(null)} />
          </form>
        )}
        {open === 'email' && pendingEmail && (
          <form onSubmit={confirmEmail} className="flex flex-col gap-3">
            <Note>
              We sent a six-digit code to <span className="text-text">{pendingEmail}</span>. Enter it to confirm the change.
            </Note>
            <CodeInput id="account-code" value={code} onChange={e => setCode(e.target.value)} required autoFocus aria-label="Code" />
            <Problem>{problem}</Problem>
            <Actions busy={busy} label="Confirm" onCancel={() => setPendingEmail(null)} />
          </form>
        )}
      </Row>
      <Row label="Password" value={providers.includes('email') ? 'Set' : 'Not set'} action={<button type="button" className={QUIET} onClick={() => show('password')}>{providers.includes('email') ? 'Change' : 'Set'}</button>}>
        {open === 'password' && (
          <form onSubmit={savePassword} className="flex flex-col gap-3">
            {resetPassword && <Note>Set a new password to finish.</Note>}
            <input id="account-password" className={INPUT} type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required autoFocus aria-label="New password" />
            <Problem>{problem}</Problem>
            <Actions busy={busy} onCancel={() => setOpen(null)} />
          </form>
        )}
      </Row>
      <Row label="Signed in" value={providers.length ? providers.map(providerName).join(', ') : 'Unknown'} />
      <Row label="Devices" value="Signed in here and on any other device you used" action={<button type="button" className={QUIET} disabled={busy} onClick={() => void signOutEverywhere()}>Sign out of every device</button>} />
      <Row label="Delete" value="The sign-in identity goes; what you posted and played stays under its id" action={<button type="button" className={`${QUIET} text-brand`} onClick={() => show('delete')}>Delete account</button>}>
        {open === 'delete' && (
          <form onSubmit={remove} className="flex flex-col gap-3">
            <Note>Type “{DELETE_WORDS}” to confirm. This cannot be undone.</Note>
            <input id="account-delete" className={INPUT} type="text" value={words} onChange={e => setWords(e.target.value)} required autoFocus aria-label="Confirmation" />
            <Problem>{problem}</Problem>
            <Actions busy={busy || words !== DELETE_WORDS} label="Delete my account" onCancel={() => setOpen(null)} />
          </form>
        )}
      </Row>
    </div>
  );
}

function Row({ label, value, action, children }: { label: string; value: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="border-b border-border py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="w-24 shrink-0 font-mono text-11 uppercase tracking-[0.16em] text-text-muted">{label}</span>
        <span className="min-w-0 flex-1 text-base text-text">{value}</span>
        {action && <span className="shrink-0">{action}</span>}
      </div>
      {children && <div className="mt-4 md:ml-28">{children}</div>}
    </div>
  );
}

function Actions({ busy, label = 'Save', onCancel }: { busy: boolean; label?: string; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" className={`${PRIMARY} w-auto`} disabled={busy}>
        {label}
      </button>
      <button type="button" className={QUIET} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
