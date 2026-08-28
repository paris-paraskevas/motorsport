/**
 * Draft the per-weekend F1 upgrades entry from the FIA's own document.
 *
 *   npm run upgrades:draft            -- the newest round the FIA has published
 *   npm run upgrades:draft -- --round 12
 *   npm run upgrades:draft -- --force  -- overwrite a round already curated
 *
 * Phase B + D of the ingest sketched in 0.334.x: Phase A is the parser
 * (lib/upgrades/f1-parse.ts, shipped 2026-07-24 and orphaned since — nothing
 * imported it until this script). Discovery, fetch, extraction and emission live
 * here; the human review step is deliberate and stays.
 *
 * WHY THIS IS NOT A GITHUB ACTION (yet). Two unsettled things, either of which
 * would make a cron produce silent garbage:
 *   1. The parser is welded to `pdftotext -layout` as XPDF 4.00 emits it. The
 *      fixtures in tests/fixtures/f1-upgrades/ came from that binary. A GitHub
 *      runner's `apt-get install poppler-utils` gives POPPLER's pdftotext, a
 *      fork of Xpdf 3.x, and a different extractor was measured producing a
 *      total parse failure rather than a degraded one. Until poppler's output is
 *      diffed against those three fixtures, CI cannot be trusted with this.
 *   2. fia.com's response to GitHub Actions egress is unverified. This repo has
 *      been bitten by datacenter-IP blocking before (the 0.12.12 NASCAR prod
 *      regression), so it gets probed before anything depends on it.
 * Both are cheap to settle later; neither blocks drafting a round today.
 *
 * The output is written into content/series/f1/upgrades.json and REVIEWED AS A
 * GIT DIFF. That is the check, and it is not optional: the parser reads the
 * component and reason columns reliably, but the FIA's "Brief description"
 * column wraps across rows, and eleven teams each author their own table.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseCarPresentation, type ParsedUpgrades } from '../lib/upgrades/f1-parse';
import { serialise } from '../lib/upgrades/upgrades-file';

const SEASON_URL =
  'https://www.fia.com/documents/championships/fia-formula-one-world-championship-14/season/season-2026-2072';
const UPGRADES_FILE = path.join('content', 'series', 'f1', 'upgrades.json');
const ROUNDS_FILE = path.join('content', 'series', 'f1', 'rounds.json');

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const wantRound = (() => {
  const i = argv.indexOf('--round');
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : null;
})();

function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

/** The parser is calibrated to ONE binary. Refusing loudly beats parsing
 *  plausible-looking garbage from a different one — the whole reason this is not
 *  a cron yet. */
function assertXpdf4(): void {
  // Xpdf prints its banner on STDERR and exits 99, so the success path throws.
  let out = '';
  try {
    execFileSync('pdftotext', ['-v'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const err = e as { stderr?: Buffer | string; stdout?: Buffer | string };
    out = String(err.stderr ?? '') + String(err.stdout ?? '');
  }
  if (!/pdftotext version 4\.0/.test(out)) {
    die(
      `this script needs XPDF 4.00's pdftotext, which is what the parser was calibrated against.\n` +
        `  found: ${out.split('\n')[0] || '(pdftotext not on PATH)'}\n` +
        `  Poppler's pdftotext spaces columns differently and the parser fails TOTALLY on it,\n` +
        `  which is silent garbage rather than an error. Install Xpdf 4.00, or settle the\n` +
        `  poppler-vs-Xpdf diff against tests/fixtures/f1-upgrades/ before changing this guard.`,
    );
  }
}

async function fetchText(url: string, label: string): Promise<string> {
  // fia.com served a 504 maintenance page mid-probe during the research pass, so
  // one failed fetch is never evidence a document is absent.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Paddock-Tracker/upgrades-draft' },
      });
      if (res.ok) return await res.text();
      console.warn(`  ${label}: HTTP ${res.status} (attempt ${attempt}/3)`);
    } catch (e) {
      console.warn(`  ${label}: ${(e as Error).message} (attempt ${attempt}/3)`);
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 4000 * attempt));
  }
  die(`could not fetch ${label} after 3 attempts. fia.com may be down; this is NOT evidence the document is missing.`);
}

