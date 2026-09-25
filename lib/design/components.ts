// The component catalogue (APEX: region types; the operator, 2026-09-09: "we
// want to stray further away from code serving the site and go to components
// the developer/app builder has … a bunch of components and templates with
// tweaks at certain parts", and "code pages should not exist. FINAL!"). A
// component is a piece the code knows how to draw; a page's body is a list of
// them, each with its settings and its rule. This file is the client-safe
// half: what exists, what each takes, how a stored settings object is read.
// The server half (component-render.tsx) draws them.
//
// THE RULE THIS FILE ENFORCES: a component's key and its settings are checked
// here, once, for the designer, the parser and the renderer alike. An unknown
// key or a setting outside its spec is a problem the writer refuses; the reader
// keeps the usable part and falls back to the defaults.

import { PRESETS, PRESET_GROUPS, SHAPES, findPreset } from './presets';
import { CURRENT_SEASON, SERIES_OPTIONS } from './sources';

export type SettingValue = string | number | boolean;

// THE COMPONENT DEFINITION MODEL (the components programme, P2.0; APEX:
// Plug-ins). A definition says what a component type takes: its attributes,
// each with a scope, an editor and a default, in named groups; the events it
// fires; the capability flags that gate sections of the Property Editor; the
// slots other components may nest in. The documents store an instance's
// attribute values under `settings`, the field's name since R2b, so the word
// stays here; APEX calls them attributes and so does the Property Editor.

/** APEX: the Scope of a custom attribute. Absent reads as component. */
export type AttributeScope = 'application' | 'component' | 'report';
/** APEX: Select List · Number · Yes/No · Text · Color · Icon · Link to Target Page. */
export type AttributeKind = 'choice' | 'number' | 'boolean' | 'text' | 'colour' | 'icon' | 'link';

/** An option of a choice. `group` draws the choice as a select with its groups
 *  (APEX: Select List); `only` binds the option to a region whose Source names
 *  that source and, when a series list is given, one of those series (a grouped
 *  choice hides the rest, an ungrouped one greys them with the reason; the
 *  parser refuses a stored one); `later` marks one not yet pickable, and why
 *  (drawn disabled, refused by the parser). P2.2's Preset carries all three;
 *  its Timeline view is bound to the results source alone (P2.2 B2). */
export interface ChoiceOption {
  key: string;
  label: string;
  group?: string;
  only?: { source: string; series?: readonly string[] };
  later?: string;
  /** Other attributes the option sets when picked (P2.2 B1: a preset brings its view). Ours; APEX picks a report's
   *  template by hand. The stored values are left alone; the editor applies them with the pick. */
  sets?: Readonly<Record<string, SettingValue>>;
}

export interface AttributeDefinition {
  key: string;
  label: string;
  kind: AttributeKind;
  /** For a choice. */
  options?: readonly ChoiceOption[];
  /** For a number. */
  min?: number;
  max?: number;
  /** For text (and the destination key of a link, at most 120). */
  maxLength?: number;
  default: SettingValue;
  help?: string;
  /** component (absent): one value per instance, on the region. application:
   *  one value for the application, edited under Shared Components › Component
   *  Settings and never stored on a region. report: one value per multi-row
   *  region (none today; drawn as component scope until the data region). */
  scope?: AttributeScope;
  /** A key of the definition's `groups`; absent falls under Settings (APEX:
   *  ungrouped attributes under a generic Settings heading). */
  group?: string;
  /** APEX: Depending On. Drawn in the Attributes tab, and summed up for the
   *  tile, only while the named attribute holds one of the values; a stored
   *  value is read and kept regardless (P2.2 B3: the Card slots and the action
   *  zones while the View is Cards). */
  dependingOn?: { key: string; values: readonly string[] };
  /** A choice whose options are the current preset's shape columns (ours by
   *  name; APEX's Cards list the source's columns for Title Column … Icon
   *  Initials Column). `options` stays empty; '' means the preset's own
   *  mapping; the document parser checks a value against the shape. `regions` (P2.4 PR C): the page's other Data regions,
   *  by id, '' for none; the document parser checks the id against the document. */
  optionsFrom?: 'columns' | 'regions' | 'facets';
  /** A link that may also follow a link column of the row, stored as
   *  `row:<column>` (ours: APEX substitutes a column into a URL; a typed URL is
   *  never allowed here, so the row's own link stands in). */
  rowLinks?: true;
  /** A text that is one condition on a row in the address's words (`position.lte:3`, P2.4): the parser binds it to the
   *  preset's shape as it binds a filter, the editor notes a text that does not read. */
  rule?: true;
}
/** APEX: Attribute Groups, named and sequenced sections of the Attributes tab. */
export interface AttributeGroup {
  key: string;
  title: string;
  seq: number;
}
/** APEX: Plug-in Events, a display name and the internal name a dynamic action
 *  may listen for. Declared here; the first component that fires one wires the
 *  trigger list (P2.23). */
