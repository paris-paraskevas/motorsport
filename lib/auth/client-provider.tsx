'use client';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';

// The account seam's provider (PA A1b), a module of its own: the two layouts alone import it, so Clerk's provider code
// stays in their chunk groups and never rides with useAccount into every route's (the Worker grew 2 MiB when it did).

/** The four addresses the provider's pieces need, the same on both hosts. */
const URLS = { signInUrl: '/sign-in', signUpUrl: '/sign-up', signInFallbackRedirectUrl: '/', signUpFallbackRedirectUrl: '/' } as const;

/** The two looks of the provider's own screens. The site's asserts the brand accent alone: Clerk 7 honours only
 *  colorPrimary, colorBackground and borderRadius (colorText, colorTextOnPrimaryBackground and colorInput* were silently
 *  ignored: --cl-color-* were unset at run time while the heading still computed to white), a hard-coded light
 *  colorBackground painted the card cream on the dark themes under Clerk's white heading (the unreadable sign-in modal),
 *  and Clerk 7's default theme follows the CSS color-scheme, which globals.css declares per theme, so the modal tracks
 *  whichever of the six themes is active for free. The console's is its paper palette. */
const LOOKS = {
  site: { variables: { colorPrimary: '#8c1c13' } },
  console: { variables: { colorBackground: '#fffcf2', colorText: '#1e1a13', colorPrimary: '#8c1c13', colorTextOnPrimaryBackground: '#f7f3e8', colorInputBackground: '#fbf7ec', colorInputText: '#1e1a13' } },
} as const;

/** The provider around a host's tree: the (app) layout's site look, the (admin) layout's console look. A3 replaces it
 *  with our own, over /api/account. */
export function AuthProvider({ look, children }: { look: keyof typeof LOOKS; children: ReactNode }) {
  return (
    <ClerkProvider {...URLS} appearance={LOOKS[look]}>
      {children}
    </ClerkProvider>
  );
}
