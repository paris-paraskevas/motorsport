# The APEX study

Everything Claude learned from Oracle APEX 26.1 for the components programme (Paddock Developer), moved here on 2026-09-10 so it survives the session scratchpad. Oracle's documentation text itself is not committed; each note carries the page it came from as a `source` URL (docs.oracle.com/en/database/oracle/apex/26.1/htmdb/).

The reasoning built on these files is the plan artifact `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8` ("Paddock Developer Plan": concept map, vocabulary, the 58 pages audited, phases, timeline, the skips scrutinised, integrations, the ledger draft, the Page Designer click-level map, the spherical view of the full read, chapter coverage).

## The study of the App Builder User's Guide (742 pages, 1,212 concepts)

| File | What it holds |
|---|---|
| `notes-all.json` | The first study (runs 1–5, 193 pages): 455 concepts, one object each: `area`, `name`, `apex` (what it is), `attributes` (what a developer sets), `workflow`, `skip_for_web` (why a web app would not copy it), `source`. |
| `notes-6.jsonl` … `notes-14.jsonl` | The full read (runs 6–14, the remaining 549 pages): 757 concepts with the same fields plus `relevant` (yes/no) and `relevance` (what Paddock Developer takes from it, or why not). One JSON object per line. |
| `digest.txt` | One line per concept of the first study, with its area, attribute count and skip flag. |
| `findings-digest.txt` | The full read folded into one digest: totals per run and per area, every relevant line grouped by area, the not-relevant names. |
| `summarise-findings.mjs` | The script that produces `findings-digest.txt` from the notes. |
| `verdicts.json` | The 161 concepts the first study flagged as skips, scrutinised one by one: `have` (Paddock has it another way) or `adapt` (worth having, with the how); the rest are plumbing. |
| `coverage.json` | The guide's table of contents against the pages read, per chapter (built before the full read; the full read then covered the rest). |
| `runs.json` | How the 549 pages were packed into the nine sequential Sonnet runs. |
| `ux-map.jsonl` | The Page Designer as an app: 114 click paths (`kind: action`: where you press, what appears, the result, the shortcut) and 61 structures (`kind: structure`: panes, trees, menus, attribute groups in the documented order). |

## The audit of Paddock's own pages

| File | What it holds |
|---|---|
| `imports.txt` | Every route file under `app/(app)` with the components it draws (to depth 3) and the lib modules involved, generated from the import statements. |
| `audit-A.jsonl`, `audit-B.jsonl` | The 58 routes, section by section (299 sections): what each shows, its source, its interactivity, when it appears, and the general component it becomes. |

## The plan documents (drafts until the operator's word)

| File | What it holds |
|---|---|
| `spherical.txt` | The consolidated view of what the full read changes: the rules, the phases and slots, the vocabulary, and what it confirms. |
| `rules.md` | The executive rules, v2, scrutinised against Anthropic's published guidance; part A of the spherical view is what v3 adds. |
| `components-programme.md` | The ledger draft: 63 slots with scope, decision scan, acceptance test and an empty evidence cell. To be revised per the spherical view and re-issued as JSON with a generated view. |
| `batches.md` | The batch order proposed on 2026-09-10, with an issue and a solution per item. |
| `audit-overnight.md` | The Sonnet auditor's scrutiny of the batch list: verdict, the questions ranked for the operator, tonight's plan, the corrected sequence, mechanisms and mistakes for unattended work, risks. |

How the study was done: the guide's pages were downloaded to plain text by a script at zero model cost, then read from disk by one Sonnet agent at a time, each writing its notes incrementally. Total: about 5 million Sonnet tokens for the study, the audit, the click-level map and the full read.
