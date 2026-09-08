'use client';

import { useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import type { NavEntry } from '@/lib/design/destinations';
import type { AuthzScheme } from '@/lib/design/authz-defaults';
import { mayShow, visitorFromClerkUser, type Visitor } from '@/lib/design/authz-check';

// The browser side of the one evaluator (lib/design/authz-check.ts). The shell
// renders inside a layout that is cached, so an entry that asks for an
// authorization scheme cannot be decided on the server for every visitor: it is
// hidden in the cached render (Clerk's user is not loaded yet, the visitor is
// anonymous) and appears after hydration for a visitor who passes. Entries for
// everyone never flicker.

/** The current visitor as Clerk knows them in the browser; anonymous until loaded. */
export function useVisitor(): Visitor {
  const { user, isLoaded } = useUser();
  return useMemo(() => visitorFromClerkUser(isLoaded ? user : null), [user, isLoaded]);
}

/** The entries the visitor may see. With no schemes given (the designer's
 *  previews), every entry shows. */
export function useVisibleEntries(entries: NavEntry[], schemes?: readonly AuthzScheme[]): NavEntry[] {
  const visitor = useVisitor();
  return useMemo(
    () => (schemes ? entries.filter(e => mayShow(e.authz, schemes, visitor)) : entries),
    [entries, schemes, visitor],
  );
}
