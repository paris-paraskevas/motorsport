// Element-relative heatmap round-trip against the local Supabase stack:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-heatmap.mts
// (apply supabase/migrations/20260713120000_heatmap_events.sql locally first).
// Inserts clicks + impressions for one path across all breakpoints, then asserts
// rankedElements ranks the clicked element HOT and the seen-but-never-clicked one
// DEAD — both in the cross-breakpoint aggregate and under a breakpoint filter.
// Re-run-safe: asserts on properties (clicks>0 / clicks===0), not exact counts,
// since rows accumulate across runs. NOTE: it leaves its verify:* rows behind.
import { isBettingConfigured } from '@/lib/betting/client';
import { recordEvents, rankedElements, type HeatmapEvent, type Breakpoint } from '@/lib/heatmap';

if (!isBettingConfigured()) {
  console.error('VERIFY FAILED: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from `supabase status`).');
  process.exit(1);
}

const PATH = '/verify-heatmap';
const HOT = 'verify:hot';
const DEAD = 'verify:dead';
const BREAKPOINTS: Breakpoint[] = ['mobile', 'tablet', 'desktop'];
const DEAD_MIN = 20; // rankedElements default: >= this many impressions to count as dead

const events: HeatmapEvent[] = [];
for (const breakpoint of BREAKPOINTS) {
  for (let i = 0; i < 3; i++) {
    events.push({ path: PATH, kind: 'click', elementId: HOT, relX: 0.5, relY: 0.5, breakpoint });
  }
  for (let i = 0; i < 6; i++) events.push({ path: PATH, kind: 'impression', elementId: HOT, breakpoint });
  // >= DEAD_MIN impressions per breakpoint so DEAD qualifies both aggregated and per-breakpoint.
  for (let i = 0; i < DEAD_MIN + 5; i++) {
    events.push({ path: PATH, kind: 'impression', elementId: DEAD, breakpoint });
  }
}
await recordEvents(events);

const errs: string[] = [];

const all = await rankedElements(PATH);
const hot = all.hot.find(h => h.elementId === HOT);
const dead = all.dead.find(d => d.elementId === DEAD);
if (!hot || hot.clicks <= 0) errs.push('aggregate: clicked element should be HOT with clicks > 0');
if (all.hot.some(h => h.elementId === DEAD)) errs.push('aggregate: unclicked element must NOT be hot');
if (!dead || dead.clicks !== 0) errs.push('aggregate: seen-but-unclicked element should be DEAD with 0 clicks');
if (dead && dead.impressions < DEAD_MIN) errs.push('aggregate: DEAD should have >= DEAD_MIN impressions');
if (all.dead.some(d => d.elementId === HOT)) errs.push('aggregate: clicked element must NOT be dead');

const desk = await rankedElements(PATH, { breakpoint: 'desktop' });
if (!desk.hot.some(h => h.elementId === HOT)) errs.push('desktop filter: HOT missing from hot list');
if (!desk.dead.some(d => d.elementId === DEAD)) errs.push('desktop filter: DEAD missing from dead list');

console.log(
  JSON.stringify(
    { path: PATH, hotClicks: hot?.clicks, hotCtr: hot?.ctr, deadImpressions: dead?.impressions },
    null,
    2,
  ),
);
if (errs.length) {
  console.error('VERIFY FAILED:', errs);
  process.exit(1);
}
console.log('VERIFY OK — clicks rank the element HOT; impressions-only ranks it DEAD; breakpoint filter holds.');
