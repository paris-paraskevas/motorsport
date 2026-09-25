import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SignInForm } from '@/components/auth/SignInForm';
import { accountId } from '@/lib/auth/server';
import { safeNext } from '@/lib/auth/supabase';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';

export const dynamic = 'force-dynamic';

const BASE_METADATA: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};
export const generateMetadata = pageMetadata('/sign-in', BASE_METADATA);

type Search = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// The site's own sign-in page (PA A3): the form posts to /api/auth; the way back rides in `next` (the older links say
// `redirect_url`, the provider's word, and still work). A person already signed in goes straight on.
async function SignInPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const next = safeNext(first(params.next) ?? first(params.redirect_url));
  if (await accountId()) redirect(next);
  return (
    <div className="mx-auto w-full max-w-md p-4 pb-16 md:p-6 lg:p-8">
      <SignInForm next={next} siteKey={process.env.TURNSTILE_SITE_KEY ?? null} googleClientId={process.env.GOOGLE_CLIENT_ID ?? null} />
    </div>
  );
}

export default withPageGate('/sign-in', SignInPage);
