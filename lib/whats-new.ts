/** The What's-New modal's content, one entry per release that earns one.
 *
 *  Why an array rather than a single announcement: this is the recurring release
 *  dialog (operator decision, 2026-08-26, replacing the one-off 1.0 banner). The
 *  modal shows the NEWEST entry a reader has not dismissed, keyed by `id`, so a
 *  reader who dismissed 1.0 still meets 1.1. Bump `id` for every new entry or
 *  nobody who dismissed the last one will see it.
 *
 *  Ships DARK: an entry with `active: false` is skipped entirely, so merging
 *  content ahead of a launch is a no-op for readers. Flip `active` in the SAME
 *  commit that bumps `package.json` to the matching version — `/changelog`
 *  reports the running version, and announcing 1.0 while running 0.334.x lies.
 *  Since 1.0.44 the Application Setting `announcement.active_id` (the
 *  designer's Application Settings) decides which entry is in force at render,
 *  seeded with the active one; `active` stays the shipped fallback.
 *
 *  ⚠ COPY NEEDS THE OPERATOR'S SIGN-OFF BEFORE `active` GOES TRUE. `chips` and
 *  card bodies describe what EXISTS.
 *
 *  `next` IS a roadmap, and that reverses what this comment said until 0.334.88.
 *  It used to read "nothing here is a roadmap, deliberately — the previous
 *  draft's 'what comes next' list made three public promises and the operator's
 *  own kill list had already ruled out one of them." **Checked against IDEAS.md
 *  on 2026-08-28: none of the three is killed.** All are live parked plans —
 *  the image session (NOW §4), the day page and the Street View corner tours
 *  (both operator-raised 2026-08-22). What the kill list actually contains
 *  nearby is that *portraits ×14 and team logos* died on LICENSING, which is a
 *  constraint on how the image session sources pictures, not a kill of it.
 *  launch-checklist §A9 requires a "what to expect later" section, so the
 *  section is back, operator-signed per item on 2026-08-28. */

/** Keys into the screenshot registry (`components/whats-new/CardShot.tsx`).
 *  Each names one real surface of the site, captured light and dark. Adding a
 *  key without adding both crops renders an empty banner, so add them together.
 *
 *  There is deliberately no 'predictions' key: signed out, `/social` is a
 *  sign-in wall, and a crop of a wall advertises nothing. It is a chip instead. */
export type WhatsNewArt =
  | 'calendar'
  | 'standings'
  | 'writing'
  | 'analysis'
  | 'circuits'
  | 'record';

export interface WhatsNewCard {
  art: WhatsNewArt;
  title: string;
  body: string;
}

export interface WhatsNewEntry {
  /** Dismissal key. Never reuse one. */
  id: string;
  /** Rendered in the header pill, and as the ghosted numeral behind the hero. */
  version: string;
  active: boolean;
  title: string;
  intro: string;
  cards: WhatsNewCard[];
  /** One-liners for things that need saying but not a card. */
  chips: string[];
  /** "What to expect later" — required by launch-checklist §A9. EVERY LINE IS A
   *  PUBLIC PROMISE the moment the entry goes active, so each one needs the
   *  operator's sign-off individually; better three that ship than ten that rot.
   *  Empty array renders nothing. */
  next: string[];
  ctaLabel: string;
  ctaHref: string;
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: 'v1.0',
    version: '1.0',
    // LIVE as of 1.0.0, 2026-09-04. Flipped in the same commit as the
    // package.json bump, per launch-checklist §B: /changelog reports the running
    // version, so announcing 1.0 while running 0.334.x would lie to readers.
    active: true,
    title: 'Paddock is out of early access',
    intro:
      'Fifteen championships in one place, every session in your own time zone. Built in the open over a hundred days, and free, with no account needed to use most of it.',
    // Ordered as a reader meets the site: what is on this weekend, who is
    // winning, what we wrote about it, how deep it goes, where it happens, and
    // who has done it before.
    cards: [
      {
        art: 'calendar',
        title: 'Every session, in your time',
        body: 'Fifteen series in one calendar, grouped by race weekend rather than scattered across dates, and converted to wherever you happen to be.',
      },
      {
        art: 'standings',
        title: 'Results and standings, kept current',
        body: 'Full classifications for every round and live championship tables, with a season chart whose totals always agree with the table beside it.',
      },
      {
        art: 'writing',
        title: 'Written here, checked here',
        body: 'Previews, race reports and analysis, fact-checked against primary sources, with every number linked back to the page it came from.',
      },
      {
        art: 'analysis',
        title: 'Formula 1, taken apart',
        body: 'Qualifying decoded sector by sector and the onboard rebuilt from real GPS, so you can see where a lap was won rather than being told.',
      },
      {
        art: 'circuits',
        title: 'Every circuit on the map',
        body: '138 venues plotted and filterable by championship, each one opening a guide to its layout, its history and what makes it hard.',
      },
      {
        art: 'record',
        title: 'The record, and where it was settled',
        body: 'Champions back to 1950, each with the race that decided the title, what the season turned on, and the sources it was checked against.',
      },
    ],
    // Deliberately NOT restating the cards: "champions back to 1950" was a chip
    // and a card until the duplication showed up in the first screenshot.
    chips: [
      'Weather by the hour',
      'Alerts before a session starts',
      'Predictions and friend leagues, play money only',
      'Installs as an app',
      'No account needed to browse',
    ],
    // Operator-signed 2026-08-28, all three as drafted. Each is a live plan in
    // IDEAS.md — the image session, the day page, the Street View corner tours.
    next: [
      'Photography across the site, so every page has something to look at',
      'A page for each day of a race weekend, with that day’s forecast, news and sessions',
      'Circuit maps, and a corner-by-corner tour of the ones worth walking',
    ],
    ctaLabel: 'See the full changelog',
    ctaHref: '/changelog',
  },
];

/** The entry in force. With no argument, the newest entry flagged `active` in
 *  code, which is the shipped behaviour. Given the `announcement.active_id`
 *  setting, that entry by id; null for '' (hidden) and for an id no entry
 *  carries. Null is the normal state between releases. */
export function currentWhatsNew(activeId?: string): WhatsNewEntry | null {
  if (activeId === undefined) return WHATS_NEW.find(e => e.active) ?? null;
  if (activeId === '') return null;
  return WHATS_NEW.find(e => e.id === activeId) ?? null;
}
