// AI-prose lint for the blog composer. A pure string -> flags function (no deps,
// server-safe, unit-tested) that flags the textual tells of AI-generated prose
// so a human author can fix them before publishing. Em/en-dashes are an ERROR
// (operator ban: replace with a comma or hyphen); the rest are warnings/info.
// Advisory only — it never rewrites.
//
// False-positive guard: rules scan a MASKED copy of the body (same length,
// newlines preserved) with fenced/inline code, data-embed shortcodes, and URL
// targets blanked to spaces. A match offset therefore maps 1:1 back to the raw
// textarea (for click-to-select) and we never flag punctuation/words that live
// in code or links. Motorsport vocabulary that legitimately overlaps AI tells
// (boasts, showcase, landscape, navigate a chicane, …) is downgraded to info or
// excluded — see the rule table. Regexes are compiled once at module scope.

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintMatch {
  line: number; // 1-based
  column: number; // 1-based
  start: number; // offset into the RAW string
  end: number;
  excerpt: string;
}

export interface LintFlag {
  id: string;
  name: string;
  severity: LintSeverity;
  message: string;
  count: number;
  matches: LintMatch[];
}

// ---------------------------------------------------------------------------
// Masking — blank non-prose spans to spaces, preserving length + newlines so
// offsets stay aligned to the raw string.
function blankSpan(chars: string[], start: number, end: number): void {
  for (let i = start; i < end && i < chars.length; i++) {
    if (chars[i] !== '\n') chars[i] = ' ';
  }
}

function blankMatches(masked: string, re: RegExp): string {
  const chars = masked.split('');
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    blankSpan(chars, m.index, m.index + m[0].length);
    if (m[0].length === 0) re.lastIndex++; // guard against zero-width loops
  }
  return chars.join('');
}

export function maskNonProse(raw: string): string {
  const chars = raw.split('');
  // 1) Fenced code blocks — blank whole fenced regions (line-based, robust to
  //    a `[[...]]` or em-dash inside a code sample).
  let offset = 0;
  let inFence = false;
  for (const line of raw.split('\n')) {
    const isFence = /^[ \t]*(```|~~~)/.test(line);
    if (isFence) {
      blankSpan(chars, offset, offset + line.length);
      inFence = !inFence;
    } else if (inFence) {
      blankSpan(chars, offset, offset + line.length);
    }
    offset += line.length + 1; // + '\n'
  }
  let masked = chars.join('');
  masked = blankMatches(masked, /`[^`\n]+`/g); // inline code
  masked = blankMatches(masked, /\[\[[^\]\n]*\]\]/g); // data-embed shortcodes
  masked = blankMatches(masked, /\]\([^)\n]*\)/g); // markdown link target ](url) — keeps the [text
  masked = blankMatches(masked, /<https?:\/\/[^>\n]+>/g); // autolinks
  masked = blankMatches(masked, /\bhttps?:\/\/\S+/g); // bare URLs
  return masked;
}

// ---------------------------------------------------------------------------
interface Rule {
  id: string;
  name: string;
  severity: LintSeverity;
  re: RegExp;
  message: (match: string) => string;
  /** Only surface if the doc has at least this many hits (density-is-the-tell). */
  minCount?: number;
}

