// Offline eval for the Race Engineer assistant. Runs a fixed question set
// through the REAL pipeline (prompt + corpus + Gemini) and checks the guardrails
// still hold — grounds/links when it should, refuses live data + off-topic.
// Run after changing the prompt, corpus, or model:  npm run assistant:eval
// Needs GOOGLE_GENERATIVE_AI_API_KEY (read from .env.local or the environment).
// NOT a CI test — it's paid (a few cents) and non-deterministic; it's a
// regression smoke you run by hand. Exit code is non-zero if any case fails.
import { readFileSync } from 'node:fs';

try {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  /* no .env.local — rely on the ambient environment */
}

const { answerConversation } = await import('../lib/assistant/index');

const hasLink = (a: string) => /\]\(\/[^)]/.test(a);
const has = (a: string, ...words: string[]) => words.some(w => a.toLowerCase().includes(w));

interface Case {
  q: string;
  desc: string;
  check: (a: string) => boolean;
}

const CASES: Case[] = [
  { q: 'How do I follow a series?', desc: 'answers with a link', check: hasLink },
  {
    q: 'Where can I see the F1 standings?',
    desc: 'links to standings/series (not a bare answer)',
    check: a => hasLink(a) && has(a, 'standing', 'series'),
  },
  {
    q: 'How does the prediction game work?',
    desc: 'grounded (play-money / no-cashout / social)',
    check: a => has(a, 'play', 'credit', 'cashout', 'social', 'bet'),
  },
  {
    q: 'How do I customise my home page?',
    desc: 'links to the customise page',
    check: a => hasLink(a) && has(a, 'custom'),
  },
  {
    q: 'Who won the last F1 race?',
    desc: 'refuses live data → points to a page, no invented winner',
    check: a => hasLink(a) || has(a, "can't", 'cannot', "don't", 'results page', 'open the', 'check the'),
  },
  {
    q: 'What is the capital of France?',
    desc: 'refuses off-topic (stays in Paddock scope)',
    check: a => has(a, 'paddock', 'help you use', 'only help', "can't", 'assist') && !/\bparis\b/i.test(a),
  },
];

let pass = 0;
for (const c of CASES) {
  const r = await answerConversation([{ role: 'user', content: c.q }]);
  const ok = r.ok && c.check(r.text);
  if (ok) pass++;
  const text = r.ok ? r.text : `(error: ${r.reason})`;
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${c.desc}`);
  console.log(`   Q: ${c.q}`);
  console.log(`   A: ${text.replace(/\s+/g, ' ').slice(0, 220)}`);
}
console.log(`\n${pass}/${CASES.length} passed`);
process.exit(pass === CASES.length ? 0 : 1);
