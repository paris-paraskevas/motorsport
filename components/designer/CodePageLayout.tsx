'use client';

import type { PageRow } from '@/lib/design/pages';

// The Layout tab of a page the code serves, drawn as the approved designer
// draws a page (Paddock Designer v2.4: the page template's positions in order,
// a shared component named where the site renders one, the body as what the
// page is). A code page has no layout document: its body is one fixed region
// the code renders, and the header, the footer and the phone bar are the
// shared lists, edited under Shared Components and never here. Regions of the
// operator's own around the body arrive with a later step.

const POSITIONS: { key: string; label: string; note: string }[] = [
  { key: 'header', label: 'Header', note: 'above the page title, full width' },
  { key: 'pageheader', label: 'Page Header', note: 'the title block' },
  { key: 'body', label: 'Body', note: 'the page itself' },
  { key: 'right', label: 'Right Side Column', note: 'beside the body on wide screens' },
  { key: 'footer', label: 'Footer', note: 'above the site footer' },
  { key: 'phonebar', label: 'Phone Bar', note: 'the fixed bar on phones' },
];

function Shared({ name, sc }: { name: string; sc: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-border-strong bg-bg px-3 py-2">
      <div className="min-w-0">
        <div className="font-mono text-9 uppercase tracking-[0.12em] text-text-faint">Shared component</div>
        <div className="truncate text-12-5 font-semibold text-text">{name}</div>
      </div>
      <a
        href={`/admin/designer?sc=${sc}`}
        className="whitespace-nowrap border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted hover:border-text-muted hover:text-text"
      >
        Edit
      </a>
    </div>
  );
}

function Empty({ note }: { note: string }) {
  return <div className="border border-dashed border-border px-3 py-2 text-11 text-text-faint">{note}</div>;
}

export function CodePageLayout({ page }: { page: PageRow }) {
  const regionAt = (key: string) => {
    switch (key) {
      case 'header':
        return <Shared name="Navigation Menu · Doors" sc="doors" />;
      case 'pageheader':
        return <Empty note="The code's own title block." />;
      case 'body':
        return (
          <div className="border border-border-strong bg-bg px-3 py-2">
            <div className="font-mono text-9 uppercase tracking-[0.12em] text-text-faint">Served by the code · fixed · 12 columns</div>
            <div className="mt-0.5 text-12-5 font-semibold text-text">{page.name}</div>
            <div className="text-11 text-text-muted">The code renders this region and its content stays the code’s. Regions of your own around it arrive with a later step.</div>
          </div>
        );
      case 'right':
        return <Empty note="Empty. Regions of your own arrive with a later step." />;
      case 'footer':
        return <Shared name="Footer · site and legal" sc="footer-site" />;
      case 'phonebar':
        return <Shared name="Navigation Bar List" sc="bar" />;
      default:
        return null;
    }
  };
  return (
    <section aria-label="Layout" className="border border-border-strong bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-12">
        <span>
          <span className="font-semibold text-text">Page template</span> <span className="text-text-muted">· Paddock Standard</span>
        </span>
        <span className="font-mono text-11 text-text-muted">
          {page.path} · {page.rendering === 'dynamic' ? 'each visit' : 'cached'}
        </span>
      </div>
      <div className="grid gap-2 p-3">
        {POSITIONS.map(pos => (
          <div key={pos.key} className="grid grid-cols-[150px_minmax(0,1fr)] gap-4">
            <div>
              <div className="text-12 font-semibold text-text">{pos.label}</div>
              <div className="text-11 leading-snug text-text-faint">{pos.note}</div>
            </div>
            <div>{regionAt(pos.key)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