interface FoundDoc {
  href: string;
  filename: string;
  published: string | null;
}

/** The season page server-renders the ACTIVE event's document list (Drupal 7,
 *  no hydration). The active event is always the current or most recent round,
 *  which is exactly the one we want, so no AJAX call is needed. */
function findCarPresentation(html: string): FoundDoc {
  const rows = [...html.matchAll(/href="(\/system\/files\/decision-document\/[^"]+\.pdf)"/gi)];
  if (rows.length === 0) {
    die(
      'the season page listed ZERO documents. That is a transient fetch/render fault, not an absence — re-run.\n' +
        '  (A naive job reading this as "not published yet" is exactly the failure mode to avoid.)',
    );
  }
  const match = rows.find(m => /car_presentation_submissions/i.test(m[1]));
  if (!match) {
    die(
      `found ${rows.length} documents for the active event, but no "Car Presentation Submissions" among them.\n` +
        `  The FIA publishes it on the FRIDAY of the race weekend (34 of 34 rounds checked across 2025-26),\n` +
        `  so before that it genuinely does not exist yet.`,
    );
  }
  const href = match[1];
  const filename = href.split('/').pop() ?? href;
  // Drupal appends _0, _1 … when a document is RE-UPLOADED. The original URL
  // keeps serving the superseded file, so a guessed URL would silently fetch
  // stale data. Surfaced rather than handled: it has not happened to this
  // document yet, and guessing at the right behaviour would be worse.
  if (/_\d+\.pdf$/i.test(filename)) {
    console.warn(
      `\n  ⚠ filename carries a Drupal re-upload suffix: ${filename}\n` +
        `    That means the FIA replaced this document. Check you are reading the current one.\n`,
    );
  }
  const near = html.slice(Math.max(0, match.index - 1200), match.index + 1200);
  const date = /class="date-display-single">([^<]+)</i.exec(near);
  return { href, filename, published: date ? date[1].trim() : null };
}

function roundForGp(gp: string | null): number | null {
  if (!gp) return null;
  const rounds = JSON.parse(readFileSync(ROUNDS_FILE, 'utf8')) as {
    rounds: { round: number; name: string }[];
  };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const hit = rounds.rounds.find(r => norm(r.name) === norm(gp));
  return hit?.round ?? null;
}

function report(parsed: ParsedUpgrades, round: number | null): void {
  console.log(`\n  doc ${parsed.doc ?? '?'} · ${parsed.gp ?? '?'} · ${parsed.date ?? '?'} · round ${round ?? '?'}`);
  const items = parsed.teams.reduce((n, t) => n + t.items.length, 0);
  console.log(`  ${parsed.teams.length} teams filed ${items} parts; ${parsed.noUpdateTeams.length} filed nothing`);
  for (const t of parsed.teams) console.log(`    ${t.team.padEnd(22)} ${t.items.length}`);
  if (parsed.noUpdateTeams.length) console.log(`    no updates: ${parsed.noUpdateTeams.join(', ')}`);
  if (parsed.warnings.length) {
    console.log(`\n  ⚠ ${parsed.warnings.length} parser warning(s) — every one needs an eye before you commit:`);
    for (const w of parsed.warnings) console.log(`    - ${w}`);
  }

  // The parser's own gate does not catch these, measured on the Dutch GP: it
  // flagged 5 unresolved reasons and said nothing about an EMPTY detail on
  // Alpine's Sidepod/Coke row. An empty field looks authored once committed, so
  // it is worse than a loud one. These are shape checks the script owns.
  const extra: string[] = [];
  for (const t of parsed.teams) {
    for (const i of t.items) {
      if (!i.detail?.trim()) extra.push(`${t.team}: "${i.component}" — detail is EMPTY`);
      else if (i.detail.length > 160) extra.push(`${t.team}: "${i.component}" — detail ran on (${i.detail.length} chars), probably swallowed the next row`);
      if (i.reason.length > 60) extra.push(`${t.team}: "${i.component}" — reason ran on (${i.reason.length} chars), probably a merged cell`);
    }
  }
  if (extra.length) {
    console.log(`\n  ⚠ ${extra.length} shape problem(s) the parser did not flag:`);
    for (const w of extra) console.log(`    - ${w}`);
  }

  if (!parsed.warnings.length && !extra.length) {
    console.log(`\n  Nothing flagged. That is NOT the same as correct — read the diff against the`);
    console.log(`  PDF anyway. Eleven teams each author their own table and the cells merge.`);
  }
}

