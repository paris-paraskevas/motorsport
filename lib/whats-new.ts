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
 *
 *  ⚠ COPY NEEDS THE OPERATOR'S SIGN-OFF BEFORE `active` GOES TRUE. `chips` and
 *  card bodies describe what EXISTS; nothing here is a roadmap, deliberately —
 *  the previous draft's "what comes next" list made three public promises and
 *  the operator's own kill list had already ruled out one of them. */

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
  ctaLabel: string;
  ctaHref: string;
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: 'v1.0',
    version: '1.0',
    active: false,
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
      'Installs as an app, works offline',
      'No account needed to browse',
    ],
    ctaLabel: 'See the full changelog',
    ctaHref: '/changelog',
  },
];

/** The newest entry that is live. Null when nothing is announced, which is the
 *  normal state between releases. */
export function currentWhatsNew(): WhatsNewEntry | null {
  return WHATS_NEW.find(e => e.active) ?? null;
}
