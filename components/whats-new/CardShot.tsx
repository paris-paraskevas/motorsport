'use client';

import type { WhatsNewArt } from '@/lib/whats-new';

/** The banner on a What's-New card: a crop of the actual page it describes.
 *
 *  Why real crops and not drawings: the first attempt used hand-drawn abstract
 *  panels (bars on a grid), and the operator's verdict was blunt and correct —
 *  a diagram of a chart tells a reader nothing about what they will find. A crop
 *  of the standings page does. These are screenshots of OUR OWN pages, so none of
 *  the licensing that killed the driver-portrait and team-logo waves applies.
 *
 *  Why one full-width banner per card rather than a two-up grid: legibility is
 *  arithmetic, not taste. Site body text is 13px and needs roughly 9px on screen
 *  to stay readable, so a crop survives about a 1.3x downscale and no more. A
 *  two-up panel is ~330px wide, which caps the capture at ~430px — narrower than
 *  a calendar month or a standings table. At full width the banner is 848px, so
 *  the crops are 848 CSS px wide and display 1:1. Crop, never shrink.
 *
 *  Two densities per crop (1.0.24, operator: the 1.0 banners were "shit
 *  quality"): the capture is taken at device-pixel-ratio 2, so `-light@2x.webp`
 *  is 1696x520 and is what a retina phone or laptop gets through `srcSet`; the
 *  1x `-light.webp` is the same capture downscaled to 848x260 for 1x screens.
 *  A plain <img> rather than next/image because `unoptimized` emits no srcset,
 *  and the density descriptor is also what keeps `object-none` honest on phones:
 *  without `2x` the browser would treat the 1696px file as 1696 CSS px and the
 *  phone crop would show a quarter of the image at double size.
 *
 *  CAPTURE RECIPE — reproduce these rather than guessing at them:
 *    1. viewport EXACTLY 848 x 260 at deviceScaleFactor 2 (Playwright:
 *       CDP `Emulation.setDeviceMetricsOverride` after setViewportSize, then
 *       `page.screenshot({ scale: 'device' })`). The capture IS the banner;
 *       there is no second cropping step to get wrong.
 *    2. theme: `localStorage['paddock:theme'] = 'paper'` for -light,
 *       `'midnight'` for -dark, set before navigation (addInitScript) so
 *       ThemeScript reads it pre-paint.
 *    3. strip the chrome, or every banner wears the same header:
 *         document.querySelectorAll('[role="dialog"]').forEach(d => d.remove())
 *         header/nav with computed position sticky|fixed -> display:none
 *         style: html{scrollbar-width:none} *::-webkit-scrollbar{display:none}
 *         and clear any body overflow lock the dialog left behind.
 *    4. scroll to the recorded offset in SHOTS[].at (PROD, all six) and wait a
 *       second for lazy tiles and fonts.
 *    5. encode with sharp: the PNG → webp({quality: 90, effort: 6}) as @2x, and
 *       resize(848, 260) → webp({quality: 90}) as the 1x. The 24 files total
 *       ~780 KB; only the first card's pair loads eagerly.
 *  Same zoom for every surface. Mixing zoom levels across cards is the thing
 *  that makes a reader lose their orientation.
 *
 *  They live in `public/`, which Cloudflare serves from Workers Assets, so the
 *  Worker script and its 10 MiB ceiling are untouched.
 *
 *  Phone behaviour is `object-none`: NOT a scaled-down banner (848px squeezed
 *  into ~330px is an illegible smear) but a native-size crop of one edge. WHICH
 *  edge is per-shot (`phone`) — the calendar's race weekend sits on the right of
 *  its capture, so cropping left shows four empty day cells. The card's text
 *  carries the meaning either way, because essential information must never live
 *  only in an image.
 *
 *  Re-capture when a surface is redesigned — a stale crop advertises a page that
 *  no longer exists. */

/** `phone`: object-position for the un-scaled sub-330px crop. `at`: where the
 *  capture came from, so the recipe above can be re-run without guesswork. */
const SHOTS: Record<WhatsNewArt, { file: string; at: string; phone: string; alt: string }> = {
  calendar: {
    file: 'calendar',
    at: 'PROD /calendar?s=f1 · y=505 · the Italian GP band across the first week of September, today outlined below it',
    phone: 'object-right-top',
    alt: 'The Paddock calendar: a Formula 1 race weekend spanning three days of a month grid, each day listing its sessions with start times, and today outlined',
  },
  standings: {
    file: 'standings',
    at: 'PROD /series/f1/standings · y=1057 · the drivers table',
    phone: 'object-left-top',
    alt: 'The Formula 1 drivers standings table, with position, driver, team, points and wins for the top of the championship',
  },
  writing: {
    file: 'writing',
    at: 'PROD /blog · y=317 · the lead post with its cover',
    phone: 'object-left-top',
    alt: 'The Paddock blog: a weekend analysis with a photograph of a Mercedes Formula 1 car at Monza, its headline, byline and opening paragraph',
  },
  analysis: {
    file: 'analysis',
    at: 'PROD /series/f1/weekend/12/qualifying · y=1225 · the sector comparison',
    // The deltas and both sector times sit mid-frame; either edge cuts a column.
    phone: 'object-top',
    alt: 'A Formula 1 qualifying analysis comparing two pole laps sector by sector, with each sector time and the gap between them',
  },
  circuits: {
    file: 'circuits',
    at: 'PROD /information/map · y=470 · Europe and North America',
    // Centre lands on the European cluster, which is the point of the map.
    phone: 'object-top',
    alt: 'A world map of racing circuits, each venue a marker coloured by the championship that races there, densest across Europe and the United States',
  },
  record: {
    file: 'record',
    at: 'PROD /series/f1/champions · y=862 · the champions list',
    phone: 'object-left-top',
    alt: 'The Formula 1 champions list, each year giving the champion, their running title count, their team, points, wins and the margin over the runner-up',
  },
};

/** `priority` on the first card only: it is the one above the fold when the
 *  dialog opens, and the rest are far enough down the scroller to lazy-load. */
export function CardShot({ art, first = false }: { art: WhatsNewArt; first?: boolean }) {
  const shot = SHOTS[art];
  if (!shot) return null;
  const common = `h-[136px] w-full object-none ${shot.phone} md:h-[260px] md:object-cover md:object-top`;
  const srcSet = (theme: 'light' | 'dark') =>
    `/whats-new/${shot.file}-${theme}.webp 1x, /whats-new/${shot.file}-${theme}@2x.webp 2x`;
  return (
    <div className="relative w-full overflow-hidden border-b border-border bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/whats-new/${shot.file}-light.webp`}
        srcSet={srcSet('light')}
        alt={shot.alt}
        width={848}
        height={260}
        loading={first ? 'eager' : 'lazy'}
        fetchPriority={first ? 'high' : undefined}
        decoding="async"
        className={`${common} dark:hidden`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/whats-new/${shot.file}-dark.webp`}
        srcSet={srcSet('dark')}
        alt=""
        aria-hidden
        width={848}
        height={260}
        loading={first ? 'eager' : 'lazy'}
        fetchPriority={first ? 'high' : undefined}
        decoding="async"
        className={`hidden ${common} dark:block`}
      />
    </div>
  );
}