async function main(): Promise<void> {
  assertXpdf4();

  console.log(`\nfetching the season document list…`);
  const html = await fetchText(SEASON_URL, 'season page');
  const doc = findCarPresentation(html);
  console.log(`  found: ${doc.filename}${doc.published ? `  (published ${doc.published} CET)` : ''}`);

  const pdfUrl = new URL(doc.href, 'https://www.fia.com').toString();
  console.log(`  downloading…`);
  const res = await fetch(pdfUrl, {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Paddock-Tracker/upgrades-draft' },
  });
  if (!res.ok) die(`the PDF itself returned HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  console.log(`  ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);

  const dir = mkdtempSync(path.join(tmpdir(), 'f1-upgrades-'));
  try {
    const pdfPath = path.join(dir, 'doc.pdf');
    const txtPath = path.join(dir, 'doc.txt');
    writeFileSync(pdfPath, bytes);
    execFileSync('pdftotext', ['-layout', pdfPath, txtPath]);
    const text = readFileSync(txtPath, 'utf8');

    const parsed = parseCarPresentation(text);
    const round = wantRound ?? roundForGp(parsed.gp);
    report(parsed, round);

    if (round == null) {
      die(`could not map "${parsed.gp}" to a round in ${ROUNDS_FILE}. Pass --round <n> to place it yourself.`);
    }
    if (parsed.teams.length === 0) {
      die(`the parse found no teams at all. That is an extractor mismatch, not an empty document.`);
    }

    const file = readFileSync(UPGRADES_FILE, 'utf8');
    const existing = JSON.parse(file) as Record<string, unknown>;
    if (existing[String(round)] && !FORCE) {
      die(`round ${round} is already curated. Re-run with --force to overwrite it (the diff is your review).`);
    }

    // Before writing anything: prove the serialiser reproduces this file as it
    // stands. If it cannot, the house style has moved and writing would rewrite
    // every line — which destroys the git diff, and the diff IS the review.
    // Line endings are normalised on BOTH sides before comparing, and the write
    // below restores whatever the file already used. git's autocrlf leaves CRLF
    // in the working tree on Windows while serialise() emits LF, so a raw
    // comparison fails on every line and the guard would refuse to run at all.
    const eol = file.includes('\r\n') ? '\r\n' : '\n';
    const lf = (s: string) => s.replace(/\r\n/g, '\n');
    if (lf(serialise(existing)) !== lf(file)) {
      die(
        `the serialiser no longer reproduces ${UPGRADES_FILE} byte-for-byte, so writing would\n` +
          `  reformat the whole file and bury round ${round} in an unreviewable diff.\n` +
          `  Nothing was written. Update serialise() to match the file's current style first.`,
      );
    }

    existing[String(round)] = {
      gp: parsed.gp,
      date: parsed.date,
      doc: parsed.doc,
      teams: parsed.teams,
    };
    const out = serialise(existing).replace(/\n/g, eol);
    writeFileSync(UPGRADES_FILE, out);

    console.log(`\n✓ wrote round ${round} into ${UPGRADES_FILE}`);
    console.log(`  Review it: git diff -- ${UPGRADES_FILE}`);
    console.log(`  Then check every component and reason against the PDF: ${pdfUrl}\n`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Only when run as a command. serialise() is imported by its test, and a
// top-level await main() would fetch the FIA and rewrite content under vitest.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]).endsWith('fetch-f1-upgrades.mts');
if (invokedDirectly) {
  if (!existsSync(UPGRADES_FILE)) die(`${UPGRADES_FILE} not found — run from the repo root.`);
  await main();
}
