// summarise-findings.mjs — after the last run lands: fold notes-6..14 into one
// digest for the consolidated review. Output study/findings-digest.txt: totals
// per run and per area, then every relevant line grouped by area (name ::
// relevance), then the not-relevant names per area (compact). Zero model cost.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const files = fs.readdirSync(here).filter(f => /^notes-(\d+)\.jsonl$/.test(f) && Number(f.match(/\d+/)[0]) >= 6).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
const rows = [];
for (const f of files) {
  const run = Number(f.match(/\d+/)[0]);
  for (const line of fs.readFileSync(path.join(here, f), 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { rows.push({ run, ...JSON.parse(line) }); } catch { /* skip a bad line */ }
  }
}
const yes = rows.filter(r => r.relevant === 'yes');
const out = [];
out.push(`${rows.length} concepts from ${files.length} runs; ${yes.length} relevant; ${new Set(rows.map(r => r.source)).size} pages`);
const perRun = {};
for (const r of rows) { perRun[r.run] ??= { all: 0, yes: 0 }; perRun[r.run].all++; if (r.relevant === 'yes') perRun[r.run].yes++; }
out.push('per run: ' + Object.entries(perRun).map(([k, v]) => `run ${k}: ${v.yes}/${v.all}`).join(' · '));
const areas = {};
for (const r of rows) { areas[r.area] ??= { all: 0, yes: [], no: [] }; areas[r.area].all++; (r.relevant === 'yes' ? areas[r.area].yes : areas[r.area].no).push(r); }
out.push('', '== relevant, by area ==');
for (const a of Object.keys(areas).sort((x, y) => areas[y].yes.length - areas[x].yes.length)) {
  const A = areas[a];
  if (!A.yes.length) continue;
  out.push('', `## ${a} (${A.yes.length} of ${A.all})`);
  for (const r of A.yes) out.push(`- [${r.run}] ${r.name} :: ${r.relevance}`);
}
out.push('', '== not relevant, names only, by area ==');
for (const a of Object.keys(areas).sort()) {
  const A = areas[a];
  if (!A.no.length) continue;
  out.push(`${a} (${A.no.length}): ${A.no.map(r => r.name).join(' · ')}`);
}
fs.writeFileSync(path.join(here, 'findings-digest.txt'), out.join('\n'));
console.log(out.slice(0, 2).join('\n'), `\n→ ${path.join(here, 'findings-digest.txt')} (${out.length} lines)`);
