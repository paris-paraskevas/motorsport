'use client';

import Image from 'next/image';
import {
  BUTTON_LABEL_MAX,
  COLUMNS,
  IMAGE_ALT_MAX,
  REGION_KIND_LABELS,
  REGION_TEXT_MAX,
  REGION_TITLE_MAX,
  SHOW_RULES,
  SHOW_RULE_LABELS,
  STATIC_TEXT_MAX,
  TIMER_MAX_SECONDS,
  TIMER_MIN_SECONDS,
  ACTION_NAME_MAX,
  rowsAt,
  type DynamicAction,
  type Effect,
  type EffectAction,
  type PageDocument,
  type Position,
  type Region,
  type RegionKind,
  type TriggerEvent,
} from '@/lib/design/page-document';
import { SITE_URL } from '@/lib/site';
import { findComponent, type SettingValue } from '@/lib/design/components';
import { PAGE_COMMENTS_MAX, PAGE_GROUPS, PAGE_GROUP_LABELS, type PageGroup } from '@/lib/design/page-registry';
import { PAGE_NAME_MAX, PAGE_TITLE_MAX, isLegacyBody } from '@/lib/design/page-document';
import type { PageRow } from '@/lib/design/pages';
import type { EditableAsset } from '@/lib/design/assets';
import type { EditableShortcut } from '@/lib/design/shortcuts';
import { BUILD_OPTION_DEFAULTS, BUILD_OPTION_KEYS, type BuildOptionKey, type BuildOptionStatus } from '@/lib/design/build-option-defaults';
import { FIELD, PBTN, Pills, Ro, TEXTAREA, YesNo, type PropGroup } from './PropertyPane';
import {
  PD_POSITION,
  SPAN_CHOICES,
  actionName,
  destinationLabel,
  effectFor,
  goOptions,
  openPositions,
  regionName,
  sharedOf,
  spanName,
  splitRecipe,
  systemSteps,
  triggerFor,
  type Selection,
} from './page-designer-model';

// The Property Editor's groups for whatever is selected (Paddock Designer v2.4,
// renderPE): the page (Identification, Appearance, Navigation Menu, Head, Page
// CSS, Security, Advanced), a region (Identification, Source, Layout,
// Appearance, Header and Footer, Server-side Condition, Security,
// Configuration, Advanced), a
// dynamic action, one of its effects, a position, a shared component's tile, a
// system step. Groups the document has no data for yet are shown folded and
// labelled later (the operator's call, 2026-09-08); the labels are the
// prototype's, and the help under each is read at the foot of the pane.

/** A page's attributes as edited: the row's five plus comments. */
export interface AttrsDraft {
  name: string;
  title: string;
  group: PageGroup;
  authz: string;
  indexable: boolean;
  comments: string;
}

export function attrsOf(page: PageRow): AttrsDraft {
  return {
    name: page.name,
    title: page.title ?? '',
    group: page.group ?? 'editorial',
    authz: page.authz && page.authz !== 'public' ? page.authz : 'public',
    indexable: page.indexable,
    comments: page.comments ?? '',
  };
}

/** Why the attributes cannot be saved, or null. */
export function attrsProblem(d: AttrsDraft): string | null {
  if (!d.name.trim()) return 'the page needs a name';
  if (d.name.length > PAGE_NAME_MAX) return `a name is at most ${PAGE_NAME_MAX} characters`;
  if (d.title.length > PAGE_TITLE_MAX) return `a title is at most ${PAGE_TITLE_MAX} characters`;
  if (d.comments.length > PAGE_COMMENTS_MAX) return `comments are at most ${PAGE_COMMENTS_MAX} characters`;
  return null;
}

export interface PropsContext {
  page: PageRow;
  doc: PageDocument;
  readOnly: boolean;
  schemes: { key: string; label: string; type: string }[];
  assets: EditableAsset[];
  lists: { key: string; label: string }[];
  shortcuts: EditableShortcut[];
  /** The Build Options' statuses by key, for the Configuration group's labels; a key missing here reads as Include. */
  buildOptions: Readonly<Partial<Record<BuildOptionKey, BuildOptionStatus>>>;
  /** The shared lists' entry counts, for the Navigation Menu group. */
  shared: Record<'doors' | 'footer' | 'bar', string>;
  attrs: AttrsDraft;
  setAttrs: (fn: (d: AttrsDraft) => AttrsDraft) => void;
  /** A document change, committed to the history with a status line. */
  commit: (next: PageDocument, label: string) => void;
  select: (sel: Selection) => void;
  /** Opens a Shared Components entry in its workspace, in the app. */
  openShared: (sc: string) => void;
  act: {
    addRegion: (kind: RegionKind, position: Position) => void;
    /** A component from the catalogue, by key, at a position. */
    addComponent: (key: string, position: Position) => void;
    /** The transitional body gives way to the page's components (SPLITS). */
    splitBody: () => void;
    duplicate: (id: string) => void;
    move: (id: string, dir: -1 | 1) => void;
    remove: (id: string) => void;
    removeAction: (id: string) => void;
    addEffect: (actionId: string) => void;
    removeEffect: (actionId: string, index: number) => void;
    insertShortcut: (regionId: string, key: string) => void;
  };
  /** Stable ids for the fields, so the designer can focus the name (`rname`) and read the text cursor (`text`). */
  fieldId: (name: string) => string;
}

const AUTHZ_HELP = 'Who may see the component. Schemes are defined once under Shared Components → Security.';
const LATER = (title: string): PropGroup => ({ title, props: [], later: true });

function patch(ctx: PropsContext, id: string, label: string, fn: (r: Region) => Region) {
  ctx.commit({ ...ctx.doc, regions: ctx.doc.regions.map(r => (r.id === id ? fn(r) : r)) }, label);
}
/** Header Text or Footer Text as typed; an empty field leaves the attribute out, as the parser does. */
function textAttr(r: Region, key: 'headerText' | 'footerText', value: string): Region {
  const next: Region = { ...r };
  delete next[key];
  return value === '' ? next : { ...next, [key]: value };
}

