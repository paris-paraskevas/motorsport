// Parser for the FIA "Car Presentation Submissions" PDF (one per Grand Prix),
// after `pdftotext -layout` has turned it into positional plain text. This is
// the deterministic core of the F1-upgrades ingest (see
// docs/content-authoring/f1-upgrades-playbook.md): it turns the doc into the
// per-team component rows the weekend page renders.
//
// What it extracts RELIABLY (number-anchored + keyword-detected, verified
// against three real docs in f1-parse.test.ts): the round metadata, the team
// set, per-team item counts, each item's component and reason class, and
// "no updates" teams. The FIA "Brief description" column wraps and interleaves
// across rows in the -layout output, so it is NOT reliably attributable per
// item; `detail` therefore carries the short "Geometric differences" phrase
// (per-item, on the numbered row) as an honest, machine-clean proxy. A curator
// (or the cron's alert step) can enrich `detail` from the raw doc — the curated
// content historically hand-condenses it anyway.

export interface ParsedUpgradeItem {
  component: string;
  reason: string;
  /** The FIA "geometric difference" phrase — short, per-item. */
  detail: string;
}
export interface ParsedUpgradeTeam {
  team: string;
  items: ParsedUpgradeItem[];
}
export interface ParsedUpgrades {
  doc: number | null;
  date: string | null; // ISO yyyy-mm-dd
  gp: string | null; // e.g. "Hungarian Grand Prix"
  /** Teams WITH at least one item (the render/schema convention). */
  teams: ParsedUpgradeTeam[];
  /** Teams that submitted "No updates" — surfaced for the confidence gate. */
  noUpdateTeams: string[];
  /** Anomalies for the cron's validation step; empty = high-confidence parse. */
  warnings: string[];
}

// Canonical short names the content schema uses, matched against the decorated
// FIA entrant names ("*TGR HAAS F1 TEAM*", "Oracle Red Bull Racing.", …).
const ROSTER: ReadonlyArray<readonly [RegExp, string]> = [
  [/mclaren/i, 'McLaren'],
  [/mercedes/i, 'Mercedes'],
  [/red bull/i, 'Red Bull'],
  [/ferrari/i, 'Ferrari'],
  [/williams/i, 'Williams'],
  [/racing bulls/i, 'Racing Bulls'],
  [/aston martin/i, 'Aston Martin'],
  [/haas/i, 'Haas'],
  [/audi/i, 'Audi'],
  [/alpine/i, 'Alpine'],
  [/cadillac/i, 'Cadillac'],
];

const REASON_CLASSES: ReadonlyArray<readonly [RegExp, string]> = [
  [/circuit\s*specific/i, 'Circuit specific'],
  [/performance/i, 'Performance'],
  [/cooling\s*range/i, 'Cooling Range'],
  [/reliability/i, 'Reliability'],
  [/structural/i, 'Structural Improvement'],
  [/balance\s*range/i, 'Balance Range'],
  [/correlation/i, 'Correlation'],
];

// Header / boilerplate lines inside a team table that are NOT item rows.
const HEADER_LINE =
  /primary reason|geometric differences|brief description|previous version|min 20|max 100 words|^\s*updated\b|^\s*component\b|for update\s*$/i;

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, m => m.toUpperCase())
    .trim();
}

// Known sub-reasons, longest-first so "local flow conditioning" wins over
// "flow conditioning". Vocabulary-driven so geo/description text bleeding into
// a degenerate reason cell can't corrupt the label — we extract the class + the
// first known sub-reason and ignore the rest.
const SUBREASONS =
  /(local flow conditioning|flow conditioning|local load|drag reduction|drag range|brake cooling|cooling range|mechanical setup|balance range|structural improvement|cooling)/i;

/** "Performance - Flow Conditioning" / "Circuit Specific � Drag Reduction" →
 *  "Performance — Flow Conditioning" / "Circuit specific — Drag Reduction". */
export function normalizeReason(raw: string): string {
  const cleaned = raw.replace(/[–—�]/g, '-').replace(/\s+/g, ' ').trim();
  const clsEntry = REASON_CLASSES.find(([re]) => re.test(cleaned));
  if (clsEntry) {
    const rest = cleaned.replace(clsEntry[0], ' ');
    const sub = SUBREASONS.exec(rest)?.[1];
    return sub ? `${clsEntry[1]} — ${titleCase(sub)}` : clsEntry[1];
  }
  const [head, ...rest] = cleaned.split(/\s*-\s*/);
  return rest.length ? `${titleCase(head)} — ${titleCase(rest.join(' '))}` : titleCase(head);
}

// Segment a line into { start, text } cells split on runs of 2+ spaces.
function segments(line: string): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = [];
  const re = /\S(?:.*?\S)?(?=\s{2,}|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[0].trim()) out.push({ start: m.index, text: m[0].trim() });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

const nearest = (offset: number, cols: number[]): number =>
  cols.reduce((best, c, i) => (Math.abs(c - offset) < Math.abs(cols[best] - offset) ? i : best), 0);