export interface ComponentEvent {
  key: string;
  name: string;
}
/** APEX: the Standard Attributes of a plug-in, each toggling a section of the
 *  Property Editor. Absent reads true. */
export interface ComponentCapabilities {
  /** Appearance › Template and Template Options (false: the component draws its own frame). */
  template?: boolean;
  /** The Header and Footer group. */
  headerFooter?: boolean;
}
/** APEX: Template Component Slots, named nesting points restricted to region
 *  kinds (by name: page-document owns the kinds list). Declared here; the first
 *  component with a slot wires the Layout (P2.2's Card). */
export interface ComponentSlot {
  key: string;
  name: string;
  accepts: readonly string[];
}

export interface ComponentDefinition {
  /** Dotted, lower-case: `page.body`, `data.region`, `region.image`. */
  key: string;
  name: string;
  group: 'Page' | 'Home' | 'Series' | 'Editorial' | 'Data' | 'Region';
  /** One line for the gallery tile and the Property Editor. */
  holds: string;
  /** The attributes (APEX), stored on an instance under `settings`. */
  settings: readonly AttributeDefinition[];
  groups?: readonly AttributeGroup[];
  events?: readonly ComponentEvent[];
  capabilities?: ComponentCapabilities;
  slots?: readonly ComponentSlot[];
  /** The catalogue sources (lib/design/sources.ts) the component may read
   *  (P2.1; APEX: the Source group is a standard part of a region, not a custom
   *  attribute). Absent, it reads none and the Source group holds the Component
   *  row alone. A region carries its pick as `source`, never among the settings. */
  sources?: readonly string[];
  /** The transitional component: a page not yet split holds its body as the
   *  code draws it today, one per page, and loses nothing until it is split. */
  legacy?: true;
}
/** The names before P2.0; every reader of them keeps compiling. */
export type ComponentSpec = ComponentDefinition;
export type ComponentSetting = AttributeDefinition;

export const COMPONENT_KEY = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

/** Lower-case #rrggbb. */
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
/** An icon's name, as the bar's icons are named. */
const ICON_NAME = /^[a-z][a-z0-9-]{0,39}$/;
const LINK_MAX = 120;
const COLUMN_KEY_MAX = 40;

/** The attributes an instance carries: every scope but application. */
export function instanceAttributes(spec: ComponentDefinition): AttributeDefinition[] {
  return spec.settings.filter(s => s.scope !== 'application');
}

/** The Card slots and the action zones show while the View is Cards (APEX: Depending On). */
const CARDS_ONLY = { key: 'view', values: ['cards'] } as const;
/** The views the Interactive Report's controls apply to (P2.3): the templates, the List, the Timeline and the Detail ignore a reader's state. */
const MENU_VIEWS = { key: 'view', values: ['table', 'cards'] } as const;
/** The views the highlight rules style (P2.4): the templates keep their own marks. */
const HIGHLIGHT_VIEWS = { key: 'view', values: ['table', 'cards', 'list'] } as const;
/** Master Detail's views (P2.4 PR C): the Table, the Cards and the List draw a row's Show link; the templates keep their own. */
const DETAIL_VIEWS = { key: 'view', values: ['table', 'cards', 'list'] } as const;
/** A region's id as the document writes it (page-document.ts REGION_ID), repeated here since that module imports this one. */
const REGION_KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** The Filters region's facet slots (P2.5): what Depending On may name. */
const FACET_KEYS = ['facet1', 'facet2', 'facet3'];
const HIGHLIGHT_STYLES = [
  { key: 'brand', label: 'Brand' },
  { key: 'emphasis', label: 'Emphasis' },
  { key: 'muted', label: 'Muted' },
] as const;
/** What a preset's pick sets the Card slots and zones to: its own mapping, nothing linked, the button's plain word. */
const CARD_RESET: Readonly<Record<string, SettingValue>> = { cardTitle: '', cardSubtitle: '', cardBody: '', cardMedia: '', cardBadge: '', actionFullCard: '', actionTitle: '', actionSubtitle: '', actionMedia: '', actionButton: '', actionButtonLabel: 'Open' };

