# The components programme — the ledger

DRAFT for the operator's word ("ledger go"). Intended home: `docs/plan/components-programme.md`. This file is the single record of the plan. Every PR of the programme carries its slot id in its title (`[P1.3]`). A slot is DONE only when its evidence is written here: the PR number, the prod time, and the acceptance test's result line. A test (`lib/design/plan-ledger.test.ts`, to be added with this file) fails the build when a page is served from rows without a Phase 3 slot marked done, so a route file cannot leave the code outside the plan.

Plan page (the reasoning behind every row): artifact `4d804904-63ad-4ddf-8d37-67dcb2d2fcc8`.

## Rules the ledger enforces

1. **Decision scan before a slot starts.** Three lines at the top of the slot's PR plan: `Fixed by:` (plan, prototype, rule) · `Defaults I take:` (recorded below the same day, reversible, in-scope) · `Needs your word:` (scope, order or timeline changes; a shape or name readers see that the plan does not fix; a new component, dependency or vendor; anything irreversible or outward; two materially different readings; a departure from a rule). A non-empty third line stops the slot until the operator answers, in one or two sentences with a default. Overnight = decision-free slots only.
2. **Gates on every PR.** `tsc` 0 · `lint` 0 errors · full vitest · `cf:build` + `wrangler deploy --dry-run` Total Upload quoted · a browser run on the local server · a review page for the operator · every component ships with a test rendering it from a saved document · every deleted route file ships with its parity output in the PR.
3. **No page-specific component.** A section that fits no general component is a question in `Needs your word`, never a new component.
4. **Source, never a query.** Components pick from the source catalogue; the loader stays the only writer.
5. **Agents and tokens.** Reading and auditing agents run on Sonnet or Haiku, one at a time, writing incrementally; building is done directly, no agents; every fan-out is announced (count × model × expected tokens) and reported after; none above 60% session usage.
6. **Session ritual.** Start: read this file, name the next slot, write its decision scan. End: update the slot's evidence and `docs/HANDOFF.md`.

## Changes to the plan (dated, with the operator's word)

| Date | Change | Word |
|---|---|---|
| 2026-09-09 | Ledger drafted from the plan page; nothing built yet. | pending |

## Phase 1 — The shell grows to APEX's shape

Every component inherits these; nothing changes for readers until a region is given a look. Acceptance tests quote the UX map's click paths.

