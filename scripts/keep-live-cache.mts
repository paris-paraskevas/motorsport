/**
 * Keeps only the live build's folder in the page-cache bucket (slot O4, 2026-10-08).
 *
 *   npx tsx scripts/keep-live-cache.mts --dry-run   # prints what it would do; writes nothing
 *   npx tsx scripts/keep-live-cache.mts --apply     # what `npm run deploy:cf` runs once the deploy is live
 *
 * Each deploy saves the site's pages under a new folder named after its build
 * (incremental-cache/<build id>/, the folder name in .open-next/cache), and OpenNext
 * never removes the old ones: 85 folders held 299 GB on 2026-10-07. Once the new
 * build is live, this marks the previous build's folder for deletion a day later
 * (an R2 lifecycle rule on its prefix; deleting is free) and records the new build
 * as the live one. It never lists the bucket: the previous build's id is the marker
 * object this script writes at each deploy, so a run costs one read, one write and
 * one or two rule updates. Rules it added more than three days ago are removed,
 * since their folders are empty by then; the bucket's own 7-day rule stays as the
 * safety net if a run fails.
 *
 * Refuses to write without --apply: on this machine the local build's id is not the
 * live one, and recording it would mark the real live folder for deletion.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BUCKET = 'paddock-inc-cache';
const PREFIX = 'incremental-cache'; // OpenNext's default; wrangler.jsonc sets no NEXT_INC_CACHE_R2_PREFIX
const MARKER = 'keep-live/live-build.txt';
const RULE = 'keep-live-';
const RULE_LIFE_DAYS = 3;
const BUILD_ID = /^[A-Za-z0-9_-]{10,64}$/;

const apply = process.argv.includes('--apply');
if (apply === process.argv.includes('--dry-run')) {
  console.error('usage: npx tsx scripts/keep-live-cache.mts --dry-run | --apply');
  process.exit(1);
}
const wrangler = (args: string) => execSync(`npx wrangler ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const builds = readdirSync('.open-next/cache').filter((d) => d !== '__fetch');
if (builds.length !== 1 || !BUILD_ID.test(builds[0])) {
  console.error(`keep-live: expected one build folder in .open-next/cache, found ${JSON.stringify(builds)}; nothing done.`);
  process.exit(1);
}
const live = builds[0];

const tmp = mkdtempSync(path.join(tmpdir(), 'keep-live-'));
let previous = '';
try {
  wrangler(`r2 object get ${BUCKET}/${MARKER} --remote --file "${path.join(tmp, 'previous.txt')}"`);
  previous = readFileSync(path.join(tmp, 'previous.txt'), 'utf8').trim();
} catch {
  // No marker yet: the first run only records the live build.
}
if (previous && !BUILD_ID.test(previous)) {
  console.error(`keep-live: the marker holds "${previous.slice(0, 40)}", not a build id; nothing done.`);
  process.exit(1);
}
console.log(`keep-live: live build ${live}; previous ${previous || '(none recorded)'}`);

const today = new Date().toISOString().slice(0, 10);
const cutoff = Date.now() - RULE_LIFE_DAYS * 86_400_000;
const rules = [...wrangler(`r2 bucket lifecycle list ${BUCKET}`).matchAll(/^name:\s+(\S+)/gm)].map((m) => m[1]);
const expired = rules.filter((n) => n.startsWith(RULE) && Date.parse(n.slice(RULE.length, RULE.length + 10)) < cutoff);

const markPrevious = previous && previous !== live ? `${PREFIX}/${previous}/` : '';
console.log(markPrevious ? `keep-live: will expire ${markPrevious} after 1 day` : 'keep-live: no previous folder to expire');
console.log(`keep-live: will record ${live} as live; will remove ${expired.length} old rule(s)${expired.length ? `: ${expired.join(', ')}` : ''}`);
if (!apply) {
  console.log('keep-live: dry run, nothing written.');
  process.exit(0);
}

if (markPrevious) wrangler(`r2 bucket lifecycle add ${BUCKET} ${RULE}${today}-${previous} ${markPrevious} --expire-days 1 -y`);
writeFileSync(path.join(tmp, 'live.txt'), live);
wrangler(`r2 object put ${BUCKET}/${MARKER} --remote --file "${path.join(tmp, 'live.txt')}"`);
for (const name of expired) wrangler(`r2 bucket lifecycle remove ${BUCKET} --name ${name}`);
console.log('keep-live: done.');
