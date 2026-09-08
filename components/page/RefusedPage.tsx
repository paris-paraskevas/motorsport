import Link from 'next/link';
import { PAGE_READ } from '@/lib/site';

// What a visitor who fails a page's authorization scheme meets, when the scheme
// carries a message: the page's title, the sentence, and Sign in when signing
// in could help. One screen for a page made in the designer (the catch-all)
// and for a page the code serves (withPageGate, lib/design/page-frame.tsx). A
// scheme with no message shows the 404 instead; the callers decide that.
export function RefusedPage({ title, message, signInHelps }: { title: string; message: string; signInHelps: boolean }) {
  return (
    <main className={PAGE_READ}>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-38 font-medium leading-none tracking-[-0.02em] text-text md:text-46">{title}</h1>
      </header>
      <p className="max-w-[52ch] font-serif text-17 leading-snug text-text-muted">{message}</p>
      {signInHelps && (
        <Link
          href="/sign-in"
          className="mt-6 inline-flex min-h-11 items-center bg-text px-5 font-mono text-11 font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted"
        >
          Sign in
        </Link>
      )}
    </main>
  );
}
