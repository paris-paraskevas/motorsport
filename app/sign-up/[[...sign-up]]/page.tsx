import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign up',
};

export default function SignUpPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
      <SignUp
        appearance={{
          variables: {
            colorBackground: '#0a0a0a',
            colorText: '#fafafa',
            colorPrimary: '#fafafa',
            colorTextOnPrimaryBackground: '#0a0a0a',
            colorInputBackground: '#18181b',
            colorInputText: '#fafafa',
          },
          elements: {
            card: 'bg-zinc-950 border border-zinc-800 shadow-2xl shadow-black/60',
          },
        }}
      />
    </div>
  );
}
