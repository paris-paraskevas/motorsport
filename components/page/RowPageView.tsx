import Link from 'next/link';
import Image from 'next/image';
import { PAGE_WIDE } from '@/lib/site';
import { pageIdOf, resolveDestination, resolveEntry, type NavEntry, type NavLists, type PageDestinations } from '@/lib/design/destinations';
import { COLUMNS, NESTING_CAP, applyTabs, childrenOf, isLegacyBody, rowsAt, splitsBody, substituteShortcuts, type PageDocument, type Position, type Region } from '@/lib/design/page-document';
import { SHIPPED_PRESETS, regionTemplate, resolveTemplateOptions, templateOptionClasses, type TemplateOptionClasses, type TemplatePresets } from '@/lib/design/template-options';
import type { EditableAsset } from '@/lib/design/assets';
import type { PageRow } from '@/lib/design/pages';
import { DynamicActions } from './DynamicActions';

// A row page as visitors see it (Phase 3 step 3): the live revision's regions
// placed into the site's standard template. Header regions sit above the page
// title, the Breadcrumb Bar under it, the Body beside the Right Side Column on
// wide screens (eight and four of twelve) and above it on phones, the Footer
// above the site footer, the Phone Bar at the foot on phones. Within a
// position a region keeps its column and span on wide screens and takes the
// full width on phones. Everything is resolved before render (shortcuts,
// photos, lists, the visitor's schemes), so this component is synchronous and
// the same on the server and in a test.

export interface RowPageData {
  page: PageRow;
  document: PageDocument;
  /** Shortcut key → text, for Static Content. */
  shortcuts: Readonly<Record<string, string>>;
  /** The photos the document names, by id. */
  assets: ReadonlyMap<string, EditableAsset>;
  nav: NavLists;
  /** The entries of every list the document names, by key: the shell's four and
   *  the operator's own (lib/design/lists.ts loadDocumentLists). A key missing
   *  here falls back to `nav` for the four and to nothing for the rest. */
  lists?: Readonly<Record<string, readonly NavEntry[]>>;
  /** The scheme keys the visitor passes; a region asking for another is left out. */
  allowed: ReadonlySet<string>;
  /** What a refused region shows in its place, by scheme key; null shows nothing. */
  messages: Readonly<Record<string, string | null>>;
  /** Component regions, drawn by the server before render, by region id. A
   *  component with nothing here (the transitional body on a page made in the
   *  designer, a component the server did not draw) shows nothing. */
  components?: Readonly<Record<string, React.ReactNode>>;
  /** The region templates' Template Option presets (APEX: Template Options, P1.2),
   *  what a region on Use Template Defaults draws; absent reads as shipped. */
  templates?: TemplatePresets;
  /** The live row pages the document's buttons and go effects name, by id
   *  (P1.12 B2; lib/design/pages.ts loadNamedPages). A page missing here is
   *  not live: its button is not drawn and its go effect goes nowhere, until
   *  Reinstate brings the page back. */
  pages?: PageDestinations;
}

const LIST_FIELD: Record<string, keyof NavLists> = {
  doors: 'doors',
  bar: 'bar',
  'footer-site': 'footerSite',
  'footer-legal': 'footerLegal',
  'footer-series': 'footerSeries',
};

/** Header Text and a caption's lead keep the site's prose; a region's own body
 *  text takes its classes from its Template Options (template-options.ts). */
const PROSE = 'font-serif text-16 leading-relaxed text-text-muted';

/** The document as it leaves the server (P2.10): a Tabs region in View Single Region hides its tabs but the first. */
const tabbed = (d: RowPageData): RowPageData => {
  const document = applyTabs(d.document);
  return document === d.document ? d : { ...d, document };
};

export function RowPageView(served: RowPageData) {
  const d = tabbed(served);
  const has = (p: Position) => d.document.regions.some(r => r.position === p);
  const hasRight = has('right');
  return (
    <article className={PAGE_WIDE} data-page-revision="">
      <Strip d={d} position="header" />
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-38 font-medium leading-none tracking-[-0.02em] text-text md:text-46">
          {d.page.title ?? d.page.name}
        </h1>
      </header>
      <Strip d={d} position="breadcrumb" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className={hasRight ? 'min-w-0 lg:col-span-8' : 'min-w-0 lg:col-span-12'}>
          <Strip d={d} position="body" />
        </div>
        {hasRight && (
          <aside className="min-w-0 lg:col-span-4">
            <Strip d={d} position="right" />
          </aside>
        )}
      </div>
      <Strip d={d} position="footer" className="mt-8" />
      <Strip d={d} position="phonebar" className="mt-8 lg:hidden" />
      {d.document.actions.length > 0 && <DynamicActions actions={d.document.actions} pages={d.pages} />}
    </article>
  );
}

