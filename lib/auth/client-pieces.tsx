'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cloneElement, isValidElement, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { initialsOf, useAccount } from './client';

// The account seam's pieces (PA A1b; the site's own since A3), a module of its own beside the hooks: the identity strip,
// the header's menu and the application form import it. Each piece is created here in the browser together with its
// child; a Server Component's element child is never handed to one (R9).

type Clickable = ReactElement<{ onClick?: (e: MouseEvent<HTMLElement>) => void }>;

/** The child with a click added after its own; a plain button around anything that is not an element. */
function withClick(children: ReactNode, onClick: () => void): ReactNode {
  if (isValidElement(children)) {
    const child = children as Clickable;
    return cloneElement(child, {
      onClick: (e: MouseEvent<HTMLElement>) => {
        child.props.onClick?.(e);
        if (!e.defaultPrevented) onClick();
      },
    });
  }
  return (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );
}

/** The sign-in page's address with the way back to the page the person is on; Home needs no way back. */
export function signInHref(pathname: string | null | undefined): string {
  const back = pathname && pathname !== '/' && !pathname.startsWith('/sign-in') && !pathname.startsWith('/sign-up') ? pathname : null;
  return back ? `/sign-in?next=${encodeURIComponent(back)}` : '/sign-in';
}

/** A sign-in affordance around one button: the site's own sign-in page, with the way back. */
export function SignInLink({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  return withClick(children, () => router.push(signInHref(pathname)));
}

/** A sign-out affordance around one button: the session ends on the server, then the page reloads at the address given
 *  (Home by default), so nothing of the person stays drawn. */
export function SignOutButton({ children, redirectUrl }: { children: ReactNode; redirectUrl?: string }) {
  return withClick(children, () => {
    void fetch('/api/auth/sign-out', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: '{}' })
      .catch(() => undefined)
      .finally(() => window.location.assign(redirectUrl ?? '/'));
  });
}

/** The person's picture (their photo, else their initials) as a link to the Account page. */
export function AccountButton({ avatarClassName }: { avatarClassName: string }) {
  const { account } = useAccount();
  return (
    <Link
      href="/settings/account"
      aria-label="Your account"
      className={`${avatarClassName} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-strong bg-surface font-mono text-11 font-semibold uppercase text-text transition-colors duration-(--duration-fast) hover:border-text`}
    >
      {account?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{initialsOf(account)}</span>
      )}
    </Link>
  );
}
