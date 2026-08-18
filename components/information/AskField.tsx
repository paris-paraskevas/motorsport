'use client';

import Link from 'next/link';
import { useState } from 'react';

// The Learn hub's "Ask a question" field (design handoff §4.3, panel 9a):
// a 44px input with a hard ink border that filters the full answer index in
// place — the writing is the product, the field is how you reach it. Pure
// client filtering over the slim list the server ships; no network.
export function AskField({ entries }: { entries: Array<{ q: string; href: string }> }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const hits = q ? entries.filter(e => e.q.toLowerCase().includes(q)).slice(0, 8) : [];

  return (
    <div className="max-w-2xl">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Ask a question — try “how a MotoGP race weekend works”"
        aria-label="Search the answers"
        className="h-11 w-full border-[1.5px] border-text bg-surface-elevated px-3 font-mono text-[12px] text-text outline-none placeholder:text-text-muted"
      />
      {q && (
        <div className="border-x border-b border-border bg-surface-elevated">
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-sm text-text-muted">
              Nothing matches — try a driver, a rule, or a series name.
            </p>
          ) : (
            hits.map(h => (
              <Link
                key={h.href}
                href={h.href}
                className="block border-b border-border px-3 py-2.5 font-serif text-[15px] font-semibold leading-snug text-text last:border-b-0 hover:bg-surface"
              >
                {h.q}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
