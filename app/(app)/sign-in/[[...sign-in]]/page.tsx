import type { Metadata } from 'next';
import { SignIn } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
      {/* Brand appearance inherited from the ClerkProvider in the layout. */}
      <SignIn
        appearance={{
          elements: {
            card: 'bg-surface border border-border shadow-2xl shadow-black/60',
          },
        }}
      />
    </div>
  );
}
