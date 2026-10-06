import type { WeekendNote as Note } from '@/lib/series-content';

/** The authored account of a race weekend, rendered above the session list on
 *  the live weekend page and on its archive copy.
 *
 *  Why it exists: measured on prod 2026-08-28, a weekend page carries 140–213
 *  rendered words and **no original prose at all** — section headings, a
 *  standings table and syndicated news headlines. The classification says who
 *  won; nothing on the page says how, or what it changed. That is the one thing
 *  the data cannot produce.
 *
 *  Deliberately NOT a circuit description. The 139 track profiles already cover
 *  layout and history at ~307 words each, and repeating them here would
 *  manufacture near-duplicate text across two families — the exact problem this
 *  programme exists to remove.
 *
 *  Sources render inline: a race report that cannot be checked is worth less
 *  than no race report (RULE #1). */
export function WeekendNote({ note }: { note: Note }) {
  const lead = note.lead?.trim();
  const body = note.note?.trim();
  if (!lead && !body) return null;

  // The id and scroll offset pair with the weekend page's "On this page" bar.
  // The offset clears the fixed header so the heading is not hidden on arrival;
  // it is spelled out here rather than imported because this component is the
  // only thing that owns this section.
  return (
    <section id="how-it-was-won" aria-label="How the race was won" className="mb-8 scroll-mt-[calc(62px+env(safe-area-inset-top))] lg:scroll-mt-[calc(74px+env(safe-area-inset-top))]">
      <div className="mb-1 flex items-baseline justify-between border-b border-text pb-1">
        <span className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">
          How it was won
        </span>
      </div>
      {lead ? (
        <p className="pt-3 font-serif text-17 leading-snug text-text">{lead}.</p>
      ) : null}
      {body ? (
        <p className="mt-2.5 text-14 leading-relaxed text-text-muted">{body}</p>
      ) : null}
      {note.sources && note.sources.length > 0 ? (
        <p className="mt-3 font-mono text-10 uppercase tracking-[0.12em] text-text-faint">
          Checked against{' '}
          {note.sources.map((url, i) => {
            let host = url;
            try {
              host = new URL(url).host.replace(/^www\./, '');
            } catch {
              /* keep the raw string rather than dropping the citation */
            }
            return (
              <span key={url}>
                {i > 0 ? ' · ' : ''}
                <a href={url} rel="nofollow noopener" className="hover:text-text hover:underline">
                  {host}
                </a>
              </span>
            );
          })}
        </p>
      ) : null}
    </section>
  );
}
