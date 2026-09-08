import Link from 'next/link';
import Image from 'next/image';
import { PAGE_WIDE } from '@/lib/site';
import { resolveDestination, type NavEntry, type NavLists } from '@/lib/design/destinations';
import { rowsAt, substituteShortcuts, type PageDocument, type Position, type Region } from '@/lib/design/page-document';
import type { EditableAsset } from '@/lib/design/assets';
import type { PageRow } from '@/lib/design/pages';

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
  /** The scheme keys the visitor passes; a region asking for another is left out. */
  allowed: ReadonlySet<string>;
  /** What a refused region shows in its place, by scheme key; null shows nothing. */
  messages: Readonly<Record<string, string | null>>;
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
    </article>
  );
}

function Strip({ d, position, className = '' }: { d: RowPageData; position: Position; className?: string }) {
  const rows = rowsAt(d.document, position);
  if (rows.length === 0) return null;
  return (
    <div className={`grid gap-6 ${className}`}>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-12 gap-6">
          {row.map(r => (
            <div
              key={r.id}
              className="col-span-12 min-w-0 lg:[grid-column:var(--gc)]"
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
  const field = LIST_FIELD[region.listKey];
  const entries = (field ? d.nav[field] : []).filter(e => !e.authz || e.authz === 'public' || d.allowed.has(e.authz));
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