function patchAction(ctx: PropsContext, id: string, label: string, fn: (a: DynamicAction) => DynamicAction) {
  ctx.commit({ ...ctx.doc, actions: ctx.doc.actions.map(a => (a.id === id ? fn(a) : a)) }, label);
}

function MiniMap({ doc, id }: { doc: PageDocument; id: string }) {
  const rows = rowsAt(doc, 'body');
  return (
    <div className="grid grid-cols-12 gap-px border border-border-strong bg-bg p-1" aria-hidden="true">
      {rows.map((row, ri) =>
        row.map(r => (
          <span
            key={r.id}
            className={`min-h-4 truncate border px-0.5 font-mono text-[7px] uppercase tracking-[0.04em] ${r.id === id ? 'border-edit bg-edit-dim text-text' : 'border-border bg-surface-elevated text-text-faint'}`}
            style={{ gridColumn: `${r.column} / span ${r.span}`, gridRow: ri + 1 }}
          >
            {regionName(r)}
          </span>
        )),
      )}
    </div>
  );
}

export function pageGroups(ctx: PropsContext): { head: { kind: string; name: string }; groups: PropGroup[] } {
  const { page, attrs, setAttrs, readOnly, schemes, fieldId } = ctx;
  const number = page.id ? page.id.slice(0, 8) : 'no row';
  const chosen = schemes.find(o => o.key === attrs.authz);
  const requiresAuth = Boolean(chosen && chosen.type !== 'public');
  const set = (fn: (d: AttrsDraft) => AttrsDraft) => setAttrs(fn);
  const groups: PropGroup[] = [
    {
      title: 'Identification',
      props: [
        { label: 'Page Number', common: true, control: <Ro dim>{number}</Ro>, note: 'Pages are numbered by their row id.', help: 'Pages are numbered by their row id; the site has no other numbering.' },
        {
          label: 'Name',
          common: true,
          htmlFor: fieldId('name'),
          control: (
            <input
              id={fieldId('name')}
              type="text"
              value={attrs.name}
              maxLength={PAGE_NAME_MAX}
              disabled={readOnly}
              aria-label="Page name"
              className={FIELD}
              onChange={e => set(d => ({ ...d, name: e.target.value }))}
            />
          ),
          help: 'How the page is called in the App Builder: the list, the tree, the crumb. Readers never see it.',
        },
        {
          label: 'Page Alias',
          common: true,
          control: <Ro>{page.path}</Ro>,
          note:
            page.kind === 'code' && page.served !== 'rows'
              ? 'The route file is still in the code; the path stays until the page is fully composed.'
              : page.kind === 'code'
                ? 'Served from its row by the site; the path stays until the page leaves the code’s registry.'
                : 'A path of your own, served from the published revision.',
          help: 'The address. A page keeps its address; a new address is a new page.',
        },
        {
          label: 'Page Group',
          common: true,
          control: (
            <Pills label="Page group" items={PAGE_GROUPS.map(g => ({ key: g, label: PAGE_GROUP_LABELS[g] }))} current={attrs.group} disabled={readOnly} onPick={g => set(d => ({ ...d, group: g }))} />
          ),
          help: 'How the App Builder home groups pages. Purely organisational.',
        },
        {
          label: 'Title',
          common: true,
          htmlFor: fieldId('title'),
          control: (
            <input
              id={fieldId('title')}
              type="text"
              value={attrs.title}
              maxLength={PAGE_TITLE_MAX}
              disabled={readOnly}
              aria-label="Page title"
              placeholder={page.name}
              className={FIELD}
              onChange={e => set(d => ({ ...d, title: e.target.value }))}
            />
          ),
          note: 'Browser tab and search result title.',
          help: 'Shown in the browser tab, the search result and the shared-link card. Empty keeps the title the page carries itself.',
        },
      ],
    },
    {
      title: 'Appearance',
      closed: true,
      props: [
        { label: 'Page Mode', common: true, control: <Ro dim>Normal</Ro>, help: 'Normal renders as a page. Modal dialogs arrive with a later step.' },
        {
          label: 'Page Template',
          common: true,
          control: <Ro dim>Paddock Standard</Ro>,
          note: 'The one template the app ships: header, page header, body, right side column, footer, phone bar.',
          help: 'The template decides the positions a page has. There is one, and it is code.',
        },
        { label: 'Template Options', control: <Ro dim>Arrives with a later step.</Ro> },
      ],
    },
    {
      title: 'Navigation Menu',
      closed: true,
      props: [
        {
          label: 'Override User Interface Level',
          common: true,
          control: <Ro dim>No</Ro>,
          note: 'Pages share the application’s menus; there is no per-page menu, by design.',
          help: 'Every page shows the same Navigation Menu, edited once under Shared Components.',
        },
        { label: 'List', common: true, control: <Ro>Navigation Menu · Doors ({ctx.shared.doors})</Ro> },
        { label: 'List Position', control: <Ro dim>Header on desktop and laptop · Navigation Bar on phones</Ro> },
        {
          label: 'Edit',
          common: true,
          control: (
            <button type="button" className={`${PBTN} justify-self-start`} onClick={() => ctx.openShared('doors')}>
              Edit in Shared Components
            </button>
          ),
        },
      ],
    },
    {
      title: 'Head',
      closed: true,
      props: [
        { label: 'Title tag', control: <Ro dim>{attrs.title.trim() || page.name}</Ro>, help: 'What the browser tab shows: the Title, or the name when the title is empty.' },
        { label: 'Social image', control: <Ro dim>Arrives with a later step.</Ro> },
      ],
    },
    LATER('Page CSS'),
    {
      title: 'Security',
      props: [
        {
          label: 'Authorization Scheme',
          common: true,
          control: <Pills label="Page authorization" items={schemes.map(o => ({ key: o.key, label: o.label }))} current={attrs.authz} disabled={readOnly} onPick={key => set(d => ({ ...d, authz: key }))} />,
          help: AUTHZ_HELP,
        },
        {
          label: 'Page Requires Authentication',
          common: true,
          control: <Ro dim>{requiresAuth ? 'Yes' : 'No · public with account'}</Ro>,
          help: 'Yes when the scheme asks for a session; then the page renders per visit.',
        },
        { label: 'Deep Linking', control: <Ro dim>Yes</Ro>, help: 'Every page may be opened straight from a link.' },
        { label: 'Rate Limit Profile', control: <Ro dim>Arrives with a later step.</Ro> },
      ],
    },
    {
      title: 'Advanced',
      props: [
        {
          label: 'Rendering',
          common: true,
          control: <Ro dim>{page.rendering === 'dynamic' ? 'Each visit' : 'Cached'}</Ro>,
          note: page.kind === 'code' ? 'The code decides; it changes with a deploy.' : 'Stored on the row; not honoured yet for pages made here.',
          help: 'Cached pages are rendered ahead and refreshed; each-visit pages render per request.',
        },
        {
          label: 'Indexed',
          common: true,
          control: <YesNo label="Search engines may index this page" value={attrs.indexable} disabled={readOnly} onPick={v => set(d => ({ ...d, indexable: v }))} />,
          note: 'Off adds noindex, follow. On leaves the rule the page carries itself.',
          help: 'Off tells search engines noindex, follow. On leaves the rule the page carries itself.',
        },
        {
          label: 'Comments',
          htmlFor: fieldId('comments'),
          control: (
            <textarea
              id={fieldId('comments')}
              value={attrs.comments}
              maxLength={PAGE_COMMENTS_MAX}
              disabled={readOnly}
              aria-label="Page comments"
              placeholder="Notes for the two of you. Never rendered."
              className={TEXTAREA}
              onChange={e => set(d => ({ ...d, comments: e.target.value }))}
            />
          ),
          help: 'Notes for the two of you. Never rendered.',
        },
        {
          label: 'Actions',
          common: true,
          control: (
            <div className="flex flex-wrap gap-1">
              {!page.path.includes('[') && (
                <a href={`${SITE_URL}${page.path}`} target="_blank" rel="noopener noreferrer" className={PBTN}>
                  Open the page
                </a>
              )}
            </div>
          ),
        },
      ],
    },
  ];
  return { head: { kind: 'Page', name: `${number}: ${attrs.name.trim() || page.name}` }, groups };
}

