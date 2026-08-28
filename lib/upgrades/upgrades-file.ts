/**
 * Re-emit content/series/f1/upgrades.json in ITS OWN house style, not
 * JSON.stringify's.
 *
 * This matters more than it looks. `npm run upgrades:draft` writes a new round
 * into that file and THE REVIEW IS THE GIT DIFF. The first version of the script
 * used `JSON.stringify(obj, null, 2)`: it turned a 70-line file into 255, moved
 * `_comment` to the bottom (V8 orders integer-like keys first), and showed every
 * existing round as changed — which destroys the only review mechanism the
 * pipeline has. The style is one line per item and one block per team;
 * reproducing it exactly means a new round adds only its own lines.
 *
 * Lives in lib/ rather than in the script so it can be tested. Guarded by a
 * round-trip assertion both here (in upgrades-file.test.ts) and at the call
 * site: serialising the file's CURRENT contents must reproduce it, or the house
 * style has moved and writing would bury the new round in noise.
 */
export function serialise(data: Record<string, unknown>): string {
  const s = (v: unknown) => JSON.stringify(v);
  const round = (r: Record<string, unknown>): string => {
    const head = ['gp', 'date', 'doc']
      .filter(k => r[k] !== undefined)
      .map(k => `    ${s(k)}: ${s(r[k])}`);
    if (r.note !== undefined) head.push(`    "note": ${s(r.note)}`);
    const teams = (r.teams as { team: string; items: Record<string, unknown>[] }[]).map(t => {
      const items = t.items.map(
        i => `        { "component": ${s(i.component)}, "reason": ${s(i.reason)}, "detail": ${s(i.detail)} }`,
      );
      return `      { "team": ${s(t.team)}, "items": [\n${items.join(',\n')}\n      ] }`;
    });
    return `${head.join(',\n')},\n    "teams": [\n${teams.join(',\n')}\n    ]`;
  };

  // _comment first, then rounds ascending — the file's own order, restated
  // explicitly because Object.keys would put the integer-like keys first.
  const parts: string[] = [];
  if (data._comment !== undefined) parts.push(`  "_comment": ${s(data._comment)}`);
  const nums = Object.keys(data)
    .filter(k => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b));
  for (const k of nums) parts.push(`  ${s(k)}: {\n${round(data[k] as Record<string, unknown>)}\n  }`);
  return `{\n${parts.join(',\n')}\n}\n`;
}