function parseTeamItems(bodyLines: string[], warn: (w: string) => void, team: string): ParsedUpgradeItem[] {
  const lines = bodyLines.filter(l => l.trim() && !HEADER_LINE.test(l));
  // Column model from the first numbered row: [component, reason, geo]. The
  // number sits in its own left cell; drop it and key columns off cells 1-3.
  const firstNum = lines.find(l => /^\s*\d+\s+\S/.test(l));
  if (!firstNum) {
    warn(`${team}: no numbered rows found`);
    return [];
  }
  // The row number is usually merged into the first cell ("1 Front Corner"),
  // sometimes its own cell ("1"). Strip it either way, keeping the cell's start
  // offset so the component column still anchors at the left.
  const stripNum = (segs: { start: number; text: string }[]) => {
    if (!segs.length) return segs;
    if (/^\d+$/.test(segs[0].text)) return segs.slice(1);
    return [{ start: segs[0].start, text: segs[0].text.replace(/^\d+\s*/, '') }, ...segs.slice(1)];
  };
  const cols0 = stripNum(segments(firstNum));
  const colStarts = [cols0[0]?.start ?? 0, cols0[1]?.start ?? 999, cols0[2]?.start ?? 9999];
  const descFrom = colStarts[2] + 12; // description column sits right of geo

  type Draft = { component: string[]; reason: string[]; geo: string[] };
  const drafts: Draft[] = [];
  let cur: Draft | null = null;

  for (const line of lines) {
    const isNum = /^\s*\d+\s+\S/.test(line);
    if (isNum) {
      cur = { component: [], reason: [], geo: [] };
      drafts.push(cur);
    } else if (!cur) {
      continue;
    }
    const cells = isNum ? stripNum(segments(line)) : segments(line);
    for (const s of cells) {
      if (s.start >= descFrom) continue; // description column — prose, skip
      const col = nearest(s.start, colStarts);
      (col === 0 ? cur!.component : col === 1 ? cur!.reason : cur!.geo).push(s.text);
    }
  }

  // Reason class + MULTI-WORD sub-reason keywords. A single-spaced table merges
  // the reason cell into the component cell; cutting the component at the first
  // such keyword recovers it. Multi-word only, so a real component like
  // "Cooling Louvres" (bare "Cooling") is never truncated.
  const CUT_KW =
    /\b(?:Performance|Circuit\s*specific|Cooling\s*Range|Reliability|Structural|Balance\s*Range|Correlation|Flow\s*Conditioning|Local\s*Load|Drag\s*Range|Drag\s*Reduction|Brake\s*Cooling|Mechanical\s*Setup)\b/i;
  const hasClass = (s: string) => REASON_CLASSES.some(([re]) => re.test(s));

  return drafts.map(d => {
    const rawComponent = d.component.join(' ').replace(/\s+/g, ' ').trim();
    const cut = rawComponent.split(CUT_KW)[0].trim();
    const component = cut || rawComponent;
    let reason = normalizeReason(d.reason.join(' '));
    // Reason fallback: when the class keyword got absorbed into the component
    // cell, re-derive from the whole item's text so the class is still found.
    if (!hasClass(reason)) reason = normalizeReason([rawComponent, ...d.reason, ...d.geo].join(' '));
    const detail = d.geo.join(' ').replace(/\s+/g, ' ').trim();
    // Only genuinely unresolved items warn — a clean cut with a resolved reason
    // is a silent success. These warnings ARE the cron's auto-vs-alert gate.
    if (!component) warn(`${team}: an item has no component`);
    if (!hasClass(reason)) warn(`${team}: "${component || rawComponent}" — reason unresolved, needs curation`);
    return { component, reason, detail };
  });
}

export function parseCarPresentation(text: string): ParsedUpgrades {
  const warnings: string[] = [];
  const warn = (w: string) => warnings.push(w);

  const doc = Number(/\bDocument\s+(\d+)/.exec(text)?.[1]) || null;
  const dm = /\bDate\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(text);
  const date = dm ? `${dm[3]}-${MONTHS[dm[2].toLowerCase()] ?? '01'}-${dm[1].padStart(2, '0')}` : null;
  const titleLine = text.split(/\r?\n/).find(l => /grand prix/i.test(l))?.trim() ?? '';
  const gp = titleLine ? titleCase(titleLine.replace(/^\s*\d{4}\s*/, '')) : null;

  // Split into team chunks on the "Car Presentation … <GP> Grand Prix" separators.
  const chunks = text.split(/^.*Car Presentation.*Grand Prix.*$/im);
  const teams: ParsedUpgradeTeam[] = [];
  const noUpdateTeams: string[] = [];

  // chunks[0] is the document header; each subsequent chunk is one team.
  for (const chunk of chunks.slice(1)) {
    const chunkLines = chunk.split(/\r?\n/);
    const nameLine = chunkLines.find(l => l.trim());
    if (!nameLine) continue;
    const team = ROSTER.find(([re]) => re.test(nameLine))?.[1];
    if (!team) {
      warn(`unrecognised team header: "${nameLine.trim()}"`);
      continue;
    }
    if (/no updates?(\s+submitted)?/i.test(chunk)) {
      noUpdateTeams.push(team);
      continue;
    }
    const items = parseTeamItems(chunkLines, warn, team);
    if (items.length === 0) warn(`${team}: table present but no items parsed`);
    else teams.push({ team, items });
  }

  const seen = new Set<string>();
  for (const t of [...teams.map(t => t.team), ...noUpdateTeams]) {
    if (seen.has(t)) warn(`duplicate team section: ${t}`);
    seen.add(t);
  }
  if (teams.length === 0) warn('no teams with items parsed — likely a layout/extraction failure');

  return { doc, date, gp, teams, noUpdateTeams, warnings };
}
