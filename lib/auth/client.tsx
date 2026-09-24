'use client';
import { useCallback, useMemo, type ReactNode } from 'react';
import { ClerkProvider, SignInButton, SignOutButton as ClerkSignOutButton, UserButton, useUser } from '@clerk/nextjs';

// The account seam's browser half (PA A1b): the only browser code that knows the provider. Every browser file reads
// useAccount() and the pieces below; A3 puts Supabase Auth behind them (the account from /api/account, the sign-in link to
// our own page, the account button our own menu) and no caller changes. R9's lesson holds here too: a piece and its child
// are created together in the browser; a Server Component's element child is never handed to one.

/** A signed-in person as the site reads them, the same on the server (lib/auth/server.ts) and in the browser. */
export interface Account {
  /** The app's id for the person, the value every user column of every table holds: Clerk's user id today; after the
   *  switch (A3) an imported account keeps it as its legacy id and a new account's id is its Supabase id. Never handed to a
   *  provider's admin call as the provider's own id once the two can differ. */
  id: string;
  /** The primary address; null when the provider holds none. */
  email: string | null;
  /** The full name, else first and last; null when neither is set. */
  name: string | null;
  username: string | null;
  /** A photo the person uploaded; null otherwise (Clerk serves a generated placeholder for everyone, so only its hasImage tells). */
  imageUrl: string | null;
  /** The role when set: admin, moderator, writer or contributor (lib/threads.ts reads the ladders). */
  role: string | null;
  /** The supporter flag an admin sets when a donation arrives. */
  donor: boolean;
}

/** What the browser mapping reads of Clerk's user (a structural subset of @clerk/nextjs's UserResource). */
export interface ClerkBrowserUserLike {
  id: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: { emailAddress: string }[];
  publicMetadata?: { role?: unknown; donor?: unknown } | null;
  unsafeMetadata?: Record<string, unknown> | null;
  update?: (params: { unsafeMetadata: Record<string, unknown> }) => Promise<unknown>;
}

/** The Account of Clerk's browser user, by the server's rules (lib/auth/server.ts accountFromClerkUser; the test holds the
 *  two equal): the primary address, else the first; the full name, else first and last; a photo only when uploaded; the
 *  role when a string; donor only when true. Written twice on purpose: a 'use client' module's exports are client
 *  references on the server, and A3 makes the two mappings differ (claims on the server, /api/account here). */
export function accountFromBrowserUser(u: ClerkBrowserUserLike | null | undefined): Account | null {
  if (!u) return null;
  const meta = u.publicMetadata ?? null;
  return {
    id: u.id,
    email: u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null,
    name: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || null,
    username: u.username || null,
    imageUrl: u.hasImage ? u.imageUrl || null : null,
    role: typeof meta?.role === 'string' ? meta.role : null,
    donor: meta?.donor === true,
  };
}

export interface AccountState {
  /** The signed-in person; null before the provider has loaded and null signed out. */
  account: Account | null;
  /** Whether the provider has answered yet: a cached page's first render has not, so a piece that depends on the person
   *  waits for it rather than flashing the signed-out state. */
  isLoaded: boolean;
  isSignedIn: boolean;
  /** The picture the provider shows for the person, a generated one without a photo (the header and the bottom bar draw
   *  it); Account.imageUrl carries the photo alone. A3: the photo or null. */
  avatarUrl: string | null;
}

/** The signed-in person in the browser, as Clerk's useUser answers today. */
export function useAccount(): AccountState {
  const { isLoaded, isSignedIn, user } = useUser();
  return useMemo(() => {
    const on = isLoaded && isSignedIn === true;
    return { account: on ? accountFromBrowserUser(user) : null, isLoaded, isSignedIn: on, avatarUrl: on ? user?.imageUrl || null : null };
  }, [isLoaded, isSignedIn, user]);
}

/** The per-person flags the browser writes (Clerk's unsafeMetadata today: the support prompt's opt-out, the announcement
 *  dismissed); null signed out. setFlag merges one key and writes; a failed write rejects and the caller keeps its local
 *  fallback. A3: the account's own prefs through /api/account. */
export function useAccountFlags(): { flags: Record<string, unknown> | null; setFlag: (key: string, value: unknown) => Promise<void> } {
  const { isLoaded, isSignedIn, user } = useUser();
  const on = isLoaded && isSignedIn === true && Boolean(user);
  const flags = useMemo(() => (on ? ((user?.unsafeMetadata as Record<string, unknown> | undefined) ?? {}) : null), [on, user]);
  const setFlag = useCallback(
    async (key: string, value: unknown) => {
      if (!on || !user) throw new Error('signed out');
      await user.update({ unsafeMetadata: { ...(user.unsafeMetadata as Record<string, unknown> | undefined), [key]: value } });
    },
    [on, user],
  );
  return { flags, setFlag };
}

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

/** The provider around a host's tree: the (app) layout's site look, the (admin) layout's console look. */
export function AuthProvider({ look, children }: { look: keyof typeof LOOKS; children: ReactNode }) {
  return (
    <ClerkProvider {...URLS} appearance={LOOKS[look]}>
      {children}
    </ClerkProvider>
  );
}

/** A sign-in affordance around one button created here in the browser: Clerk's modal today, a link to our own page in A3. */
export function SignInLink({ children }: { children: ReactNode }) {
  return <SignInButton mode="modal">{children}</SignInButton>;
}

/** A sign-out affordance around one button created here in the browser (never a Server Component's child: R9). */
export function SignOutButton({ children, redirectUrl }: { children: ReactNode; redirectUrl?: string }) {
  return <ClerkSignOutButton redirectUrl={redirectUrl}>{children}</ClerkSignOutButton>;
}

/** The person's avatar with the provider's account menu behind it: Clerk's UserButton today, our own Account page's menu in A3. */
export function AccountButton({ avatarClassName }: { avatarClassName: string }) {
  return <UserButton appearance={{ elements: { avatarBox: avatarClassName } }} />;
}
