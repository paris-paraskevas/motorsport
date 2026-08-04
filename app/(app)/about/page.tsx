import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_READ } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description:
    'What Paddock is, where its data comes from, and how it stays accurate: fifteen championships, curated schedules, verified results, one installable app.',
};

// In-prose link: body copy is muted, so links carry full text colour to read as links.
function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-text underline underline-offset-2 transition-colors duration-(--duration-fast) hover:text-brand"
    >
      {children}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-5">
      <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

export default function About() {
  return (
    <div className={PAGE_READ}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'About', url: `${SITE_URL}/about` },
        ])}
      />
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden className="w-1 shrink-0 bg-brand-fill" />
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-text md:text-4xl">
            About<span className="text-brand">.</span>
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Fifteen championships · one place
          </p>
        </div>
      </header>

      <p className="mb-6 max-w-[64ch] text-base leading-relaxed text-text">
        Paddock tracks fifteen racing championships in one place: what is on, when it runs where you live, and what
        happened once it did.
      </p>

      <div className="max-w-[64ch] space-y-6">
        <Section title="What Paddock is">
          <p>
            Formula 1, Formula 2, Formula 3, Formula E, IndyCar, NASCAR Cup, MotoGP, World Superbike, WEC, IMSA, GT
            World Challenge Europe, DTM, WRC, the Nürburgring Langstrecken-Serie and the ADAC Ravenol 24h. Every race
            weekend gets its own page and every session its own time, shown in your device&apos;s timezone, with
            standings, results, news and venue weather alongside.
          </p>
          <p>
            Paddock installs as an app on phone or desktop, and everything public works without an account. A free
            account adds race-day notifications, saved preferences, a prediction game played with virtual credits, and
            community threads.
          </p>
        </Section>

        <Section title="Where the data comes from">
          <p>
            Schedules start from each championship&apos;s official calendar feed, and hand-curated corrections take
            over wherever official data is thin, late or wrong. A curated time in Paddock&apos;s own content layer
            always beats a live feed.
          </p>
          <p>
            Results and standings are parsed from official and public timing sources on a rolling schedule through the
            day, then stored in Paddock&apos;s own database. Pages serve the last verified snapshot instead of calling
            upstream services on every visit, so when a source goes down you see slightly older data, never a blank
            page.
          </p>
          <p>
            Venue weather comes from Open-Meteo, looked up for the circuit&apos;s local date. News is drawn from public
            feeds for each series. Longer-form pages, like the <A href="/information">information hub</A> and the
            champions archives, are researched and fact-checked against primary sources before they ship.
          </p>
        </Section>

        <Section title="Accuracy and corrections">
          <p>
            A wrong session time is worse than a missing one, so curated facts are checked against primary sources
            before they go live. If something still looks off, use the Contact button in the header, or the details on
            the <A href="/imprint">imprint</A>. Corrections ship fast, and the{' '}
            <A href="/changelog">release notes</A> record every change as it reaches the site.
          </p>
        </Section>

        <Section title="Keep exploring">
          <ul className="space-y-2">
            <ExploreRow href="/information" title="Information hub" desc="Plain-language answers on how each championship actually works." />
            <ExploreRow href="/changelog" title="Release notes" desc="Every change, as it ships. The version in the footer is the code you are on." />
            <ExploreRow href="/blog" title="Blog" desc="Race previews, digests and analysis." />
            <ExploreRow href="/imprint" title="Imprint and contact" desc="Who runs Paddock and how to reach them." />
          </ul>
        </Section>
      </div>
    </div>
  );
}

function ExploreRow({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 border border-border bg-surface-elevated px-3 py-2.5 transition-colors duration-(--duration-fast) hover:border-brand"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-text">{title}</span>
          <span className="block text-xs text-text-faint">{desc}</span>
        </span>
        <ArrowRight size={14} className="shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
