import Link from 'next/link';
import Image from 'next/image';
import { PAGE_WIDE } from '@/lib/site';
import { resolveDestination, type NavEntry, type NavLists } from '@/lib/design/destinations';
import { isLegacyBody, rowsAt, substituteShortcuts, type PageDocument, type Position, type Region } from '@/lib/design/page-document';
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
}

const LIST_FIELD: Record<string, keyof NavLists> = {
  doors: 'doors',
  bar: 'bar',
  'footer-site': 'footerSite',
  'footer-legal': 'footerLegal',
};

const H2 = 'mb-3 border-b border-text pb-1 font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted';
const PROSE = 'font-serif text-16 leading-relaxed text-text-muted';

export function RowPageView(d: RowPageData) {
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
      {d.document.actions.length > 0 && <DynamicActions actions={d.document.actions} />}
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
export function CodePageFrame({ d, children }: { d: RowPageData; children?: React.ReactNode }) {
  const has = (p: Position) => d.document.regions.some(r => r.position === p);
  const above = has('header') || has('breadcrumb');
  const below = has('footer') || has('phonebar');
  const bodyRows = rowsAt(d.document, 'body');
  const at = bodyRows.findIndex(row => row.some(isLegacyBody));
  const split = bodyRows.length > 0 && at < 0;
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
      {d.document.actions.length > 0 && <DynamicActions actions={d.document.actions} />}
    </>
  );
}

function Strip({ d, position, className = '' }: { d: RowPageData; position: Position; className?: string }) {
  return <Rows d={d} rows={rowsAt(d.document, position)} className={className} />;
}

/** A show rule the stylesheet decides: phones only, or desktop and laptop only. */
function showClass(r: Region): string {
  return r.show === 'phones' ? 'lg:hidden' : r.show === 'desktop' ? 'max-lg:hidden' : '';
}

function Rows({ d, rows, className = '' }: { d: RowPageData; rows: Region[][]; className?: string }) {
  if (rows.length === 0) return null;
  return (
    <div className={`grid gap-6 ${className}`}>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-6">
          {row.map(r => (
            // `data-region` is what a dynamic action finds; `hidden` is the
            // region's starting state, so a "read more" never flashes.
            <div
              key={r.id}
              id={`region-${r.id}`}
              data-region={r.id}
              hidden={r.hidden || undefined}
              className={`col-span-12 min-w-0 lg:[grid-column:var(--gc)] ${showClass(r)}`}
              style={{ ['--gc' as string]: `${r.column} / span ${r.span}` }}
            >
              <RegionBlock d={d} region={r} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function RegionBlock({ d, region }: { d: RowPageData; region: Region }) {
  if (region.authz && region.authz !== 'public' && !d.allowed.has(region.authz)) {
    const message = d.messages[region.authz];
    return message ? <p className="border border-border px-3 py-2 text-13 text-text-faint">{message}</p> : null;
  }
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
        {title && <h2 className={H2}>{title}</h2>}
        <div className="space-y-3">
          {paragraphs.map((p, i) => (
            <p key={i} className={PROSE}>
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
    const credit = [asset.credit, asset.licence].filter(Boolean).join(' · ');
    return (
      <figure>
        {title && <h2 className={H2}>{title}</h2>}
        <Image
          src={asset.url}
          alt={region.alt}
          width={asset.width ?? 1200}
          height={asset.height ?? 800}
          unoptimized
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
    const dest = region.dest ? resolveDestination(region.dest) : null;
    const cls =
      'inline-flex min-h-11 items-center bg-text px-5 font-mono text-11 font-semibold uppercase tracking-[0.14em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted';
    return (
      <div>
        {title && <h2 className={H2}>{title}</h2>}
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
      {title && <h2 className={H2}>{title}</h2>}
      {region.style === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2">
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
  const dest = resolveDestination(entry.dest);
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
  const dest = resolveDestination(entry.dest);
  if (!dest || dest.kind === 'action') return null;
  const body = (
    <>
      <span className="block font-mono text-10 font-semibold uppercase tracking-[0.16em] text-text-muted">{entry.label}</span>
      {dest.label !== entry.label && <span className="mt-1 block font-serif text-15 text-text-faint">{dest.label}</span>}
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