export const COMPONENTS: readonly ComponentDefinition[] = [
  {
    key: 'page.body',
    name: 'Body as the code draws it',
    group: 'Page',
    holds: 'this page’s body exactly as its code writes it today; one per page, until the page is split into components',
    settings: [],
    legacy: true,
  },
  // The page's heading, as the site's mastheads draw it: the row's title or
  // name, or words of the component's own. Every page split after Home starts
  // with it (R4.1).
  {
    key: 'page.heading',
    name: 'Page heading',
    group: 'Page',
    holds: 'the page’s heading in the site’s masthead style: its title, or words of your own',
    settings: [{ key: 'text', label: 'Words', kind: 'text', default: '', maxLength: 120, help: 'Empty shows the page’s title, or its name when it has none.' }],
  },
  // The calendar (R4.1, the first page whose route file left the code): the
  // month-by-month timeline of every session across the series.
  {
    key: 'calendar.month',
    name: 'Calendar',
    group: 'Data',
    holds: 'every session of every series, month by month, in the reader’s local time; the weekend under way on top',
    settings: [],
  },
  // Home's six (R2b) left in P2.24 C: each box is a Data region on its template
  // (lib/design/presets.ts), This weekend the Live band; a stored region naming
  // one is upgraded on read (page-document.ts LEGACY_UPGRADES).
  // The Data region (P2.2; ours by name: APEX has Classic Report, Cards, Content
  // Row, Media List and Timeline as region types, and the operator chose one
  // region with a View setting, 2026-09-10). One region over a source from the
  // catalogue, drawn in one of the site's own named shapes (lib/design/presets.ts).
  // Its attributes are of report scope: one value per multi-row region.
  {
    key: 'data.region',
    name: 'Data region',
    group: 'Data',
    holds: 'a table, cards, a list, a timeline or details over a source from the catalogue, in one of the site’s named shapes, or one of Home’s boxes as a template',
    settings: [
      {
        key: 'preset',
        label: 'Preset',
        kind: 'choice',
        scope: 'report',
        default: 'drivers',
        options: PRESETS.map(p => ({
          key: p.key,
          label: p.name,
          group: PRESET_GROUPS.find(g => g.key === p.group)?.name ?? p.group,
          only: { source: p.source, series: p.series },
          // The pick brings the preset's view, its own rows where the site's box has a count (P2.24 A) and its own card mapping
          // (every slot and zone reset; a results preset aims Full Card at the row's race page, the one link column the results
          // shapes carry).
          sets: { view: p.view, ...(p.rows !== undefined ? { rows: p.rows } : {}), ...CARD_RESET, ...(p.source === 'results' ? { actionFullCard: 'row:race' } : {}) },
        })),
        help: 'Which of the site’s tables this region draws (APEX: a report’s template and its columns; ours: the fifteen shapes as named presets, and Home’s boxes). The list follows the Source: its presets, grouped as the site groups them.',
      },
      {
        key: 'view',
        label: 'View',
        kind: 'choice',
        scope: 'report',
        default: 'table',
        options: [
          { key: 'table', label: 'Table' },
          { key: 'cards', label: 'Cards' },
          { key: 'list', label: 'List' },
          // Timeline stands on a date: the results rows carry the race's, the standings rows none (P2.2 B2).
          { key: 'timeline', label: 'Timeline', only: { source: 'results' } },
          { key: 'detail', label: 'Detail' },
          // Home's boxes as templates (P2.24 A; APEX: a custom report template joins the theme's in the same list), each bound
          // to the source whose rows it reads.
          { key: 'lead-story', label: 'Lead story', only: { source: 'posts' } },
          { key: 'wire', label: 'The wire', only: { source: 'news' } },
          { key: 'coming-weekends', label: "What's next", only: { source: 'weekends' } },
          // Home's Latest result and What it changed (P2.24 B2): each drawn on its own shape (the podium rows, the driver rows); the
          // renderer draws the Table for a stored one on another shape of the source.
          { key: 'podium', label: 'Latest result', only: { source: 'results' } },
          { key: 'leader', label: 'What it changed', only: { source: 'standings' } },
        ],
        help: 'How the rows are drawn (APEX: a report’s Template; ours: one region with a View setting). List is the Rounds layout for results, a round per fold, and a compact list for standings. Timeline (APEX’s Timeline template) draws a race per entry on a rail with its date, its winner and the winner’s initials; results only, since a standings row has no date. Detail (APEX’s Value Attribute Pairs - Column) draws a block per row with its columns as label and value; it suits small row counts. Lead story (posts), The wire (news), What’s next (weekends), Latest result (results) and What it changed (standings) are Home’s boxes as templates: the lead with its cover, its age and its further reading; the headlines linked out with their source and age; the coming weekends, the nearest first with its countdown; the newest race’s headline, margin and podium; the championship after it, the leader’s headline and the table with the winner’s row marked; each brings its rows. A preset brings its own view when picked.',
      },
      { key: 'rows', label: 'Rows', kind: 'number', scope: 'report', default: 10, min: 1, max: 50, help: 'How many rows the region shows, from the top of the table; for results, how many races, newest first, each whole; for the Lead story, the lead and its further reading.' },
      { key: 'heading', label: 'Heading', kind: 'text', scope: 'report', default: '', maxLength: 80, help: 'The heading above the rows; empty draws the preset’s name. The Lead story writes it in its eyebrow, The wire in its rule.' },
      // The Lead story's pin (P2.24 A; the words of home.lead's), drawn while the View is Lead story.
      {
        key: 'pinned',
        label: 'Pinned post',
        kind: 'text',
        scope: 'report',
        default: '',
        maxLength: 120,
        dependingOn: { key: 'view', values: ['lead-story'] },
        help: 'The slug of a post to lead with, from its address (/blog/<slug>), among the rows the Source reads (its Count; raise it for an older post). Empty leads with the newest.',
      },
      // The Card slots (P2.2 B3; APEX Cards: Title Column, Subtitle Column, Body Column, Icon Initials Column, Badge Column),
      // drawn while the View is Cards; '' is the preset's own mapping.
      ...(
        [
          ['cardTitle', 'Title', 'The column the card is headed by (APEX: Title Column); the preset’s own is the driver’s or team’s name.'],
          ['cardSubtitle', 'Subtitle', 'The line under the title (APEX: Subtitle Column); the preset’s own is the team.'],
          ['cardBody', 'Body', 'The figure at the top right (APEX: Body Column); the preset’s own is the points, or the gap on a timing export.'],
          ['cardMedia', 'Media', 'The column at the top left (APEX: Icon Initials Column, or the Media source): a picture column draws the picture, any other the initials of its text. A number column shows its first digit, which reads badly.'],
          ['cardBadge', 'Badge', 'The small figure at the top left (APEX: Badge Column); the preset’s own is the position, or the car’s number.'],
        ] as const
      ).map(([key, label, help]) => ({ key, label, kind: 'choice' as const, scope: 'report' as const, group: 'card', dependingOn: CARDS_ONLY, optionsFrom: 'columns' as const, default: '', help })),
      // The five action zones (APEX Cards › Actions: Full Card, Title, Subtitle, Media, Button): each a destination as a Button’s
      // Target is, or a link column of the row (`row:<column>`, the race’s weekend page on a results shape).
      ...(
        [
          ['actionFullCard', 'Full Card', 'Where the whole card goes (APEX: the Full Card action). Set, it is the card’s one link and the other zones stand down: no link inside a link.'],
          ['actionTitle', 'Title action', 'Where the title goes (APEX: the Title action), while Full Card is Nowhere.'],
          ['actionSubtitle', 'Subtitle action', 'Where the subtitle goes (APEX: the Subtitle action), while Full Card is Nowhere.'],
          ['actionMedia', 'Media action', 'Where the avatar goes (APEX: the Media action), while Full Card is Nowhere and a Media column is picked.'],
          ['actionButton', 'Button', 'A button at the card’s foot and where it goes (APEX: the Button action), while Full Card is Nowhere.'],
        ] as const
      ).map(([key, label, help]) => ({ key, label, kind: 'link' as const, scope: 'report' as const, group: 'actions', dependingOn: CARDS_ONLY, rowLinks: true as const, default: '', help })),
      { key: 'actionButtonLabel', label: 'Button label', kind: 'text', scope: 'report', group: 'actions', dependingOn: CARDS_ONLY, default: 'Open', maxLength: 24, help: 'The words on the card’s button.' },
      // P2.3: the Interactive Report's controls (APEX: Attributes › Actions Menu), off on every region until the designer turns
      // them on; they work on a page the catch-all serves from its rows (a framed code route hands no state), for the Table
      // and the Cards. The tile names them only when on (a dependingOn attribute at its default is silent).
      { key: 'sortable', label: 'Sortable headings', kind: 'boolean', scope: 'report', group: 'menu', dependingOn: MENU_VIEWS, default: false, help: 'Each heading a link sorting the rows by its column: ascending, then descending, then as designed (APEX: the column heading menu’s Sort). Works on a page served from its rows; the address carries the sort.' },
      { key: 'actions', label: 'Actions menu', kind: 'boolean', scope: 'report', group: 'menu', dependingOn: MENU_VIEWS, default: false, help: 'The Actions menu above the rows (APEX: the Interactive Report’s Actions menu): Select Columns and Reset for a Table, Sort by and Reset for Cards, Download CSV when it is on; the Views menu stands beside it. Works on a page served from its rows.' },
      // PR B: the saved views (APEX: the saved reports' tiers, the designer-authored ones) and the download from the source.
      { key: 'views', label: 'Saved views', kind: 'boolean', scope: 'report', group: 'menu', dependingOn: MENU_VIEWS, default: false, help: 'A Views menu beside Actions listing Primary (the region as designed) and the Alternatives saved under Shared Components › Saved Views; a reader picks one and shares its link (?view=<key>). Works on a page served from its rows.' },
      { key: 'download', label: 'Download CSV', kind: 'boolean', scope: 'report', group: 'menu', dependingOn: MENU_VIEWS, default: false, help: 'Download CSV in the Actions menu: the rows as sorted, filtered and columned, read from the source (never the screen), at most 5000. Works on a page served from its rows.' },
      // P2.4: the highlight rules (APEX: an Interactive Report's Highlight) — three conditions on a row in the address's words,
      // a style each, the first a row meets styling it; and the followed-series tint the browser adds after the page loads.
      ...([1, 2, 3] as const).flatMap(n => [
        { key: `highlight${n}`, label: `Highlight ${n}`, kind: 'text' as const, scope: 'report' as const, group: 'highlight', dependingOn: HIGHLIGHT_VIEWS, rule: true as const, default: '', maxLength: 120, help: 'A condition on the row in the address’s words — position.eq:1, position.lte:3, points.gte:100, team.eq:Mercedes. The first rule a row meets styles it.' },
        { key: `highlight${n}Style`, label: `Highlight ${n} style`, kind: 'choice' as const, scope: 'report' as const, group: 'highlight', dependingOn: HIGHLIGHT_VIEWS, options: HIGHLIGHT_STYLES, default: 'brand', help: 'Brand is the leader’s tint; Emphasis raises the row on the elevated surface; Muted fades it.' },
      ]),
      { key: 'highlightFollowed', label: 'Followed series', kind: 'boolean', scope: 'report', group: 'highlight', dependingOn: HIGHLIGHT_VIEWS, default: false, help: 'Tint the rows of the series the reader follows, in the browser after the page loads; the page stays the same for everyone. Rows without a series, as a one-series standings table, stay as they are.' },
      // P2.4 PR C: Master Detail (APEX's name): this region's rows filter another Data region of the page through the address,
      // by a column both carry; the page stays cached and the choice can be shared.
      { key: 'detailRegion', label: 'Detail region', kind: 'choice', scope: 'report', group: 'detail', dependingOn: DETAIL_VIEWS, optionsFrom: 'regions', default: '', help: 'Another Data region of this page that this region’s rows filter: each row gets a Show link writing its value into that region’s filter, in the address, so the page stays cached and the link can be shared.' },
      { key: 'detailKey', label: 'Detail key', kind: 'choice', scope: 'report', group: 'detail', dependingOn: DETAIL_VIEWS, optionsFrom: 'columns', default: '', help: 'The column whose value filters the detail region, one both regions carry, such as the round.' },
    ],
    groups: [
      { key: 'card', title: 'Card', seq: 10 },
      { key: 'actions', title: 'Actions', seq: 20 },
      { key: 'menu', title: 'Actions Menu', seq: 30 },
      { key: 'highlight', title: 'Highlight', seq: 40 },
      { key: 'detail', title: 'Master Detail', seq: 50 },
    ],
    sources: ['standings', 'results', 'posts', 'news', 'weekends', 'session-results'],
  },
  // Filters (P2.5; APEX: Smart Filters, the chips above a report): a panel over another Data region of the page, its facets
  // that region's columns, each value a link that narrows the rows through the address (one `in` filter per facet under the
  // region's own keys), one facet waiting on another (APEX: Depending On), a facet set to pick several a form with Apply.
  // It reads no source of its own: the region it filters reads, once, for both.
  {
    key: 'data.filters',
    name: 'Filters',
    group: 'Data',
    holds: 'a filter panel over another Data region’s rows: facets from its columns, one narrowing another, applied at a tap or several at once',
    settings: [
      { key: 'filteredRegion', label: 'Filtered region', kind: 'choice', scope: 'report', group: 'facets', optionsFrom: 'regions', default: '', help: 'The Data region of this page whose rows the facets narrow (APEX: Smart Filters › Filtered Region); a Table, Cards or List.' },
      ...([1, 2, 3] as const).flatMap(n => [
        { key: `facet${n}`, label: `Facet ${n}`, kind: 'choice' as const, scope: 'report' as const, group: 'facets', optionsFrom: 'columns' as const, default: '', help: 'A column of the filtered region whose values become this facet’s chips (APEX: a filter’s column). The address carries a facet’s picks in at most 80 characters; picks beyond that are dropped when the page is read.' },
        { key: `facet${n}Label`, label: `Facet ${n} label`, kind: 'text' as const, scope: 'report' as const, group: 'facets', default: '', maxLength: 40, help: 'The chip’s name; empty draws the column’s own label.' },
        { key: `facet${n}DependsOn`, label: `Facet ${n} depends on`, kind: 'choice' as const, scope: 'report' as const, group: 'facets', optionsFrom: 'facets' as const, default: '', help: 'The facet this one waits for (APEX: Depending On): closed until that one carries a value, its own values narrowed by it.' },
        { key: `facet${n}Several`, label: `Facet ${n} picks several`, kind: 'boolean' as const, scope: 'report' as const, group: 'facets', default: false, help: 'Tick several values and Apply once; off, each value is a link that applies at a tap and stays for the next.' },
      ]),
    ],
    groups: [{ key: 'facets', title: 'Facets', seq: 10 }],
  },
  // The Live band (P2.9; ours by name: APEX has no live band, a domain piece the site draws on Home as This weekend, whose
  // renderer is the band's first instance). It reads the content bundle through the home model as Home's pieces do, never
  // a query: the band's data is nested (the next session, the same-day sessions), which the catalogue's flat rows cannot
  // carry, and the home model is the one fact the race-weekend condition reads too.
  {
    key: 'series.live',
    name: 'Live band',
    group: 'Series',
    holds: 'the weekends under way: a box for the lead series and the majors with the next session and its countdown, one row for the rest',
    settings: [
      {
        key: 'series',
        label: 'Series',
        kind: 'choice',
        default: '',
        options: [{ key: '', label: 'Every series', group: 'Series' }, ...SERIES_OPTIONS.map(o => ({ key: o.key, label: o.label, group: 'Series' }))],
        help: 'Every series, ranked as Home ranks them: the lead series first, then the majors, the rest in the Also racing row (the Application Settings home.lead_series and home.major_series); or one series’ weekend alone, boxed whether Home ranks it or not.',
      },
      { key: 'also', label: 'Also racing', kind: 'boolean', default: true, help: 'The row of the other weekends under way, beneath the boxes; nothing when one series is picked.' },
    ],
  },
];

