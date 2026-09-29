/**
 * The circuits' time zones (P2.8, the Countdown's time at the track).
 *
 *   npx tsx scripts/fetch-circuit-timezones.mts            -- every circuit without a `tz`
 *   npx tsx scripts/fetch-circuit-timezones.mts --force    -- every circuit, refreshed
 *
 * For each entry of content/circuits.json the script asks Open-Meteo's forecast API for the
 * coordinates with `timezone=auto` and keeps the IANA zone it answers (`timezone`, e.g.
 * "Asia/Baku"; checked live 2026-09-29 for Bahrain and Baku), then writes the file back with
 * `tz` on the entry and the key order kept. It touches nothing else, so a circuit curated later
 * gets its zone the same way. lib/circuits.test.ts holds every zone to one the runtime knows;
 * `npx tsx scripts/bundle-content.mts` after a run, or `next dev` and the tests read the old
 * bundle (CLAUDE.md's landmine).
 */
import fs from 'node:fs';
import path from 'node:path';

type CircuitRow = { name: string; countryCode?: string; lat: number; lon: number; aliases: string[]; tz?: string };

const FILE = path.join(process.cwd(), 'content', 'circuits.json');
const force = process.argv.includes('--force');
const circuits = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Record<string, CircuitRow>;
// A zone the runtime can format in; supportedValuesOf lists the canonical names alone and leaves out
// links such as America/Indiana/Indianapolis, which the formatter accepts all the same.
const knows = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

let written = 0;
let failed = 0;
for (const [slug, c] of Object.entries(circuits)) {
  if (c.tz && !force) continue;
  const params = new URLSearchParams({ latitude: String(c.lat), longitude: String(c.lon), daily: 'weather_code', forecast_days: '1', timezone: 'auto' });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { headers: { 'user-agent': 'paddock-tracker circuit time zones (+https://paddock-tracker.com)' } });
    const data = (await res.json()) as { timezone?: string };
    const tz = data.timezone;
    if (!res.ok || !tz || !knows(tz)) {
      failed++;
      console.error(`${slug}: no usable zone (HTTP ${res.status}, ${tz ?? 'none'})`);
      continue;
    }
    c.tz = tz;
    written++;
    console.log(`${slug}: ${tz}`);
  } catch (e) {
    failed++;
    console.error(`${slug}: ${(e as Error).message}`);
  }
  // Open-Meteo asks for restraint on its free tier; a hundred slow requests are fine.
  await new Promise(r => setTimeout(r, 150));
}
// The file keeps its shape: every list of aliases on one line, as it was written by hand.
const compact = JSON.stringify(circuits, null, 2).replace(/\[\s+((?:"(?:[^"\\]|\\.)*",?\s+)+)\]/g, (_, items: string) => `[${items.trim().split(/,\s+/).join(', ')}]`);
fs.writeFileSync(FILE, compact + '\n');
console.log(`${written} written, ${failed} failed, ${Object.values(circuits).filter(c => c.tz).length} of ${Object.keys(circuits).length} circuits carry a zone`);
if (failed > 0) process.exitCode = 1;
