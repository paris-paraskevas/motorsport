import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_READ } from '@/lib/site';
import { WriteForUsForm } from '@/components/authors/WriteForUsForm';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Write for Paddock',
  description:
    'Pitch motorsport writing to Paddock Tracker: race analysis, championship deep-dives and paddock commentary with a byline and a public author page of your own.',
  alternates: { canonical: '/write-for-us' },
};

// The become-an-author page (item 14): editorial pitch on top, the application
// form below. The page is public + indexable (it is recruiting copy); the form
// itself adapts client-side (sign-in CTA → form → sent), so this stays
// revalidate-cached like /blog. Approval grants the `contributor` role — the
// ladder is documented on lib/threads.ts canAuthor.
export default function WriteForUsPage() {
  return (
    <div className={PAGE_READ}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Write for Paddock', url: `${SITE_URL}/write-for-us` },
        ])}
      />
      <header className="mb-8">
        <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-text-faint">
          Writing
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-text md:text-4xl">Write for Paddock</h1>
        <p className="mt-3 text-base leading-relaxed text-text-muted">
          Race analysis with a byline that links to a page of your own. Pitch us; we read all of it
          and reply by email either way.
        </p>
      </header>

      <div className="mb-8 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
            What you get
          </h2>
          <ul className="space-y-1.5 text-sm leading-relaxed text-text-muted">
            <li>A public author page collecting your bio, links and posts.</li>
            <li>A writing studio: draft privately, submit when ready.</li>
            <li>An editor reviews and schedules; you are told what happened and when it goes live.</li>
          </ul>
        </section>
        <section>
          <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
            What we ask
          </h2>
          <ul className="space-y-1.5 text-sm leading-relaxed text-text-muted">
            <li>Original writing only. Imports are possible, but credited and canonical to the source.</li>
            <li>Facts checked against primary sources; claims you can stand behind.</li>
            <li>House style: plain sharp prose. The editor will bounce AI filler.</li>
          </ul>
        </section>
      </div>

      <WriteForUsForm />
    </div>
  );
}