/** One entry of a page's recipe (P2.24 C): the component, the region's id, the settings that differ from the
 *  component's defaults, its Source, and whether it is one of two halves sharing a row. A bare key is the shorthand
 *  for a component at its defaults, its id the key's last word. */
export interface RecipeEntry {
  id: string;
  component: string;
  settings?: Readonly<Record<string, SettingValue>>;
  source?: string;
  /** Two consecutive halves share one row, the second at column 7. */
  half?: true;
}

/** How a page not yet split becomes components: the entries that replace its
 *  transitional body, in order. Only pages whose components exist appear here.
 *  For a page whose route file has left the code, this is also its default
 *  composition when nothing is published. Home's (P2.24 C): its boxes as Data
 *  regions on their templates over the catalogue's sources (Home's own counts as
 *  their Rows), and the Live band as This weekend's instance (P2.9); the region
 *  ids are the words the site used. */
export const SPLITS: Readonly<Record<string, readonly (string | RecipeEntry)[]>> = {
  '/': [
    { id: 'lead', component: 'data.region', settings: { preset: 'lead-story', view: 'lead-story', rows: 4 }, source: 'posts?count=10' },
    { id: 'live', component: 'series.live' },
    { id: 'result', component: 'data.region', settings: { preset: 'latest-result', view: 'podium', rows: 3 }, source: `results?series=home&season=${CURRENT_SEASON}` },
    { id: 'changed', component: 'data.region', settings: { preset: 'what-it-changed', view: 'leader', rows: 5 }, source: `standings?series=latest&season=${CURRENT_SEASON}`, half: true },
    { id: 'next', component: 'data.region', settings: { preset: 'whats-next', view: 'coming-weekends', rows: 3 }, source: 'weekends?count=10', half: true },
    { id: 'wire', component: 'data.region', settings: { preset: 'wire', view: 'wire', rows: 5 }, source: 'news?per=3' },
  ],
  '/calendar': ['page.heading', 'calendar.month'],
};

