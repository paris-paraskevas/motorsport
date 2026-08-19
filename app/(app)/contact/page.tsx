import type { Metadata } from 'next';
import { ContactForm } from '@/components/ContactModal';
import { PAGE_READ } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Write to Paddock Tracker — bug reports, feature requests, suggestions or a data-export request. We reply by email.',
  alternates: { canonical: '/contact' },
};

// The durable home for the contact form (round-2 fix ①): the Account page's
// "Export your data" row linked /contact in 0.298.0 before this route existed
// — every hit was a 404. The footer's Contact keeps its modal; both render
// the same ContactForm.
export default function ContactPage() {
  return (
    <div className={PAGE_READ}>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-[38px] font-medium leading-none tracking-[-0.02em] text-text md:text-[46px]">
          Contact
        </h1>
        <p className="mt-2 max-w-[52ch] font-serif text-[16px] leading-snug text-text-muted">
          Bugs, ideas, corrections, or a copy of your data — write and we reply
          by email.
        </p>
      </header>

      <div className="max-w-[560px] border-[1.5px] border-text bg-surface-elevated p-5">
        <ContactForm />
      </div>

      <p className="mt-4 max-w-[68ch] font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
        Asking for your data? Say so in the message and we send everything we
        hold to your address. Messages are kept for twelve months, then deleted
        — the privacy page has the full policy.
      </p>
    </div>
  );
}
