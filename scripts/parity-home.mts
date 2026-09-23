// The served-HTML parity of Home across the flip (P2.24 C): two captures of `/`
// (prod before the merge, prod after the deploy), their Body regions compared one
// by one — the wrapper's attributes and the inner HTML — after the normalisation
// of what differs between two honest renders of the same document: the countdown
// digits, the age labels, the App Router's flight <script> tags, comments and
// hydration markers, whitespace. Everything else (a headline, a points total, a
// position, a link) must be byte-identical. Prints `identical`, or the first
// difference of every region that differs with its context, and exits 1 then.
// Dependency-free; run twice against the same page seconds apart to calibrate.
//
//   npx tsx scripts/parity-home.mts <before> <after>   (each a URL to fetch, or a file to read)
import { readFileSync } from 'node:fs';

async function capture(arg: string): Promise<string> {
  if (!/^https?:\/\//.test(arg)) return readFileSync(arg, 'utf8');
  const res = await fetch(arg, { headers: { accept: 'text/html', 'user-agent': 'paddock-parity/1.0 (+https://paddock-tracker.com)' } });
  if (!res.ok) throw new Error(`${arg}: HTTP ${res.status}`);
  return res.text();
}

/** The element opening at `open` (a `<div`), to the end of its matching `</div>`, by depth. */
function element(html: string, open: number): string {
  const tag = /<\/?div\b[^>]*>/g;
  tag.lastIndex = open;
  let depth = 0;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) return html.slice(open, m.index + m[0].length);
    } else if (!m[0].endsWith('/>')) depth++;
  }
  throw new Error('an unclosed <div> in the capture');
}

/** The Body block the frame draws for a split page. */
function bodyBlock(html: string): string {
  const at = html.indexOf('data-page-frame="body"');
  if (at < 0) throw new Error('no data-page-frame="body" block: the page is not served from a split document');
  return element(html, html.lastIndexOf('<div', at));
}

interface RegionCapture {
  id: string;
  /** The wrapper's opening tag: id, data-region, hidden, class, style. */
  wrapper: string;
  inner: string;
}

function regions(block: string): RegionCapture[] {
  const out: RegionCapture[] = [];
  const opener = /<div\b[^>]*\bdata-region="([^"]+)"[^>]*>/g;
  for (let m = opener.exec(block); m; m = opener.exec(block)) {
    const whole = element(block, m.index);
    out.push({ id: m[1], wrapper: normalise(m[0]), inner: normalise(whole.slice(m[0].length, whole.length - '</div>'.length)) });
    opener.lastIndex = m.index + whole.length;
  }
  return out;
}

/** What two honest renders of one document may differ in. */
function normalise(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<template\b[^>]*><\/template>/g, '')
    // The countdowns (Time until …; the Live band's next session): their digits.
    .replace(/(aria-label="Time until [^"]*"[^>]*>)([\s\S]*?)(<\/[a-z]+>)/g, (_, a: string, b: string, c: string) => `${a}${b.replace(/\d/g, '#')}${c}`)
    .replace(/(\bin\s|\bLIVE\b|\bstarts\s)(\d+\s?(?:d|h|m|min|s)\b\s?)+/g, m => m.replace(/\d/g, '#'))
    // The age labels.
    .replace(/\b(\d+|an?)\s?(min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)\s+ago\b/g, '#ago')
    .replace(/\bjust now\b/g, '#ago')
    // Streaming placeholders and React's ids.
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

async function main(): Promise<void> {
  const [before, after] = process.argv.slice(2);
  if (!before || !after) {
    console.error('usage: npx tsx scripts/parity-home.mts <before> <after>');
    process.exit(2);
  }
  const [a, b] = await Promise.all([capture(before), capture(after)]);
  const ra = regions(bodyBlock(a));
  const rb = regions(bodyBlock(b));
  let differences = 0;
  const idsA = ra.map(r => r.id);
  const idsB = rb.map(r => r.id);
  if (idsA.join(',') !== idsB.join(',')) {
    differences++;
    console.log(`regions differ in order or number:\n  before ${idsA.join(', ')}\n  after  ${idsB.join(', ')}`);
  }
  for (const r of ra) {
    const other = rb.find(x => x.id === r.id);
    if (!other) continue;
    if (r.wrapper !== other.wrapper) {
      differences++;
      console.log(`${r.id}: the wrapper differs\n  before ${r.wrapper}\n  after  ${other.wrapper}`);
    }
    if (r.inner !== other.inner) {
      differences++;
      console.log(`${r.id}: differs (${r.inner.length} → ${other.inner.length} chars)\n${firstDifference(r.inner, other.inner)}`);
    } else console.log(`${r.id}: identical (${r.inner.length} chars)`);
  }
  console.log(differences === 0 ? `identical: ${ra.length} regions` : `${differences} difference${differences === 1 ? '' : 's'}`);
  process.exit(differences === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
