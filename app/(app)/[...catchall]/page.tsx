import { notFound } from 'next/navigation';

// With two root layouts there is no shared segment to own a global 404, and
// Next 16's global-not-found.js is still experimental. Unmatched URLs fall
// through to this catch-all so the branded (app) not-found page renders.
export default function CatchAll(): never {
  notFound();
}