/** A page whose route the code still serves (the Page Designer plan, PR 3; the
 *  components programme, R2a and R2b): the regions of the operator's own
 *  around and among the code's body. Page Header and Breadcrumb Bar regions
 *  above, Footer and Phone Bar below, in the site's standard width. In the
 *  Body, the code's body is `children`, placed where the transitional
 *  component ("Body as the code draws it") sits; the operator's own body
 *  regions render before and after it in the standard width. A document with
 *  no Body regions at all (a revision from before the Body opened) draws the
 *  code's body alone. A document with Body regions and no transitional
 *  component is a page the operator has SPLIT: its components and regions are
 *  the body, and the code's body is not drawn. The Right Side Column waits for
 *  its own decision. Rendered only when the live revision has regions. */
export function CodePageFrame({ d: served, children }: { d: RowPageData; children?: React.ReactNode }) {
  const d = tabbed(served);
  const has = (p: Position) => d.document.regions.some(r => r.position === p);
  const above = has('header') || has('breadcrumb');
  const below = has('footer') || has('phonebar');
  const bodyRows = rowsAt(d.document, 'body');
  const at = bodyRows.findIndex(row => row.some(isLegacyBody));
  // The rule the frame shares (page-frame.tsx framed, P2.24 C): Body rows and no transitional component.
  const split = splitsBody(d.document);
  const before = at < 0 ? [] : bodyRows.slice(0, at);
  const sameRow = at < 0 ? [] : bodyRows[at].filter(r => !isLegacyBody(r));
  const after = [...(sameRow.length ? [sameRow] : []), ...(at < 0 ? bodyRows : bodyRows.slice(at + 1))];
  return (
    <>
      {above && (
        <div className={`${PAGE_WIDE} pb-0`} data-page-frame="above">
          <Strip d={d} position="header" />
          <Strip d={d} position="breadcrumb" className="mt-6" />
        </div>
      )}
      {before.length > 0 && (
        <div className={`${PAGE_WIDE} pb-0`} data-page-frame="body-before">
          <Rows d={d} rows={before} />
        </div>
      )}
      {!split && children}
      {after.length > 0 && (
        <div className={`${PAGE_WIDE} ${split ? '' : 'pt-0'}`} data-page-frame={split ? 'body' : 'body-after'}>
          <Rows d={d} rows={after} />
        </div>
      )}
      {below && (
        <div className={`${PAGE_WIDE} pt-0`} data-page-frame="below">
          <Strip d={d} position="footer" />
          <Strip d={d} position="phonebar" className="mt-8 lg:hidden" />
        </div>
      )}
      {d.document.actions.length > 0 && <DynamicActions actions={d.document.actions} pages={d.pages} />}
    </>
  );
}

function Strip({ d, position, className = '' }: { d: RowPageData; position: Position; className?: string }) {
  // Only the Body has something to its right, and only when the page has a Right Side Column.
  const rightFree = position !== 'body' || !d.document.regions.some(r => r.position === 'right');
  return <Rows d={d} rows={rowsAt(d.document, position)} className={className} rightFree={rightFree} />;
}

/** A Band runs to the page's edges where the region reaches them (P1.1): on
 *  phones and tablets every region is full width, so both sides; at the desktop
 *  breakpoint the left when it starts at column 1, the right when it ends at
 *  column 12 with nothing to its right. The margins cancel PAGE_WIDE's padding
 *  (p-4 md:p-6 lg:p-8); the box's own padding puts the text back on the
 *  content edge. */
function bandBleed(r: Region, rightFree: boolean): string {
  const left = r.column === 1 ? 'lg:-ml-8' : 'lg:ml-0';
  const right = r.column + r.span === COLUMNS + 1 && rightFree ? 'lg:-mr-8' : 'lg:mr-0';
  return `-mx-4 md:-mx-6 ${left} ${right}`;
}

/** A condition the stylesheet decides (P2.6): Phones, or Desktop and laptop. */
function showClass(r: Region): string {
  const type = r.condition?.type;
  return type === 'phones' ? 'lg:hidden' : type === 'desktop' ? 'max-lg:hidden' : '';
}

/** A Button to a row page is drawn only while the page is live (P1.12 B2): a
 *  deleted or vanished page leaves no button and no empty box behind, and the
 *  region returns with Reinstate. Every other region is drawn. */
function isDrawn(d: RowPageData, r: Region): boolean {
  if (r.kind !== 'button' || !r.dest) return true;
  const id = pageIdOf(r.dest);
  return id === null || (d.pages !== undefined && id in d.pages);
}

