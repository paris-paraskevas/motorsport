'use client';
import type { ReactNode } from 'react';
import { SignInButton, SignOutButton as ClerkSignOutButton, UserButton } from '@clerk/nextjs';

// The account seam's pieces (PA A1b), a module of its own beside the hooks: the identity strip, the header's menu and the
// application form import it, and useAccount's readers never carry Clerk's UI code. Each piece is created here in the
// browser together with its child; a Server Component's element child is never handed to one (R9).

/** A sign-in affordance around one button: Clerk's modal today, a link to our own page in A3. */
export function SignInLink({ children }: { children: ReactNode }) {
  return <SignInButton mode="modal">{children}</SignInButton>;
}

/** A sign-out affordance around one button. */
export function SignOutButton({ children, redirectUrl }: { children: ReactNode; redirectUrl?: string }) {
  return <ClerkSignOutButton redirectUrl={redirectUrl}>{children}</ClerkSignOutButton>;
}

/** The person's avatar with the provider's account menu behind it: Clerk's UserButton today, our own Account page's menu in A3. */
export function AccountButton({ avatarClassName }: { avatarClassName: string }) {
  return <UserButton appearance={{ elements: { avatarBox: avatarClassName } }} />;
}