| Slot | Scope | Decision scan | Acceptance test | Evidence |
|---|---|---|---|---|
| P1.1 Region looks | The Appearance group on every region: Template = plain · boxed · band · aside · hero; the renderer draws the look; defaults in Component Settings. | Fixed by: APEX Appearance › Template. Defaults: the five names. **Needs your word:** the five looks shown side by side before the names are final. | Pick "band" on a Static Content region, Save and Run: the preview and the served page carry the band; a test renders a saved document with each look. | |
| P1.2 Template options | Groups with presets: Spacing (tight/normal/roomy), Heading style, Rule, Emphasis, Width; `#DEFAULT#` behaviour (a region follows the template's preset until it diverges); Global options. | Fixed by: APEX Template Options, Presets, Default. Defaults: the five groups. Needs your word: none. | Change a preset on a look; every region on the default follows; a diverged region keeps its own; test from a saved document. | |
| P1.3 Header and Footer text, Configuration | Header Text and Footer Text on every region (shortcuts substitute); Configuration › Build Option on every region, honoured by the renderer. | Fixed by: APEX region groups. Needs your word: none. | A region with a build option Excluded does not render; its text renders above and below when Included; test. | |
| P1.4 Rendering points and tree creates | Points Before Regions, After Regions, Before Footer, After Footer in the Rendering tree; right-click: Create Region, Create Sub Region (parent region), Create Page Item (placeholder until Form), Create Button, Duplicate, Delete, Copy To; Ctrl+drag duplicates. | Fixed by: the UX map's Rendering-tab structures. Defaults: Sub Region = parent region nesting one level. **Needs your word:** nesting depth (one level proposed). | Each menu item present in the documented order; Ctrl+drag makes a copy beneath; browser run. | |
| P1.5 Layout tab and Gallery conformance | Layout menu: Display from Here, Display from Page; Expand and Restore; Gallery right-click Add To with the positions list; Utilities › Show ▸ (Tooltips, Layout View) and Layout ▸ (Two Pane Mode, Three Pane Mode, Reset Layout). | Fixed by: the UX map. Needs your word: none. | Each control present where documented; Two Pane hides the left pane; Reset Layout restores; browser run. | |
| P1.6 Property Editor conformance | Edited-attribute marker until Save; multi-select shows common attributes and edits them together; Region / Attributes tab split for components with settings. | Fixed by: the UX map's Property Editor structures. Needs your word: none. | Select two regions, change Position: both move; a changed attribute shows the marker until Save; browser run. | |
| P1.7 Developer Toolbar: Quick Edit and Info | Quick Edit Mode (click a region → the designer opens with it selected, Esc exits); Live Template Options (wrench on hover); Info › Show Layout Columns, Show Page Timing; Options › Auto Hide, Show Icons Only, Display Position. | Fixed by: the UX map's Developer Toolbar structures. Needs your word: none. | From Save and Run, Quick Edit lands on the region; the wrench changes a template option live; browser run. | |
| P1.8 Theme Roller from the toolbar | Customize › Theme Roller: the custom theme's tokens edited live over the running page; Save as new theme; Reset. Edit Logo opens the wordmark setting. | Fixed by: APEX Theme Roller, our tokens-first decision. **Needs your word:** which tokens the live editor exposes (the nine of the contrast gate proposed). | Change the accent live; Save as new theme; pick it as default; the site follows; browser run. | |
| P1.9 Debug panel | Debug menu on the toolbar: which source each component read, which loader run it came from, how long each took, which show and authorization rules fired, which dynamic actions fired. | Fixed by: APEX Debug (View Debug), adapted. Needs your word: none. | The panel lists every component of Home with a source and a time; test on the collector. | |
| P1.10 Create menu conformance | Create › Page Group (opens the groups sheet), Developer Comment (opens the page's Comments attribute), Breadcrumb Region (adds the Breadcrumb component once P2.19 exists, disabled until then). | Fixed by: the UX map's Create menu. Needs your word: none. | Items present in the documented order; browser run. | |

## Phase 2 — The general components, over declared sources

Each component: a spec in the catalogue, its settings and defaults in Component Settings, its template options, a renderer, and a test rendering it from a saved document.

| Slot | Scope | Decision scan | Acceptance test | Evidence |
|---|---|---|---|---|
| P2.1 Source catalogue | The sources a component may read: series, season, standings table, results, rounds, sessions, drivers, teams, posts, news, authors, releases, tracks. The Source group UI (pick from a list; parameters like series and season). The 4.3 Object Browser lists the same catalogue in Data. | Fixed by: APEX Source › Location/Type; rule 4. **Needs your word:** the first catalogue list. | A component's Source picks "standings · f1 · 2026" and the renderer reads it; test. | |
| P2.2 Table | Typed columns (text, number, gap, link, badge, position), heading, footer, rows limit; named column presets per source shape (the fifteen standings and results shapes as presets, not pages). | Fixed by: APEX Classic Report. **Needs your word:** preset names per series shape shown as a list. | Standings for f1 and MotoGP render from the same component with different presets; test per preset. | |
| P2.3 Table self-service | Users may sort, filter, hide columns, download CSV, as settings (TanStack Table). | **Needs your word:** TanStack Table as a dependency (pending). | Sort and CSV work on a served table; bundle delta quoted. | |
| P2.4 Table rules and links | Row highlight rule (leader, podium, followed series); column link to a page or pattern. | Fixed by: APEX Column Link, conditional row styling. Needs your word: none. | A highlighted leader row; a driver name linking to /drivers/[slug]; test. | |
| P2.5 Cards | Layout grid/row/float; slots Title, Subtitle, Body, Media, Badge, Action; sources drivers, teams, series, posts, rounds, authors. | Fixed by: APEX Cards. Needs your word: none. | Drivers by team as Cards; the lead story as one card; test. | |
| P2.6 Media list | Items, show source, age, series; sources news, posts, threads. | Fixed by: APEX Media List / Content Row. Needs your word: none. | The wire as an instance; test. | |
| P2.7 Timeline | Sessions of a round, events of a season, releases; local time; past and future styling. | Fixed by: APEX Timeline. Needs your word: none. | The weekend schedule and the changelog render; test. | |
| P2.8 Metric cards | Figures with labels and trend; sources standings brief, weekend facts, data counts. | Fixed by: Metric Card (26.1 gallery). Needs your word: none. | Leader and gap on a series hub; test. | |
| P2.9 Countdown | Next session of a series or all; show session name; local time. | Domain component. Needs your word: none. | The driver page's Next out; test. | |
| P2.10 Live band | Weekends under way; also-racing rows; the race-weekend fact for show rules. | Domain component. Needs your word: none. | Home's This weekend as an instance; test. | |
| P2.11 Tabs | Region Display Selector: mode view single / scroll; remember last; icons; over regions or child pages. | Fixed by: APEX Region Display Selector. **Needs your word:** series tabs as one page with Tabs, or one page per tab (asked at P3.4). | Weekend Preview/Report as Tabs; test. | |
| P2.12 Filters | Facets from a source's columns (series, season, type, status); counts; reset; batch; filters a Table, Cards or Calendar on the page. | Fixed by: APEX Faceted Search / Smart Filters. Needs your word: none. | The calendar's series filter and the news filter as instances; test. | |
| P2.13 Chart | Type, series, axes, legend; sources season trend, qualifying gaps, comparisons (Recharts). | Fixed by: APEX Chart. Needs your word: none. | The points trajectory on a team page; test. | |
| P2.14 Map | Circuits layer, initial view, markers (Leaflet). | Fixed by: APEX Map. Needs your word: none. | The tracks map; test. | |
| P2.15 Embed | Video or allowed iframe; provider, ratio, consent. | Fixed by: APEX URL region. Needs your word: none. | A highlights clip on a weekend; test. | |
| P2.16 Weather | Open-Meteo by venue-local date; hourly or daily; sessions overlay. | Domain component. Needs your word: none. | The weekend's weather strip; test. | |
| P2.17 Circuit | The round's venue: map, facts, layout image; fixes the Madrid venue bug on the way. | Domain component. **Needs your word:** the official 2026 F1 calendar as the source of the venue fix (content PR). | Round 14 shows Madrid, not Barcelona; test. | |
| P2.18 Search | The site index as a region; hints; scope. | Fixed by: APEX Search. Needs your word: none. | The Learn hub's search as an instance; test. | |
| P2.19 Breadcrumb | From the page tree; show home; separator. | Fixed by: APEX Breadcrumb. Needs your word: none. | A series tab's breadcrumb; test. | |
| P2.20 Form and items | Items text, textarea, select (lists of values), switch, choice; validations with messages inline or in notification; a success step that can send an email (Resend) or a push. | Fixed by: APEX Form, items, validations. **Needs your word:** the item set (five proposed). | Contact as a Form; a validation shows inline; test. | |
| P2.21 Comments | Threads and replies; order; sign-in prompt. | **Needs your word:** only if replies are wanted (nothing has them today). | Deferred until the word. | |
| P2.22 Clerk widget | Sign-in, sign-up, account profile as a region; appearance from the theme. | Domain component. Needs your word: none. | /sign-in as a composed page; test. | |
| P2.23 Email Templates | Shared component: subject and body with placeholders, edited in the designer, sent through the existing Resend wrapper by contact, welcome, feedback, draft-ready. | Fixed by: APEX Email Templates; Resend already wired. Needs your word: none. | The welcome email renders from the row; test. | |
| P2.24 Automations page | Data › Automations: GitHub Actions workflows and crons with last run, next run, Run now (dispatch). | Fixed by: APEX Automations, adapted. Needs your word: none. | Run now dispatches the loader; the run appears; browser run. | |
| P2.25 Home's six become instances | home.lead → Cards; home.live → Live band; home.result → Table preset; home.changed → Table preset; home.next → Cards; home.wire → Media list; the home.* specs retired. | Fixed by: rule 3. Needs your word: none. | Home renders identically from general components; parity output. | |

## Phase 3 — The pages, family by family

Each slot: compose the pages from the vocabulary, run the parity check (served page, title, description, card, structured data, before and after), delete the route file, mark `served: 'rows'`.

| Slot | Pages | Decision scan | Acceptance test | Evidence |
|---|---|---|---|---|
| P3.1 Prose pages | /about (prose moves to a content file first), the seven legal pages, /write-for-us, /contribute, /changelog, /information/series-guides. | Fixed by: Static content, Media list, Timeline, Form. Needs your word: none. | Parity on each; 12 route files gone. | |
| P3.2 Learn hub | /information, /information/[topic], /information/[topic]/[slug], /information/map. | Fixed by: Link list, Search, Filters, Map, Circuit, Breadcrumb. Needs your word: none. | Parity; 4 files gone. | |
| P3.3 Series directory and hub | /series, /series/[slug]. | Fixed by: Cards, List, Table, Metric cards, Countdown, Link list. Needs your word: none. | Parity; 2 files gone. | |
| P3.4 Series tabs | /series/[slug]/[tab], eighteen sections across the tabs. | **Needs your word:** one page with Tabs, or one page per tab. | Parity per tab; file gone. | |
| P3.5 Archive | /archive, /archive/[season]/[slug], /archive/[season]/[slug]/weekend/[round] (build-time data source). | Fixed by: List, Table, Static content. Defaults: the archive stays cached at build. Needs your word: none. | Parity; 3 files gone. | |
| P3.6 Weekend | /series/[slug]/weekend/[round], nineteen sections, Preview and Report as Tabs. | Fixed by: the vocabulary. **Needs your word:** the Bets tab as a Form or kept as a code component for now. | Parity in both modes; file gone. | |
| P3.7 Session | /series/[slug]/weekend/[round]/[session], per-visit render, six telemetry Charts, Race Story Timeline. | Fixed by: the vocabulary; the row's rendering dynamic. Needs your word: none. | Parity on a past F1 session; file gone. | |
| P3.8 Drivers and teams | /drivers/[slug], /teams/[slug]; adds the missing JSON-LD. | Fixed by: Metric cards, List, Static content, Countdown, Link list, Chart. Needs your word: none. | Parity; 2 files gone. | |
| P3.9 F1 analysis and compare | /f1/analysis, /f1/compare (the picker as a Form; the gate as a show rule). | Fixed by: Cards, List, Form, Metric cards, Chart. Needs your word: none. | Parity; 2 files gone. | |
| P3.10 Blog | /blog, /blog/[slug] (reactions as Buttons with a dynamic action). | Fixed by: Media list, Cards, Static content, Buttons. Needs your word: none. | Parity; 2 files gone. | |
| P3.11 News and authors | /news, /authors, /authors/[slug]. | Fixed by: Tabs, Filters, Link list, Media list. Needs your word: none. | Parity; 3 files gone. | |
| P3.12 Studio | /studio, /studio/new, /studio/[id] (the editor stays a code component inside a composed page). | **Needs your word:** the editor as a code component (proposed) or a Form with a markdown item. | Parity; 3 files gone. | |
| P3.13 Settings | /settings and its five children (Forms, Metric cards, Cards, Table). | Fixed by: the vocabulary. Needs your word: none. | Parity; 6 files gone. | |
| P3.14 Contact and feedback | /contact, /feedback (staff). | Fixed by: Form, Filters, Table. Needs your word: none. | Parity; 2 files gone. | |
| P3.15 Social | /social, /social/friends, /social/friends/add/[id], /social/leagues, /social/leagues/[id], /social/leagues/join/[token], /social/users/[id]. | Fixed by: Cards, Table, Form, Buttons, Timeline, Metric cards. Needs your word: none. | Parity; 7 files gone. | |
| P3.16 Threads | /social/threads, /threads/[id] (a single moderated post: Static content and a Form; Comments only on the word). | Fixed by: the vocabulary; P2.21 pending. Needs your word: none beyond P2.21. | Parity; 2 files gone. | |
| P3.17 Sign-in and sign-up | /sign-in, /sign-up as Clerk widget pages. | Fixed by: P2.22. Needs your word: none. | Parity; 2 files gone. | |
| P3.18 Home | / from general instances (P2.25); the route file leaves. | Fixed by: P2.25. Needs your word: none. | Parity; file gone. | |
| P3.19 The last file | Only `[...catchall]` and `preview/[rev]` remain under app/(app); the registry test asserts every other page is `served: 'rows'`. | Fixed by: the plan. Needs your word: none. | The registry test passes with 56 rows-served pages. | |

## Phase 4 — Full control

| Slot | Scope | Decision scan | Acceptance test | Evidence |
|---|---|---|---|---|
| P4.1 W2 application key from the request | `?app=` and the application row; the 'paddock' constant retired from routes and loaders. | Fixed by: the workspaces plan. Needs your word: none. | Every designer read carries the key; tests. | |
| P4.2 W3 sign-in step | Clerk sign-in then "Choose a workspace" (skipped with one); Organizations on in the Clerk dashboard (operator). | **Needs your word:** turning Organizations on. | The step appears with two workspaces; browser run. | |
| P4.3 W4 App Builder home | The applications list, Create Application (Name, Alias, Workspace, First page), the application home with cards, pages table, About / Recently edited / Tasks (the third draft). | Fixed by: the third draft and the onboarding screens. Needs your word: none. | A second application created and opened; browser run. | |
| P4.4 W5 serving a second application | `/a/<alias>/…` through the catch-all; own domain later. | **Needs your word:** path prefix (default) or a domain. | The second application's page serves; browser run. | |
| P4.5 Application Definition tabs | Security (Clerk, read-only), Globalization, User Interface, Progressive Web App. One PR per tab. | Fixed by: APEX tabs. Needs your word: none. | Each tab shows its rows; browser run. | |
| P4.6 Members and Moderation | Data › Members (author requests, supporter flag) and Moderation (feedback, threads) as a Tasks list over the approval rows. | Fixed by: the operator's homes, the Tasks-list shape. Needs your word: none. | An author request approved from the page; browser run. | |
| P4.7 Copy Page | Create › Copy Page: number, name, group, regions copied. | Fixed by: APEX Copy Page. Needs your word: none. | A copy opens with the same regions; test. | |
| P4.8 Page modes | Modal dialog and drawer pages; the Dialogs, Drawers and Popups node; the Dialog attribute group. | Fixed by: APEX page modes. **Needs your word:** which pages become dialogs first (contact proposed). | Contact opens as a dialog from a Button; browser run. | |
| P4.9 Object Browser data view | Data › Tables: columns, 25 rows, used by; the same catalogue as P2.1. | Fixed by: the 4.3 draft. Needs your word: none. | Every source listed with its columns; browser run. | |

## Done before the ledger (for the record)

R1 quick fixes (#966, 1.0.86) · R2a components exist (#967, 1.0.87) · R2b Home's six (#968, 1.0.88) · R4.1 Calendar served from rows (#970, 1.0.90) · Run never refused (#972, 1.0.92).