function Rows({
  d,
  rows: stored,
  className = '',
  rightFree = true,
  nested = false,
  depth = 0,
}: {
  d: RowPageData;
  rows: Region[][];
  className?: string;
  /** Nothing sits to the right of a full-width region here, so a Band may run to the page's right edge; a code page's strips never have a Right Side Column. */
  rightFree?: boolean;
  /** The rows of a region's sub regions (P1.4): inside their parent, so a Band there never bleeds to the page's edges. */
  nested?: boolean;
  /** How deep these rows sit; the recursion stops at NESTING_CAP. */
  depth?: number;
}) {
  const rows = stored.map(row => row.filter(r => isDrawn(d, r))).filter(row => row.length > 0);
  if (rows.length === 0) return null;
  const presets = d.templates ?? SHIPPED_PRESETS;
  return (
    <div className={`grid gap-6 ${className}`}>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-6">
          {row.map(r => {
            // The region's Template Options resolved against its template's
            // presets (APEX: #DEFAULT# and the picks; P1.2): the wrapper's
            // classes here, the heading's and the body's in RegionBody. The
            // template's box (P1.1) is its own element inside the cell, so its
            // border and padding never meet the options' on one element.
            const parts = templateOptionClasses(resolveTemplateOptions(r.templateOptions, presets, r.template), r.template);
            const box = parts.box ? `${parts.box}${!nested && regionTemplate(r.template).bleeds ? ` ${bandBleed(r, rightFree)}` : ''}` : '';
            const block = <RegionBlock d={d} region={r} parts={parts} depth={depth} />;
            return (
              // `data-region` is what a dynamic action finds; `hidden` is the
              // region's starting state, so a "read more" never flashes.
              <div
                key={r.id}
                id={`region-${r.id}`}
                data-region={r.id}
                hidden={r.hidden || undefined}
                className={`col-span-12 min-w-0 lg:[grid-column:var(--gc)] ${showClass(r)} ${parts.wrapper}`.trim()}
                style={{ ['--gc' as string]: `${r.column} / span ${r.span}` }}
              >
                {box ? (
                  <div data-region-box="" className={box}>
                    {block}
                  </div>
                ) : (
                  block
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** A region as served: refused whole when the visitor fails its scheme (its
 *  sub regions with it); else its Header Text, its body, its sub regions
 *  (P1.4; APEX's region template order) and its Footer Text (APEX: Region
 *  Header and Footer), the texts plain, shortcuts substituted, escaped like any text. */
function RegionBlock({ d, region, parts, depth = 0 }: { d: RowPageData; region: Region; parts: TemplateOptionClasses; depth?: number }) {
  if (region.authz && region.authz !== 'public' && !d.allowed.has(region.authz)) {
    const message = d.messages[region.authz];
    return message ? <p className="border border-border px-3 py-2 text-13 text-text-faint">{message}</p> : null;
  }
  const header = region.headerText === undefined ? '' : substituteShortcuts(region.headerText, d.shortcuts).trim();
  const footer = region.footerText === undefined ? '' : substituteShortcuts(region.footerText, d.shortcuts).trim();
  const subs = depth < NESTING_CAP && childrenOf(d.document, region.id).length > 0;
  return (
    <>
      {header !== '' && (
        <p data-region-header="" className={`${PROSE} mb-3`}>
          {header}
        </p>
      )}
      <RegionBody d={d} region={region} parts={parts} />
      {subs && <Rows d={d} rows={rowsAt(d.document, region.position, region.id)} className="mt-6" nested depth={depth + 1} />}
      {footer !== '' && (
        <p data-region-footer="" className="mt-3 text-13 text-text-faint">
          {footer}
        </p>
      )}
    </>
  );
}

/** The region's body by kind. A component draws its own body and heading, so
 *  only the wrapper's options reach it (they are applied in Rows). */
function RegionBody({ d, region, parts }: { d: RowPageData; region: Region; parts: TemplateOptionClasses }) {
  if (region.kind === 'component') return <>{d.components?.[region.id] ?? null}</>;
  const title = region.title.trim();
  if (region.kind === 'static') {
    const text = substituteShortcuts(region.text, d.shortcuts);
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean);
    return (
      <section>
        {title && <h2 className={parts.heading}>{title}</h2>}
        <div className={parts.paragraphs}>
          {paragraphs.map((p, i) => (
            <p key={i} className={parts.body}>
              {p.split('\n').map((line, j, all) => (
                <span key={j}>
                  {line}
                  {j < all.length - 1 && <br />}
                </span>
              ))}
            </p>
          ))}
        </div>
      </section>
    );
  }
  if (region.kind === 'image') {
    const asset = d.assets.get(region.assetId);
    if (!asset) return null;
    // R18: the first photo of the Body is the largest thing above the fold on a page that opens with one; it loads eagerly, the rest lazily.
    const first = d.document.regions.filter(r => r.kind === 'image' && r.position === 'body' && !r.hidden).sort((a, b) => a.seq - b.seq)[0];
    const priority = first?.id === region.id;
    const credit = [asset.credit, asset.licence].filter(Boolean).join(' · ');
    return (
      <figure>
        {title && <h2 className={parts.heading}>{title}</h2>}
        <Image
          src={asset.url}
          alt={region.alt}
          width={asset.width ?? 1200}
          height={asset.height ?? 800}
          unoptimized
          priority={priority}
          className="h-auto w-full border border-border bg-surface"
        />
        {region.showCaption && (asset.caption || credit) && (
          <figcaption className="mt-2 font-mono text-10 text-text-faint">
            {asset.caption && <span className="text-text-muted">{asset.caption}</span>}
            {asset.caption && credit && <span> · </span>}
            {credit}
          </figcaption>
        )}
      </figure>
    );
  }
  if (region.kind === 'button') {
    const dest = region.dest ? resolveDestination(region.dest, d.pages) : null;
    const cls =
      'inline-flex min-h-11 items-center bg-text px-5 font-mono text-11 font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted';
    return (
      <div>
        {title && <h2 className={parts.heading}>{title}</h2>}
        {dest && dest.kind === 'external' ? (
          <a href={dest.href} target="_blank" rel="noopener noreferrer" className={cls}>
            {region.label}
          </a>
        ) : dest && dest.kind === 'route' ? (
          <Link href={dest.href} className={cls}>
            {region.label}
          </Link>
        ) : (
          // No destination: the button exists for its dynamic actions, bound to
          // the region wrapper by DynamicActions.
          <button type="button" className={cls}>
            {region.label}
          </button>
        )}
      </div>
    );
  }
  const field = LIST_FIELD[region.listKey];
  const source = d.lists?.[region.listKey] ?? (field ? d.nav[field] : []);
  const entries = source.filter(e => !e.authz || e.authz === 'public' || d.allowed.has(e.authz));
  if (entries.length === 0) return null;
  return (
    <nav aria-label={title || region.id}>
      {title && <h2 className={parts.heading}>{title}</h2>}
      {region.style === 'cards' ? (
        // Three to a row from lg for a wide body region on a page without an aside (R18 PR C); two in an aside, beside one
        // (the body is eight columns there) or in a narrow region, where a third would be too narrow to read.
        <div className={`grid gap-3 sm:grid-cols-2${region.span >= 9 && region.position !== 'right' && !d.document.regions.some(r => r.position === 'right' && isDrawn(d, r)) ? ' lg:grid-cols-3' : ''}`}>
          {entries.map((e, i) => (
            <ListCard key={`${e.dest}-${i}`} entry={e} />
          ))}
        </div>
      ) : (
        <ul className="m-0 list-none p-0">
          {entries.map((e, i) => (
            <li key={`${e.dest}-${i}`}>
              <ListLink entry={e} />
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

const LINK = 'block py-1 font-serif text-16 text-text underline underline-offset-2 transition-colors duration-(--duration-fast) hover:text-brand';

function ListLink({ entry }: { entry: NavEntry }) {
  const dest = resolveEntry(entry);
  if (!dest || dest.kind === 'action') return null;
  if (dest.kind === 'external') {
    return (
      <a href={dest.href} target="_blank" rel="noopener noreferrer" className={LINK}>
        {entry.label}
      </a>
    );
  }
  return (
    <Link href={dest.href} className={LINK}>
      {entry.label}
    </Link>
  );
}

const CARD =
  'block border border-border bg-surface p-4 transition-colors duration-(--duration-fast) hover:border-text-muted';

function ListCard({ entry }: { entry: NavEntry }) {
  const dest = resolveEntry(entry);
  if (!dest || dest.kind === 'action') return null;
  // R18 PR C: the card as the operator's design draws it: the destination's name in mono when the entry's words differ from
  // it, the words in serif, the sentence when the entry carries one, the cue.
  const body = (
    <>
      {dest.label !== entry.label && <span className="block font-mono text-10 font-semibold uppercase tracking-[0.16em] text-text-muted">{dest.label}</span>}
      <span className="mt-1 block font-serif text-17 text-text">{entry.label}</span>
      {entry.note && <span className="mt-1.5 block text-13 leading-snug text-text-muted">{entry.note}</span>}
      <span className="mt-3 block font-mono text-10 font-semibold uppercase tracking-[0.14em] text-brand">Open →</span>
    </>
  );
  if (dest.kind === 'external') {
    return (
      <a href={dest.href} target="_blank" rel="noopener noreferrer" className={CARD}>
        {body}
      </a>
    );
  }
  return (
    <Link href={dest.href} className={CARD}>
      {body}
    </Link>
  );
}