const RULES: Rule[] = [
  // --- Dashes (ERROR — operator ban) ---
  {
    id: 'em-dash',
    name: 'Em-dash',
    severity: 'error',
    re: /—/g,
    message: () => 'Em-dash (—) is banned. Replace with a comma, or split the sentence (a hyphen "-" only inside compound words).',
  },
  {
    // Only a SPACE-padded en-dash (punctuation use); tight ranges like P1–P5,
    // laps 10–15, 2024–2026 are intentionally allowed.
    id: 'en-dash-as-punctuation',
    name: 'En-dash as punctuation',
    severity: 'error',
    re: /\s–|–\s/g,
    message: () => 'En-dash (–) used as punctuation. Replace with a comma or hyphen (tight ranges like 10–15 are fine).',
  },
  // --- Signature constructions & filler (WARNING) ---
  {
    id: 'not-only-but-also',
    name: '"not only … but also"',
    severity: 'warning',
    re: /not only\b[^.!?\n]{1,80}\bbut also\b/gi,
    message: () => '"not only … but also" is an AI cadence. Rewrite as a plain statement.',
  },
  {
    id: 'antithesis',
    name: '"it\'s not just X, it\'s Y"',
    severity: 'warning',
    re: /\bnot just\b[^.!?\n]{0,60},?\s*(?:it'?s|it is|they'?re|he'?s|she'?s|but)\b/gi,
    message: () => '"It\'s not just X, it\'s Y" construction. Say the one thing you mean.',
  },
  {
    id: 'testament',
    name: '"a testament to"',
    severity: 'warning',
    re: /\b(?:a|another) testament to\b|\bstands? as a testament\b/gi,
    message: () => '"a testament to" is a cliché. Say what it actually demonstrates.',
  },
  {
    id: 'in-the-world-of',
    name: '"in the world of"',
    severity: 'warning',
    re: /\bin the world of\b/gi,
    message: () => '"In the world of …" filler opener. Start with the fact.',
  },
  {
    id: 'when-it-comes-to',
    name: '"when it comes to"',
    severity: 'warning',
    re: /\bwhen it comes to\b/gi,
    message: () => '"When it comes to …" filler. Cut to the point.',
  },
  {
    id: 'dive-in',
    name: '"dive in / let\'s dive into"',
    severity: 'warning',
    re: /\blet'?s dive\b|\blet us dive\b|\bdive (?:in|into)\b/gi,
    message: () => '"dive in / let\'s dive into" intro cliché. Just start.',
  },
  {
    id: 'filler-transition',
    name: 'Filler transition',
    severity: 'warning',
    re: /(?:^|[.!?]\s+|\n\s*)(Moreover|Furthermore|Additionally|In addition|In conclusion|In summary|To sum up|All in all|Overall|Ultimately)\b/g,
    message: (m) => `Filler transition ("${m.trim().replace(/^[.!?]\s+/, '')}"). Delete it or connect the ideas directly.`,
  },
  {
    id: 'hedging',
    name: 'Hedging filler',
    severity: 'warning',
    re: /\b(?:it'?s|it is) worth noting\b|\bit'?s important to note\b|\barguably\b|\bneedless to say\b/gi,
    message: () => 'Hedging filler. State it plainly or cut it.',
  },
  {
    id: 'intensifier',
    name: 'Vague intensifier',
    severity: 'warning',
    re: /\b(?:truly|remarkably|remarkable|genuinely|incredibly|undeniably|utterly)\b/gi,
    message: (m) => `Vague intensifier ("${m}"). Replace with a concrete fact (a time, a gap, a number).`,
    minCount: 2, // density is the tell, not one use
  },
  {
    id: 'vocab-ai',
    name: 'AI-favoured word',
    severity: 'warning',
    re: /\b(?:delve[ds]?|delving|tapestry|realm|myriad|plethora|seamless(?:ly)?|kaleidoscope|underscore[sd]?|ever-(?:evolving|changing))\b|\btreasure trove\b/gi,
    message: (m) => `AI-favoured word ("${m}"). Use a plainer, concrete word.`,
  },
  // --- Context-dependent (INFO — legitimate in motorsport writing) ---
  {
    id: 'navigate-metaphor',
    name: '"navigate the complexities"',
    severity: 'info',
    // metaphor only — "navigates the chicane" (literal, ubiquitous) is NOT matched
    re: /\bnavigat(?:e|es|ed|ing)\s+the\s+(?:complexit|nuance|intricac|landscape|world|challenge)/gi,
    message: () => 'Possible AI tell ("navigate the …"). Fine if literal; otherwise say it plainly.',
  },
  {
    id: 'soft-vocab',
    name: 'Possible AI tell',
    severity: 'info',
    re: /\b(?:boasts?|showcase[ds]?|elevate[ds]?|vibrant|nestled|symphony|spearhead(?:ed|s|ing)?|garner(?:ed|s|ing)?)\b/gi,
    message: (m) => `Possible AI tell ("${m}"). Fine if you mean it literally; otherwise pick a plainer word.`,
  },
  // --- Document-level (INFO, thresholded) ---
  {
    id: 'tricolon-overuse',
    name: 'Rule-of-three overuse',
    severity: 'info',
    re: /\b\w+, \w+,? and \w+\b/g,
    message: () => 'Rule-of-three list ("X, Y, and Z"). A few is fine; several in one piece reads mechanical.',
    minCount: 3,
  },
];

function lineColOf(masked: string, index: number): { line: number; column: number } {
  let line = 1;
  let lastNl = -1;
  for (let i = 0; i < index; i++) {
    if (masked[i] === '\n') {
      line++;
      lastNl = i;
    }
  }
  return { line, column: index - lastNl };
}

function excerptOf(raw: string, start: number, end: number): string {
  const a = Math.max(0, start - 16);
  const b = Math.min(raw.length, end + 16);
  return (a > 0 ? '…' : '') + raw.slice(a, b).replace(/\s+/g, ' ').trim() + (b < raw.length ? '…' : '');
}

/**
 * Flag AI-writing tells in a markdown body. Returns one entry per rule that
 * fired (>= its minCount), each carrying its matches with raw-string offsets so
 * the composer can select the offending text. Pure + deterministic.
 */
export function lintAiProse(markdown: string): LintFlag[] {
  if (!markdown) return [];
  const masked = maskNonProse(markdown);
  const flags: LintFlag[] = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    const matches: LintMatch[] = [];
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(masked)) !== null) {
      // filler-transition captures the word in group 1; anchor to it so the
      // leading sentence punctuation isn't part of the selection.
      const gIndex = rule.id === 'filler-transition' && m[1] ? m.index + m[0].indexOf(m[1]) : m.index;
      const gText = rule.id === 'filler-transition' && m[1] ? m[1] : m[0];
      const start = gIndex;
      const end = gIndex + gText.length;
      const { line, column } = lineColOf(masked, start);
      matches.push({ line, column, start, end, excerpt: excerptOf(markdown, start, end) });
      if (m[0].length === 0) rule.re.lastIndex++;
    }
    if (matches.length >= (rule.minCount ?? 1)) {
      flags.push({
        id: rule.id,
        name: rule.name,
        severity: rule.severity,
        message: rule.message(matches[0].excerpt.replace(/^…|…$/g, '')),
        count: matches.length,
        matches,
      });
    }
  }
  // errors first, then warnings, then info; stable within a severity.
  const order: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function lintSummary(flags: LintFlag[]): { errors: number; warnings: number; infos: number } {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const f of flags) {
    if (f.severity === 'error') errors += f.count;
    else if (f.severity === 'warning') warnings += f.count;
    else infos += f.count;
  }
  return { errors, warnings, infos };
}
