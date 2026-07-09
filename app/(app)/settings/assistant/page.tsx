import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { ArrowLeft } from 'lucide-react';
import { isAdmin } from '@/lib/threads';
import { readInsights } from '@/lib/assistant/log';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Assistant insights',
  robots: { index: false, follow: false },
};

// Admin-only view of Race Engineer usage: what people ask, how often, per-user
// counts, and 👍/👎 — so the operator can expand the help corpus to cover the
// common questions and fix the down-voted ones. 404s for non-admins.
export default async function AssistantInsightsPage() {
  if (!isAdmin(await currentUser())) notFound();
  const d = await readInsights();

  return (
    <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <ArrowLeft size={13} /> Account
      </Link>
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden className="w-1 shrink-0 bg-brand" />
        <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
          Assistant insights<span className="text-brand">.</span>
        </h1>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Questions" value={d.totalQuestions} />
        <Stat label="Users" value={d.uniqueUsers} />
        <Stat label="👍" value={d.feedback.up} />
        <Stat label="👎" value={d.feedback.down} />
      </div>

      <Section title="Top questions">
        {d.topQuestions.length === 0 ? (
          <Empty />
        ) : (
          <ol className="divide-y divide-border">
            {d.topQuestions.map(t => (
              <li key={t.q} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="text-text">{t.q}</span>
                <span className="shrink-0 font-mono tabular-nums text-text-muted">{t.count}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {d.feedback.topDownvoted.length > 0 && (
        <Section title="Most down-voted (fix these)">
          <ol className="divide-y divide-border">
            {d.feedback.topDownvoted.map(t => (
              <li key={t.q} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="text-text">{t.q}</span>
                <span className="shrink-0 font-mono tabular-nums text-red-400">👎 {t.count}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="Recent questions">
        {d.recent.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-border">
            {d.recent.map((r, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-1.5 font-mono text-xs">
                <span className={r.ok ? 'text-text' : 'text-red-400'}>{r.q}</span>
                <span className="shrink-0 text-text-faint">{r.ok ? '' : 'failed · '}{new Date(r.ts).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Top users (by questions)">
        {d.topUsers.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-border">
            {d.topUsers.map(u => (
              <li key={u.u} className="flex items-baseline justify-between gap-3 py-1.5 font-mono text-xs">
                <span className="truncate text-text-muted">{u.u}</span>
                <span className="shrink-0 tabular-nums text-text-muted">{u.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="mt-6 font-mono text-[11px] leading-relaxed text-text-faint">
        Retention is bounded by count (a capped recent list + rolling counters), not time — see the privacy policy. Data comes from Vercel KV; empty until questions are asked on prod.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3">
      <div className="font-display text-2xl font-extrabold tabular-nums text-text">{value.toLocaleString()}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="font-mono text-sm text-text-faint">No data yet.</p>;
}
