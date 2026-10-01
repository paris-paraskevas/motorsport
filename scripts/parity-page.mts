// The served-HTML parity of a code page across a change (R18): two captures of one address (prod before, the testing Worker
// or prod after), their <main> compared after the normalisation parity-home.mts applies to Home's regions: the flight
// <script> tags, comments, hydration markers, the countdown digits, the age labels, React's ids, whitespace. Everything
// else must be byte-identical. Prints `identical` or the first difference with its context, and exits 1 then. Several
// addresses at once: each pair is `<before> <after>`; the exit code is 1 if any differs.
//
//   npx tsx scripts/parity-page.mts <before> <after> [<before> <after> ...]   (each a URL to fetch, or a file to read)
import { readFileSync } from 'node:fs';

async function capture(arg: string): Promise<string> {
  if (!/^https?:\/\//.test(arg)) return readFileSync(arg, 'utf8');
  const res = await fetch(arg, { headers: { accept: 'text/html', 'user-agent': 'paddock-parity/1.0 (+https://paddock-tracker.com)' } });
  if (!res.ok) throw new Error(`${arg}: HTTP ${res.status}`);
  return res.text();
}

/** The page's body: the App Router streams a Suspense boundary's content after </main> as hidden segments, so <main> alone
 *  holds only the loading shell; the body carries both. The whole document when the page has no body tag. */
function main(html: string): string {
  const open = html.indexOf('<body');
  const close = html.lastIndexOf('</body>');
  if (open < 0 || close < open) return html;
  return html.slice(open, close + '</body>'.length);
}

/** What two honest renders of one page may differ in (parity-home.mts's rule). */
function normalise(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<template\b[^>]*><\/template>/g, '')
    .replace(/(aria-label="Time until [^"]*"[^>]*>)([\s\S]*?)(<\/[a-z]+>)/g, (_, a: string, b: string, c: string) => `${a}${b.replace(/\d/g, '#')}${c}`)
    .replace(/(\bin\s|\bLIVE\b|\bstarts\s)(\d+\s?(?:d|h|m|min|s)\b\s?)+/g, m => m.replace(/\d/g, '#'))
    .replace(/(<span class="[^"]*\btabular-nums text-lg\b[^"]*">)([^<]*)(<\/span>)/g, (_, a: string, b: string, c: string) => `${a}${b.replace(/\d/g, '#')}${c}`)
    .replace(/ class=""/g, '')
    .replace(/\b(\d+|an?)\s?(min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)\s+ago\b/g, '#ago')
    .replace(/\bjust now\b/g, '#ago')
    .replace(/\b(id|for|aria-describedby|aria-labelledby)="(?:B|S|P|R|_R_)[:_][^"]*"/g, '$1="#"')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstDifference(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const from = Math.max(0, i - 120);
  return `  before …${a.slice(from, i + 160)}…\n  after  …${b.slice(from, i + 160)}…`;
}

async function compare(before: string, after: string): Promise<boolean> {
  const [a, b] = (await Promise.all([capture(before), capture(after)])).map(h => normalise(main(h)));
  if (a === b) {
    console.log(`identical: ${before} (${a.length} chars)`);
    return true;
  }
  console.log(`differs: ${before} → ${after} (${a.length} → ${b.length} chars)\n${firstDifference(a, b)}`);
  return false;
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.length % 2 !== 0) {
    console.error('usage: npx tsx scripts/parity-page.mts <before> <after> [<before> <after> ...]');
    process.exit(2);
  }
  let differences = 0;
  for (let i = 0; i < args.length; i += 2) if (!(await compare(args[i], args[i + 1]))) differences++;
  console.log(differences === 0 ? `identical: ${args.length / 2} ${args.length / 2 === 1 ? 'page' : 'pages'}` : `${differences} ${differences === 1 ? 'page differs' : 'pages differ'}`);
  process.exit(differences === 0 ? 0 : 1);
}

run().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
