import 'server-only';
import { currentAccount } from '@/lib/auth/server';
import { visitorFromAccount, type Visitor } from './authz-check';

export { ANONYMOUS, allowedKeys, mayShow, passes, visitorFromAccount } from './authz-check';
export type { Visitor } from './authz-check';

// The server side of the one evaluator (lib/design/authz-check.ts holds the
// rule): the visitor read from the signed-in account (lib/auth). Reading the
// session is a request-time API, so the catch-all calls this only when the page
// or a region asks for a scheme other than public; a wholly public page stays a
// cached render. The shell's lists run the same rule in the browser (useVisitor).

/** The current visitor from the session's account; anonymous when there is none. */
export async function currentVisitor(): Promise<Visitor> {
  return visitorFromAccount(await currentAccount());
}
