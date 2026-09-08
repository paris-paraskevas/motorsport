import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';

export const dynamic = 'force-dynamic';

const BASE_METADATA: Metadata = {
  title: 'Sign up',
  robots: { index: false, follow: false },
};
export const generateMetadata = pageMetadata('/sign-up', BASE_METADATA);

function SignUpPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
      {/* Brand appearance inherited from the ClerkProvider in the layout. */}
      <SignUp
        appearance={{
          elements: {
            card: 'bg-surface border border-border shadow-2xl shadow-black/60',
          },
        }}
      />
    </div>
  );
}

export default withPageGate('/sign-up', SignUpPage);