export function regionGroups(ctx: PropsContext, r: Region): { head: { kind: string; name: string }; groups: PropGroup[] } {
  const { doc, readOnly, schemes, assets, lists, shortcuts, buildOptions, act, fieldId } = ctx;
  const K = REGION_KIND_LABELS[r.kind];
  const siblings = doc.regions.filter(x => x.position === r.position);
  const index = siblings.findIndex(x => x.id === r.id);
  const p = (label: string, fn: (x: Region) => Region) => patch(ctx, r.id, label, fn);
  const inBody = r.position === 'body';
  // The transitional body is drawn by the code at the full width: its size cannot change until the page is split.
  const fullWidthOnly = isLegacyBody(r);
  const asset = r.kind === 'image' ? assets.find(a => a.id === r.assetId) : undefined;
  const colChoices = Array.from({ length: COLUMNS + 1 - r.span }, (_, i) => ({ key: i + 1, label: String(i + 1) }));
  const spanChoices = [...SPAN_CHOICES.filter(s => s <= COLUMNS + 1 - r.column), ...(SPAN_CHOICES.includes(r.span as 12) ? [] : [r.span])]
    .sort((a, b) => b - a)
    .map(s => ({ key: s, label: `${spanName(s)} · ${s}` }));

  const source: PropGroup['props'] = [];
  if (r.kind === 'static') {
    source.push({
      label: 'Text',
      common: true,
      htmlFor: fieldId('text'),
      control: (
        <textarea
          id={fieldId('text')}
          value={r.text}
          rows={8}
          maxLength={STATIC_TEXT_MAX}
          disabled={readOnly}
          aria-label="Region text"
          className={`${TEXTAREA} font-sans text-12`}
          onChange={e => p('Text updated.', x => (x.kind === 'static' ? { ...x, text: e.target.value } : x))}
        />
      ),
      note: `${r.text.length.toLocaleString()} / ${STATIC_TEXT_MAX.toLocaleString()} · a shortcut inserts a house-style line at the cursor`,
      help: 'Your words as paragraphs. {shortcut:key} inserts a shortcut so the line never goes stale.',
    });
    source.push({
      label: 'Shortcuts',
      common: true,
      control: (
        <div className="flex flex-wrap gap-1">
          {shortcuts.length === 0 && <span className="text-11 text-text-faint">None yet: add one under Shared Components › Shortcuts.</span>}
          {shortcuts.map(s => (
            <button key={s.key} type="button" disabled={readOnly} title={s.text} className={PBTN} onClick={() => act.insertShortcut(r.id, s.key)}>
              {s.key}
            </button>
          ))}
        </div>
      ),
      help: 'House-style fragments kept once under Shared Components; inserted by key, substituted when the page renders.',
    });
  }
  if (r.kind === 'image') {
    source.push({
      label: 'Photo',
      common: true,
      htmlFor: fieldId('photo'),
      control: (
        <select
          id={fieldId('photo')}
          value={r.assetId}
          disabled={readOnly}
          aria-label="Region photo"
          className={FIELD}
          onChange={e => p('Photo set.', x => (x.kind === 'image' ? { ...x, assetId: e.target.value } : x))}
        >
          <option value="">Choose a photo…</option>
          {assets.map(a => (
            <option key={a.id} value={a.id}>
              {a.caption || a.key}
            </option>
          ))}
        </select>
      ),
      note: assets.length === 0 ? 'No photos yet: upload one under Shared Components › Assets first.' : undefined,
      help: 'One of your own uploads, with the caption, credit and licence it was stored with.',
    });
    if (asset) {
      source.push({
        label: 'Preview',
        control: <Image src={asset.url} alt="" width={asset.width ?? 400} height={asset.height ?? 300} unoptimized className="max-h-32 w-full border border-border object-cover" />,
      });
    }
    source.push({
      label: 'Alternative text',
      common: true,
      htmlFor: fieldId('alt'),
      control: (
        <input
          id={fieldId('alt')}
          type="text"
          value={r.alt}
          maxLength={IMAGE_ALT_MAX}
          disabled={readOnly}
          aria-label="Alternative text"
          className={FIELD}
          onChange={e => p('Alternative text updated.', x => (x.kind === 'image' ? { ...x, alt: e.target.value } : x))}
        />
      ),
      help: 'What a screen reader says instead of the photo.',
    });
    source.push({
      label: 'Caption and credit',
      common: true,
      control: <YesNo label="Show the caption and credit" value={r.showCaption} disabled={readOnly} onPick={v => p(v ? 'Caption shown.' : 'Caption hidden.', x => (x.kind === 'image' ? { ...x, showCaption: v } : x))} />,
    });
  }
  if (r.kind === 'list') {
    source.push({
      label: 'List',
      common: true,
      control: <Pills label="Region list" items={lists.map(l => ({ key: l.key, label: l.label }))} current={r.listKey} disabled={readOnly} onPick={k => p('List changed.', x => (x.kind === 'list' ? { ...x, listKey: k } : x))} />,
      help: 'One of the navigation lists, edited under Shared Components.',
    });
    source.push({
      label: 'Style',
      common: true,
      control: (
        <Pills
          label="Region list style"
          items={[
            { key: 'links', label: 'Links' },
            { key: 'cards', label: 'Cards' },
          ]}
          current={r.style}
          disabled={readOnly}
          onPick={s => p(`Style: ${s}.`, x => (x.kind === 'list' ? { ...x, style: s } : x))}
        />
      ),
    });
  }
  if (r.kind === 'button') {
    source.push({
      label: 'Label',
      common: true,
      htmlFor: fieldId('label'),
      control: (
        <input
          id={fieldId('label')}
          type="text"
          value={r.label}
          maxLength={BUTTON_LABEL_MAX}
          disabled={readOnly}
          aria-label="Button label"
          className={FIELD}
          onChange={e => p('Label updated.', x => (x.kind === 'button' ? { ...x, label: e.target.value } : x))}
        />
      ),
      help: 'The words on the button. Say what happens: “Read the report”, not “Click here”.',
    });
    source.push({
      label: 'Target',
      common: true,
      htmlFor: fieldId('dest'),
      control: (
        <select
          id={fieldId('dest')}
          value={r.dest ?? ''}
          disabled={readOnly}
          aria-label="Button destination"
          className={FIELD}
          onChange={e => p('Target set.', x => (x.kind === 'button' ? { ...x, dest: e.target.value || null } : x))}
        >
          <option value="">Nowhere: it fires dynamic actions only</option>
          {goOptions().map(o => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      ),
      note: 'Picked from places the site has. Never typed.',
      help: 'A place the site has, chosen from the catalogue. URLs are never typed here.',
    });
  }
  if (r.kind === 'component') {
    const spec = findComponent(r.component);
    source.push({
      label: 'Component',
      common: true,
      control: <Ro>{spec ? `${spec.name} · ${spec.holds}` : `Unknown component ${r.component}`}</Ro>,
      help: 'A piece the code draws. Its kind is deployed code; its settings and its rule are yours, here.',
    });
    for (const s of spec?.settings ?? []) {
      const value = r.settings[s.key] ?? s.default;
      const set = (v: SettingValue) => p(`${s.label} set.`, x => (x.kind === 'component' ? { ...x, settings: { ...x.settings, [s.key]: v } } : x));
      source.push({
        label: s.label,
        common: true,
        control:
          s.kind === 'boolean' ? (
            <YesNo label={s.label} value={Boolean(value)} disabled={readOnly} onPick={set} />
          ) : s.kind === 'choice' ? (
            <Pills label={s.label} items={(s.options ?? []).map(o => ({ key: o.key, label: o.label }))} current={String(value)} disabled={readOnly} onPick={set} />
          ) : s.kind === 'number' ? (
            <input type="number" value={Number(value)} min={s.min} max={s.max} disabled={readOnly} aria-label={s.label} className={FIELD} onChange={e => set(Number(e.target.value))} />
          ) : (
            <input type="text" value={String(value)} maxLength={s.maxLength ?? 200} disabled={readOnly} aria-label={s.label} className={FIELD} onChange={e => set(e.target.value)} />
          ),
        help: s.help,
      });
    }
    if (spec?.legacy) {
      const recipe = splitRecipe(ctx.page.path);
      source.push({
        label: 'Until split',
        common: true,
        control: recipe ? (
          <div className="grid gap-1.5">
            <Ro dim>The page’s body as its code writes it today. Its {recipe.length} components are ready: split it and each becomes a tile of its own, with its settings and its rule.</Ro>
            <button type="button" className={`${PBTN} justify-self-start text-edit`} disabled={readOnly} onClick={() => act.splitBody()}>
              Split into {recipe.length} components
            </button>
          </div>
        ) : (
          <Ro dim>The page’s body as its code writes it today. Splitting it into components is this page’s next step; nothing is lost until then.</Ro>
        ),
        help: 'The transitional component. A page whose components exist in the catalogue can be split here; the code’s body then stops drawing and the components take its place.',
      });
    }
  }

  const groups: PropGroup[] = [
    {
      title: 'Identification',
      props: [
        {
          label: 'Name',
          common: true,
          htmlFor: fieldId('rname'),
          control: (
            <input
              id={fieldId('rname')}
              type="text"
              value={r.title}
              maxLength={REGION_TITLE_MAX}
              disabled={readOnly}
              aria-label="Region title"
              placeholder={r.id}
              className={FIELD}
              onChange={e => p('Renamed.', x => ({ ...x, title: e.target.value }))}
            />
          ),
          help: 'The region’s title, shown as its heading on the page. Also what the tree, Messages and Page Search call it.',
        },
        { label: 'Type', common: true, control: <Ro dim>{K.label} · {K.holds}</Ro>, help: 'The kind of component. Kinds are deployed code; a new kind needs a deploy, everything else about a region does not.' },
        { label: 'Sequence', control: <Ro dim>{r.seq}</Ro>, note: 'Order in the tree; Move Up and Move Down change it.', help: 'Order among siblings. Regions render in sequence; the grid rules then decide where each lands.' },
      ],
    },
    { title: 'Source', props: source },
    {
      title: 'Layout',
      props: [
        { label: 'Parent Region', control: <Ro dim>None · page level</Ro> },
        {
          label: 'Position',
          common: true,
          control: (
            <Pills
              label="Region position"
              items={openPositions(ctx.page).map(x => ({ key: x, label: PD_POSITION[x].label }))}
              current={r.position}
              disabled={readOnly}
              onPick={pos => p(`Position: ${PD_POSITION[pos].label}.`, x => ({ ...x, position: pos, seq: 1_000_000, column: 1, span: pos === 'body' ? x.span : COLUMNS }))}
            />
          ),
          help: 'The template position. The Header, Footer and Navigation Bar are shared components, so nothing is placed there from a page.',
        },
        ...(inBody
          ? [
              {
                label: 'Start New Row',
                common: true,
                control: <YesNo label="Start a new row" value={r.newRow} disabled={readOnly} onPick={v => p(v ? 'Starts a new row.' : 'Flows on from the previous region.', x => ({ ...x, newRow: v }))} />,
                help: 'Yes puts the region at the start of the next grid row. No lets it flow on after the previous region if columns remain.',
              },
              {
                label: 'Column',
                common: true,
                control: <Pills label="Region column" items={colChoices} current={r.column} disabled={readOnly} onPick={c => p(`Column ${c}.`, x => ({ ...x, column: c, span: Math.min(x.span, COLUMNS + 1 - c) }))} />,
                help: 'The column the region’s left edge starts at, one to twelve.',
              },
              {
                label: 'Size',
                common: true,
                control: (
                  <Pills
                    label="Region size"
                    items={[
                      { key: 4, label: 'Small' },
                      { key: 6, label: 'Mid' },
                      { key: 12, label: 'Large' },
                    ]}
                    current={r.span === 4 || r.span === 6 || r.span === 12 ? r.span : null}
                    disabled={readOnly || fullWidthOnly}
                    onPick={s => p(`Size: ${s === 4 ? 'small' : s === 6 ? 'mid' : 'large'}.`, x => ({ ...x, span: s, column: Math.min(x.column, COLUMNS + 1 - s) }))}
                  />
                ),
                note: fullWidthOnly ? 'The code draws its body at the full width. Split the page to size its parts.' : 'The boxes on Home, in the words you used for them: small is a third of the row, mid a half, large the whole row.',
                help: 'A quick pick for the width. Small is a third of the twelve columns, Mid a half, Large the full row; Column Span below sets any width.',
              },
              {
                label: 'Column Span',
                common: true,
                control: <Pills label="Region span" items={spanChoices} current={r.span} disabled={readOnly || fullWidthOnly} onPick={s => p(`Column Span ${s}.`, x => ({ ...x, span: s, column: Math.min(x.column, COLUMNS + 1 - s) }))} />,
                note: fullWidthOnly ? 'The code draws its body at the full width. Split the page to size its parts.' : 'In twelfths, like APEX.',
                help: 'Width in twelfths. Full is 12, half is 6, a third is 4. Phones ignore it and stack every region.',
              },
              { label: 'Where it lands', common: true, control: <MiniMap doc={doc} id={r.id} />, note: 'Desktop and laptop. A phone stacks regions in sequence.' },
            ]
          : []),
      ],
    },
    LATER('Appearance'),
    {
      title: 'Header and Footer',
      closed: true,
      props: [
        {
          label: 'Header Text',
          htmlFor: fieldId('rheader'),
          control: (
            <input
              id={fieldId('rheader')}
              type="text"
              value={r.headerText ?? ''}
              maxLength={REGION_TEXT_MAX}
              disabled={readOnly}
              aria-label="Region header text"
              className={FIELD}
              onChange={e => p('Header Text updated.', x => textAttr(x, 'headerText', e.target.value))}
            />
          ),
          note: 'Shown above the region’s content.',
          help: 'A line of plain text drawn above the region’s body (APEX: Header Text). {shortcut:key} inserts a shortcut; nothing else is substituted and no markup is read.',
        },
        {
          label: 'Footer Text',
          htmlFor: fieldId('rfooter'),
          control: (
            <input
              id={fieldId('rfooter')}
              type="text"
              value={r.footerText ?? ''}
              maxLength={REGION_TEXT_MAX}
              disabled={readOnly}
              aria-label="Region footer text"
              className={FIELD}
              onChange={e => p('Footer Text updated.', x => textAttr(x, 'footerText', e.target.value))}
            />
          ),
          note: 'e.g. Times are local to you.',
          help: 'A line of plain text drawn below the region’s body (APEX: Footer Text). {shortcut:key} inserts a shortcut.',
        },
      ],
    },
    {
      title: 'Rules',
      props: [
        {
          label: 'Show',
          common: true,
          control: (
            <Pills
              label="Region show rule"
              items={SHOW_RULES.map(k => ({ key: k, label: SHOW_RULE_LABELS[k] }))}
              current={r.show ?? 'always'}
              disabled={readOnly}
              onPick={k =>
                p(`Shows: ${SHOW_RULE_LABELS[k]}.`, x => {
                  const next: Region = { ...x };
                  delete next.show;
                  return k === 'always' ? next : { ...next, show: k };
                })
              }
            />
          ),
          note: 'Phones and desktop are decided by the stylesheet; the rest by what the server knows when it serves the page.',
          help: 'When the region shows (APEX: Server-side Condition). Always; during a race weekend or between them; to signed-in or signed-out visitors; on phones or on desktop and laptop only. A fact the server does not have shows the region rather than hiding it.',
        },
      ],
    },
    {
      title: 'Security',
      props: [
        {
          label: 'Authorization Scheme',
          common: true,
          control: <Pills label="Region authorization" items={schemes.map(s => ({ key: s.key, label: s.label }))} current={r.authz ?? 'public'} disabled={readOnly} onPick={k => p(`Authorization: ${k}.`, x => ({ ...x, authz: k === 'public' ? null : k }))} />,
          help: AUTHZ_HELP,
        },
      ],
    },
    {
      title: 'Configuration',
      closed: true,
      props: [
        {
          label: 'Build Option',
          control: (
            <Pills
              label="Region build option"
              items={[
                { key: '', label: 'None' },
                ...BUILD_OPTION_KEYS.map(k => ({ key: k, label: `${BUILD_OPTION_DEFAULTS[k].label}${buildOptions[k] === 'exclude' ? ' (excluded)' : ''}` })),
              ]}
              current={r.buildOption ?? ''}
              disabled={readOnly}
              onPick={k =>
                p(k === '' ? 'Build Option cleared.' : `Build Option: ${BUILD_OPTION_DEFAULTS[k as BuildOptionKey].label}.`, x => {
                  const next: Region = { ...x };
                  delete next.buildOption;
                  return k === '' ? next : { ...next, buildOption: k as BuildOptionKey };
                })
              }
            />
          ),
          note: 'Excluded options render nothing, on every page.',
          help: 'The feature switch this region belongs to (APEX: Configuration › Build Option). Set the switch to Exclude under Shared Components → Build Options and every region tied to it leaves the running site, without being deleted.',
        },
      ],
    },
    {
      title: 'Advanced',
      props: [
        {
          label: 'Static ID',
          htmlFor: fieldId('rid'),
          control: (
            <input
              id={fieldId('rid')}
              type="text"
              value={r.id}
              disabled={readOnly}
              spellCheck={false}
              aria-label="Region id"
              className={`${FIELD} font-mono text-11`}
              onChange={e => {
                const id = e.target.value.trim().toLowerCase();
                ctx.commit(
                  {
                    ...doc,
                    regions: doc.regions.map(x => (x.id === r.id ? { ...x, id } : x)),
                    actions: doc.actions.map(a => ({
                      ...a,
                      when: 'region' in a.when && a.when.region === r.id ? { ...a.when, region: id } : a.when,
                      do: a.do.map(e2 => (e2.action !== 'go' && e2.region === r.id ? { ...e2, region: id } : e2)),
                    })),
                  },
                  'Static id set.',
                );
                ctx.select({ kind: 'region', id });
              }}
            />
          ),
          help: 'A stable id the dynamic actions use. Lower-case letters, digits and dashes.',
        },
        {
          label: 'Hidden at first',
          common: true,
          control: <YesNo label="Hidden until an action shows it" value={r.hidden} disabled={readOnly} onPick={v => p(v ? 'Hidden until an action shows it.' : 'Shown at first.', x => ({ ...x, hidden: v }))} />,
          note: 'Rendered hidden, so a “read more” never flashes; a dynamic action shows it.',
          help: 'Rendered hidden until a dynamic action shows it.',
        },
        {
          label: 'Actions',
          common: true,
          control: (
            <div className="flex flex-wrap gap-1">
              <button type="button" className={PBTN} disabled={readOnly} onClick={() => act.duplicate(r.id)}>
                Duplicate
              </button>
              <button type="button" className={PBTN} disabled={readOnly || index <= 0} onClick={() => act.move(r.id, -1)} aria-label="Move earlier">
                Move Up
              </button>
              <button type="button" className={PBTN} disabled={readOnly || index >= siblings.length - 1} onClick={() => act.move(r.id, 1)} aria-label="Move later">
                Move Down
              </button>
              <button type="button" className={`${PBTN} hover:border-negative hover:text-negative`} disabled={readOnly} onClick={() => act.remove(r.id)} aria-label={`Remove ${r.id}`}>
                Delete
              </button>
            </div>
          ),
        },
      ],
    },
  ];
  return { head: { kind: K.label, name: regionName(r) }, groups };
}

export function actionGroups(ctx: PropsContext, a: DynamicAction): { head: { kind: string; name: string }; groups: PropGroup[] } {
  const { doc, readOnly, act, select, fieldId } = ctx;
  const pa = (label: string, fn: (x: DynamicAction) => DynamicAction) => patchAction(ctx, a.id, label, fn);
  const regionOptions = doc.regions.map(r => ({ key: r.id, label: `${regionName(r)} (${r.id})` }));
  const events: { key: TriggerEvent; label: string }[] = [
    { key: 'click', label: 'Click' },
    { key: 'load', label: 'Page Load' },
    { key: 'timer', label: 'Timer' },
    { key: 'visible', label: 'Scrolled into view' },
  ];
  const when: PropGroup['props'] = [
    {
      label: 'Event',
      common: true,
      control: <Pills label={`When of ${a.id}`} items={events} current={a.when.event} disabled={readOnly} onPick={ev => pa(`Event: ${events.find(e => e.key === ev)!.label}.`, x => ({ ...x, when: triggerFor(ev, doc.regions, x.when) }))} />,
      help: 'What fires the dynamic action: a click on a region, the page loading, a timer, a region scrolling into view.',
    },
  ];
  if (a.when.event === 'click' || a.when.event === 'visible') {
    when.push({
      label: 'Region',
      common: true,
      htmlFor: fieldId('when-region'),
      control: (
        <select
          id={fieldId('when-region')}
          value={a.when.region}
          disabled={readOnly}
          aria-label={`Trigger region of ${a.id}`}
          className={FIELD}
          onChange={e => pa('Watches another region.', x => ({ ...x, when: { event: x.when.event as 'click' | 'visible', region: e.target.value } }))}
        >
          {regionOptions.map(o => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      ),
      help: 'The region the event is watched on.',
    });
  }
  if (a.when.event === 'timer') {
    when.push({
      label: 'Every (seconds)',
      common: true,
      htmlFor: fieldId('when-seconds'),
      control: (
        <input
          id={fieldId('when-seconds')}
          type="number"
          min={TIMER_MIN_SECONDS}
          max={TIMER_MAX_SECONDS}
          value={a.when.seconds}
          disabled={readOnly}
          aria-label={`Timer of ${a.id}`}
          className={FIELD}
          onChange={e => pa('Timer set.', x => ({ ...x, when: { event: 'timer', seconds: Math.round(Number(e.target.value)) || 0 } }))}
        />
      ),
      note: `${TIMER_MIN_SECONDS} to ${TIMER_MAX_SECONDS} seconds`,
    });
  }
  const groups: PropGroup[] = [
    {
      title: 'Identification',
      props: [
        {
          label: 'Name',
          common: true,
          htmlFor: fieldId('aname'),
          control: (
            <input
              id={fieldId('aname')}
              type="text"
              value={a.name}
              maxLength={ACTION_NAME_MAX}
              disabled={readOnly}
              placeholder={a.id}
              aria-label={`Name of ${a.id}`}
              className={FIELD}
              onChange={e => pa('Renamed.', x => ({ ...x, name: e.target.value }))}
            />
          ),
        },
        { label: 'Sequence', control: <Ro dim>{(doc.actions.findIndex(x => x.id === a.id) + 1) * 10}</Ro> },
      ],
    },
    { title: 'When', props: when },
    {
      title: 'Actions',
      props: [
        {
          label: 'Actions',
          common: true,
          control: (
            <div className="flex flex-wrap gap-1">
              {a.do.map((e, i) => (
                <button key={i} type="button" className={PBTN} onClick={() => select({ kind: 'effect', id: a.id, index: i })}>
                  TRUE · {effectLabel(e)}
                </button>
              ))}
              <button type="button" className={`${PBTN} border-edit text-edit`} disabled={readOnly || a.do.length >= 8} onClick={() => act.addEffect(a.id)}>
                ＋ TRUE action
              </button>
            </div>
          ),
          note: 'TRUE actions run when the event fires. Click one to edit it.',
          help: 'What happens, from the catalogue: show, hide or toggle a region, scroll to one, go to a destination.',
        },
      ],
    },
    {
      title: 'Advanced',
      closed: true,
      props: [
        {
          label: 'Actions',
          common: true,
          control: (
            <button type="button" className={`${PBTN} hover:border-negative hover:text-negative`} disabled={readOnly} onClick={() => act.removeAction(a.id)} aria-label={`Remove ${a.id}`}>
              Delete
            </button>
          ),
        },
      ],
    },
  ];
  return { head: { kind: 'Dynamic Action', name: actionName(a) }, groups };
}

function effectLabel(e: Effect): string {
  return e.action === 'go' ? 'Navigate to Page' : e.action === 'show' ? 'Show' : e.action === 'hide' ? 'Hide' : e.action === 'toggle' ? 'Toggle visibility' : 'Scroll To';
}

export function effectGroups(ctx: PropsContext, a: DynamicAction, index: number): { head: { kind: string; name: string }; groups: PropGroup[] } {
  const { doc, readOnly, act, select, fieldId } = ctx;
  const e = a.do[index];
  const pe = (label: string, fn: (x: Effect) => Effect) => patchAction(ctx, a.id, label, x => ({ ...x, do: x.do.map((d, j) => (j === index ? fn(d) : d)) }));
  const kinds: { key: EffectAction; label: string }[] = [
    { key: 'show', label: 'Show' },
    { key: 'hide', label: 'Hide' },
    { key: 'toggle', label: 'Toggle visibility' },
    { key: 'scroll-to', label: 'Scroll To' },
    { key: 'go', label: 'Navigate to Page' },
  ];
  const regionOptions = doc.regions.map(r => ({ key: r.id, label: `${regionName(r)} (${r.id})` }));
  const groups: PropGroup[] = [
    {
      title: 'Identification',
      props: [
        {
          label: 'Action',
          common: true,
          control: <Pills label={`Effect ${index + 1} of ${a.id}`} items={kinds} current={e.action} disabled={readOnly} onPick={k => pe(`Action: ${kinds.find(x => x.key === k)!.label}.`, d => effectFor(k, doc.regions, d))} />,
          help: 'What happens, from the catalogue. Every action has typed settings; none takes code.',
        },
      ],
    },
    e.action === 'go'
      ? {
          title: 'Settings',
          props: [
            {
              label: 'Destination',
              common: true,
              htmlFor: fieldId('dest'),
              control: (
                <select id={fieldId('dest')} value={e.dest} disabled={readOnly} aria-label={`Destination of effect ${index + 1} of ${a.id}`} className={FIELD} onChange={ev => pe('Destination set.', () => ({ action: 'go', dest: ev.target.value }))}>
                  {goOptions().map(o => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ),
              note: destinationLabel(e.dest),
              help: 'A place the site has, chosen from the catalogue. URLs are never typed here.',
            },
          ],
        }
      : {
          title: 'Affected Elements',
          props: [
            {
              label: 'Region',
              common: true,
              htmlFor: fieldId('target'),
              control: (
                <select
                  id={fieldId('target')}
                  value={e.region}
                  disabled={readOnly}
                  aria-label={`Region of effect ${index + 1} of ${a.id}`}
                  className={FIELD}
                  onChange={ev => pe('Affects another region.', d => (d.action === 'go' ? d : { action: d.action, region: ev.target.value }))}
                >
                  {regionOptions.map(o => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ),
              help: 'The region the action changes.',
            },
          ],
        },
    {
      title: 'Advanced',
      props: [
        {
          label: 'Actions',
          common: true,
          control: (
            <div className="flex flex-wrap gap-1">
              <button type="button" className={PBTN} onClick={() => select({ kind: 'action', id: a.id })}>
                Back to the dynamic action
              </button>
              <button type="button" className={`${PBTN} hover:border-negative hover:text-negative`} disabled={readOnly || a.do.length <= 1} onClick={() => act.removeEffect(a.id, index)} aria-label={`Remove effect ${index + 1} of ${a.id}`}>
                Delete
              </button>
            </div>
          ),
          note: a.do.length <= 1 ? 'An action keeps at least one effect; delete the action instead.' : undefined,
        },
      ],
    },
  ];
  return { head: { kind: 'TRUE Action', name: `${effectLabel(e)} · ${actionName(a)}` }, groups };
}

export function positionGroups(ctx: PropsContext, pos: Position): { head: { kind: string; name: string }; groups: PropGroup[] } {
  const n = ctx.doc.regions.filter(r => r.position === pos).length;
  const code = !openPositions(ctx.page).includes(pos);
  return {
    head: { kind: 'Position', name: PD_POSITION[pos].label },
    groups: [
      {
        title: 'Identification',
        props: [
          { label: 'Position', common: true, control: <Ro>{PD_POSITION[pos].label}</Ro>, note: PD_POSITION[pos].note },
          { label: 'Regions', common: true, control: <Ro>{n}</Ro> },
          {
            label: 'Actions',
            common: true,
            control: (
              <button type="button" className={`${PBTN} border-edit text-edit`} disabled={ctx.readOnly || code} onClick={() => ctx.act.addRegion('static', pos)}>
                Create Region here
              </button>
            ),
            note: code ? 'The code owns this position on this page; regions of yours go in the Page Header, the Breadcrumb Bar, the Footer or the Phone Bar.' : undefined,
          },
        ],
      },
    ],
  };
}

export function sharedGroups(ctx: PropsContext, key: 'doors' | 'footer' | 'bar'): { head: { kind: string; name: string }; groups: PropGroup[] } {
  const s = sharedOf(key);
  return {
    head: { kind: 'Shared Component', name: s.label },
    groups: [
      {
        title: 'Identification',
        props: [
          { label: 'Type', common: true, control: <Ro>{s.label}</Ro>, note: s.sub },
          { label: 'Used on', common: true, control: <Ro dim>Every page</Ro> },
          { label: 'Entries', common: true, control: <Ro>{ctx.shared[key]}</Ro> },
          {
            label: 'Edit',
            common: true,
            control: (
              <button type="button" className={`${PBTN} justify-self-start border-edit text-edit`} onClick={() => ctx.openShared(s.sc)}>
                Edit in Shared Components
              </button>
            ),
            note: 'Shared components are edited once, in their own workspace; pages only show them.',
          },
        ],
      },
    ],
  };
}

export function procGroups(ctx: PropsContext, id: string): { head: { kind: string; name: string }; groups: PropGroup[] } {
  const step = systemSteps(ctx.page).find(s => s.id === id);
  if (!step) return { head: { kind: 'System process', name: id }, groups: [] };
  const point = step.point === 'before-header' ? 'Before Header' : step.point === 'after-header' ? 'After Header' : 'After Footer';
  return {
    head: { kind: 'System process', name: step.name },
    groups: [
      {
        title: 'Identification',
        props: [
          { label: 'Name', common: true, control: <Ro>{step.name}</Ro> },
          { label: 'Type', common: true, control: <Ro dim>System</Ro> },
        ],
      },
      {
        title: 'Execution',
        props: [
          { label: 'Point', common: true, control: <Ro dim>{point}</Ro> },
          { label: 'Note', common: true, control: <Ro dim>{step.note}</Ro> },
        ],
      },
      {
        title: 'Advanced',
        props: [{ label: 'State', common: true, control: <Ro>On</Ro>, note: 'What the site does at this point. Read-only; a change is a deploy.' }],
      },
    ],
  };
}

/** The pane's head and groups for a selection. */
export function groupsFor(ctx: PropsContext, sel: Selection): { head: { kind: string; name: string }; groups: PropGroup[] } {
  switch (sel.kind) {
    case 'page':
      return pageGroups(ctx);
    case 'region': {
      const r = ctx.doc.regions.find(x => x.id === sel.id);
      return r ? regionGroups(ctx, r) : pageGroups(ctx);
    }
    case 'action': {
      const a = ctx.doc.actions.find(x => x.id === sel.id);
      return a ? actionGroups(ctx, a) : pageGroups(ctx);
    }
    case 'effect': {
      const a = ctx.doc.actions.find(x => x.id === sel.id);
      return a && a.do[sel.index] ? effectGroups(ctx, a, sel.index) : pageGroups(ctx);
    }
    case 'position':
      return positionGroups(ctx, sel.id);
    case 'shared':
      return sharedGroups(ctx, sel.id);
    case 'proc':
      return procGroups(ctx, sel.id);
  }
}
