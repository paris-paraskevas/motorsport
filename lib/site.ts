// Single source of truth for site-wide identity strings. Imported by
// app/layout.tsx, app/robots.ts, and lib/sitemap-data.ts. When the domain
// changes, edit this file only.

export const SITE_URL = 'https://paddock-tracker.com';
export const SITE_TITLE = 'Paddock Tracker';
export const SITE_DESCRIPTION =
  'Personal motorsport companion — F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more.';

// IndexNow protocol key. Public by design — the key file at
// `${SITE_URL}/${INDEXNOW_KEY}.txt` proves domain ownership to Bing /
// Yandex / Seznam, so the key being in source is intentional. Regenerating
// is cheap (mint a new UUIDv4, rename the public file, redeploy).
// Buy Me a Coffee, operator-supplied 2026-08-21. Single-sourced because two
// surfaces link it (the header button and the account menu) and a payment link
// that drifts between them is worse than no link at all.
export const SUPPORT_URL = 'https://buymeacoffee.com/parisp';

export const INDEXNOW_KEY = '9a3e7f2c-8b4d-4c1a-a5e6-d7f8b9c0e1d2';
export const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

// App page-shell width — ONE source of truth for the container that wraps every
// (app) route body. Edit here to reshape the whole app's width at once.
//
// Reactive-to-viewport (operator 2026-07-09): the column tracks screen width
// CONTINUOUSLY instead of stepping at breakpoints (the old `lg:max-w-6xl
// xl:max-w-7xl 2xl:max-w-screen-2xl 3xl:max-w-[2000px]` ladder pinned the width
// between breakpoints and grew dead-space margins). Two profiles:
//   PAGE_WIDE — data / dashboard / hub pages + nav + footer: fully fluid, NO max
//     cap, fills the viewport minus gutters at any width (incl. ultrawide).
//   PAGE_READ — prose + forms: fluid up to a readable cap, then centred, so line
//     length stays comfortable (full-bleed legal/blog text is unreadable).
// Gutters are the padding: p-4 / md:p-6 / lg:p-8 (16 / 24 / 32px); pb-16 gives
// scroll clearance past the mobile bottom bar. Nav/footer match the horizontal
// gutter scale (px-4 md:px-6 lg:px-8) so chrome aligns with the body.
export const PAGE_WIDE = 'w-full p-4 md:p-6 lg:p-8 pb-16';
export const PAGE_READ = 'w-full max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16';

// The v1.0 announcement used to live here as LAUNCH_ANNOUNCEMENT, rendered by
// components/LaunchBanner. Both were retired in 0.334.88: the What's-New modal
// (lib/whats-new.ts + components/whats-new/) had grown into a better version of
// the same thing — six cards carrying real screenshots of our own pages rather
// than a text list — and the two were mounted side by side under the SAME
// 'v1.0' dismissal id, with racing "is a dialog already open" guards.
//
// The roadmap copy moved across verbatim as WhatsNewEntry.next. Both files are
// in git history if the old shape is ever wanted back.

// Series/team colours used AS TEXT (labels, headings, deltas). Vibrant hexes
// wash out on the light themes, so the colour mixes toward black by the
// per-theme --series-ink-mix (globals.css): 100% on dark themes (identical to
// the raw colour), 52% on light (clears WCAG 4.5:1 for the brightest series
// tint on the darkest light surface). Fills (dots, rules, bars) stay raw.
export function seriesInk(colour: string): string {
  return `color-mix(in srgb, ${colour} var(--series-ink-mix), black)`;
}