/** A region of the document model for a component, as the recipes lay them out. */
export interface RecipeRegion {
  id: string;
  kind: 'component';
  component: string;
  settings: Record<string, SettingValue>;
  source?: string;
  title: string;
  position: 'body';
  seq: number;
  column: number;
  span: number;
  newRow: boolean;
  authz: string | null;
  hidden: boolean;
}

/** `base`, or the first of `base-2`, `base-3`… not yet taken. */
function uniqueId(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** A fresh id for a component: the key's last word (`data.region` → `region`, then `region-2`); `code-body` for the transitional one. */
export function componentId(key: string, taken: readonly string[]): string {
  return uniqueId(key === 'page.body' ? 'code-body' : (key.split('.').pop() ?? 'component').replace(/[^a-z0-9-]/g, '-'), taken);
}

/** The recipe's components as Body regions, in order, renumbered by tens from
 *  `seqFrom`; two consecutive halves share one row. Empty for a path without a recipe. */
export function recipeRegions(path: string, taken: readonly string[] = [], seqFrom = 10, components: readonly ComponentDefinition[] = COMPONENTS): RecipeRegion[] {
  const recipe = SPLITS[path];
  if (!recipe) return [];
  const out: RecipeRegion[] = [];
  let seq = seqFrom;
  let halves = 0;
  for (const item of recipe) {
    const entry: RecipeEntry = typeof item === 'string' ? { id: componentId(item, []), component: item } : item;
    const spec = findComponent(entry.component, components);
    if (!spec) continue;
    const second = entry.half === true && halves % 2 === 1;
    if (entry.half) halves++;
    out.push({
      id: uniqueId(entry.id, [...taken, ...out.map(r => r.id)]),
      kind: 'component',
      component: entry.component,
      settings: { ...componentDefaults(spec), ...entry.settings },
      ...(entry.source ? { source: entry.source } : {}),
      title: '',
      position: 'body',
      seq,
      column: second ? 7 : 1,
      span: entry.half ? 6 : 12,
      newRow: !second,
      authz: null,
      hidden: false,
    });
    seq += 10;
  }
  return out;
}

/** A page's default composition: the recipe as a document, nothing else. */
export function defaultDocument(path: string): { version: 1; regions: RecipeRegion[]; actions: never[] } {
  return { version: 1, regions: recipeRegions(path), actions: [] };
}

/** A definition by key, from the code's list or the one handed in (the
 *  designer's, the merged one once definitions have rows). */
export function findComponent(key: string, components: readonly ComponentDefinition[] = COMPONENTS): ComponentDefinition | null {
  return components.find(c => c.key === key) ?? null;
}

/** Every attribute an instance carries, at its default. */
export function componentDefaults(spec: ComponentDefinition): Record<string, SettingValue> {
  return Object.fromEntries(instanceAttributes(spec).map(s => [s.key, s.default]));
}

/**
 * Read a stored settings object against the definition: a missing attribute
 * takes its default, an unknown key or a value outside its rule is a problem
 * (and the default stands in); an application-scope attribute has no home on
 * an instance. Always answers a full settings object.
 */
export function parseSettings(spec: ComponentDefinition, raw: unknown): { settings: Record<string, SettingValue>; problems: string[] } {
  const problems: string[] = [];
  const settings = componentDefaults(spec);
  if (raw === undefined || raw === null) return { settings, problems };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { settings, problems: ['the settings must be an object'] };
  const given = raw as Record<string, unknown>;
  for (const key of Object.keys(given)) {
    const s = spec.settings.find(x => x.key === key);
    if (!s) problems.push(`${spec.name} has no setting called ${key}`);
    else if (s.scope === 'application') problems.push(`${s.label} is set for the application, not on a region`);
  }
  for (const s of instanceAttributes(spec)) {
    const v = given[s.key];
    if (v === undefined) continue;
    if (s.kind === 'boolean') {
      if (typeof v === 'boolean') settings[s.key] = v;
      else problems.push(`${s.label} must be yes or no`);
    } else if (s.kind === 'number') {
      if (typeof v === 'number' && Number.isFinite(v) && (s.min === undefined || v >= s.min) && (s.max === undefined || v <= s.max)) settings[s.key] = v;
      else problems.push(`${s.label} must be a number${s.min !== undefined && s.max !== undefined ? ` from ${s.min} to ${s.max}` : ''}`);
    } else if (s.kind === 'choice' && s.optionsFrom === 'columns') {
      // The column's key alone here; whether the preset's shape has it is the document parser's rule (P2.2 B3).
      if (typeof v === 'string' && v.length <= COLUMN_KEY_MAX) settings[s.key] = v;
      else problems.push(`${s.label} must name a column of at most ${COLUMN_KEY_MAX} characters`);
    } else if (s.kind === 'choice' && s.optionsFrom === 'regions') {
      // A region's id alone here (P2.4 PR C); whether the document holds that Data region is the document parser's rule.
      if (typeof v === 'string' && (v === '' || REGION_KEY.test(v))) settings[s.key] = v;
      else problems.push(`${s.label} must name a region of the page: lower-case letters, digits and dashes`);
    } else if (s.kind === 'choice' && s.optionsFrom === 'facets') {
      // Another facet of the same region (P2.5; APEX: Depending On), never itself; whether that facet is set is the renderer's concern.
      if (typeof v === 'string' && (v === '' || (FACET_KEYS.includes(v) && v !== s.key.replace(/DependsOn$/, '')))) settings[s.key] = v;
      else problems.push(`${s.label} must name another facet`);
    } else if (s.kind === 'choice') {
      if (typeof v === 'string' && s.options?.some(o => o.key === v)) settings[s.key] = v;
      else problems.push(`${s.label} must be one of ${(s.options ?? []).map(o => o.label).join(', ')}`);
    } else if (s.kind === 'colour') {
      if (typeof v === 'string' && HEX_COLOUR.test(v)) settings[s.key] = v.toLowerCase();
      else problems.push(`${s.label} must be a colour as #rrggbb`);
    } else if (s.kind === 'icon') {
      if (typeof v === 'string' && (v === '' || ICON_NAME.test(v))) settings[s.key] = v;
      else problems.push(`${s.label} must be an icon name: lower-case letters, digits and dashes`);
    } else if (s.kind === 'link') {
      // The key's shape only; whether it names a page or a catalogue link is the document parser's rule (isGoDestination).
      if (typeof v === 'string' && v.length <= LINK_MAX) settings[s.key] = v;
      else problems.push(`${s.label} must name a destination of at most ${LINK_MAX} characters`);
    } else if (typeof v === 'string' && v.length <= (s.maxLength ?? 200)) settings[s.key] = v;
    else problems.push(`${s.label} must be text of at most ${s.maxLength ?? 200} characters`);
  }
  return { settings, problems };
}

/** The preset's shape a region's settings name, for the words about its columns (P2.2 B3). */
const shapeOf = (settings: Readonly<Record<string, SettingValue>>) => {
  const preset = findPreset(String(settings.preset ?? ''));
  return preset ? SHAPES[preset.shape] : null;
};

/** One line about an instance's attributes, for its tile: `Items 8 · Series All`; an empty text says nothing. An attribute
 *  depending on another (P2.2 B3) is named only while its condition holds and its value is not its default; a column by its
 *  label, a row link by its page. */
export function settingsSummary(spec: ComponentDefinition, settings: Readonly<Record<string, SettingValue>>): string {
  const shape = shapeOf(settings);
  const parts = instanceAttributes(spec).flatMap(s => {
    const v = settings[s.key] ?? s.default;
    if (s.kind === 'text' && String(v).trim() === '') return [];
    // A region, a column or a facet not named says nothing (P2.5), nor does a grouped switch at its default: the tile names what is set.
    if (s.optionsFrom && v === '') return [];
    if (s.kind === 'boolean' && s.group && v === s.default) return [];
    if (s.dependingOn) {
      const on = settings[s.dependingOn.key] ?? spec.settings.find(x => x.key === s.dependingOn!.key)?.default;
      if (!s.dependingOn.values.includes(String(on)) || v === '' || v === s.default) return [];
    }
    const column = (key: string) => shape?.columns.find(c => c.key === key)?.label ?? key;
    const shown =
      s.kind === 'boolean'
        ? v
          ? 'yes'
          : 'no'
        : s.kind === 'choice'
          ? s.optionsFrom === 'columns'
            ? column(String(v))
            : (s.options?.find(o => o.key === v)?.label ?? String(v))
          : s.kind === 'icon'
            ? String(v) || 'none'
            : s.kind === 'link'
              ? String(v).startsWith('row:')
                ? `${column(String(v).slice(4))} → its page`
                : String(v) || 'nowhere'
              : String(v);
    return `${s.label} ${shown}`;
  });
  return parts.length ? parts.join(' · ') : spec.holds;
}
