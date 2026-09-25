import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AccountForm } from '@/components/auth/AccountForm';
import { accountFromClaims, currentClaims } from '@/lib/auth/server';
import { PAGE_READ } from '@/lib/site';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';

export const dynamic = 'force-dynamic';

const BASE_METADATA: Metadata = {
  title: 'Account details',
  robots: { index: false, follow: false },
};
export const generateMetadata = pageMetadata('/settings/account', BASE_METADATA);

type Search = Promise<Record<string, string | string[] | undefined>>;

// The Account details page under Settings (PA A3; Clerk's Manage account before): name, photo, email, password, where
// the person signs in from, every device signed out, the account deleted. `?reset=1` arrives from a password reset's
// code and opens the password row.
async function AccountDetailsPage({ searchParams }: { searchParams: Search }) {
  const claims = await currentClaims();
  const account = accountFromClaims(claims);
  if (!claims || !account) redirect('/sign-in?next=%2Fsettings%2Faccount');
  const list = claims.app_metadata?.providers;
  const providers = Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : [];
  const reset = (await searchParams).reset === '1';
  return (
    <div className={PAGE_READ}>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-11 uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <ArrowLeft size={13} /> Account
      </Link>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-38 font-medium leading-none tracking-[-0.02em] text-text md:text-46">Account details</h1>
        <p className="mt-2 font-serif text-16 leading-snug text-text-muted">Your name, photo, email and password.</p>
      </header>
      <AccountForm account={account} providers={providers} resetPassword={reset} />
    </div>
  );
}

export default withPageGate('/settings/account', AccountDetailsPage);
