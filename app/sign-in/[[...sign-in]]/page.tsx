import { SignIn } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
      <SignIn
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
