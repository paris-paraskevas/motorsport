'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Bug, FilePen, House, Info, PaintRoller, Settings, SquareMousePointer, SquarePen, Timer, type LucideIcon } from 'lucide-react';
import { isAdmin } from '@/lib/threads';

// The runtime Developer Toolbar (APEX: the Developer Toolbar at the foot of a
// running page, UX map line 108; the operator's screenshots of 2026-09-10; R5).
// Mounted once in the app layout and drawn only for an administrator, after
// hydration, so the HTML readers get is the same cached render as before and a
// public page carries nothing of it. APEX's nine entries in APEX's order: Home,
// App, Page, Session, Debug, Quick Edit, Customize, Info, Options. Home, App and
// Page are live; an entry a later slot builds is disabled and says which.

interface PageLite {
  id: string | null;
  path: string;
  name: string;
}

/** A registry pattern (`/series/[slug]`) against a literal path: the rule of
 *  lib/design/page-document's patternMatches, kept here so that module (the
 *  parser and the catalogue) stays out of every page's public chunk. */
function matches(pattern: string, path: string): boolean {
  if (pattern === path) return true;
  const ps = pattern.split('/').filter(Boolean);
  const xs = path.split('/').filter(Boolean);
  for (let i = 0; i < ps.length; i++) {
    const seg = ps[i];
    if (/^\[\.\.\..+\]$/.test(seg)) return true;
    if (i >= xs.length) return false;
    if (/^\[.+\]$/.test(seg)) continue;
    if (seg !== xs[i]) return false;
  }
  return ps.length === xs.length;
}

const ENTRY =
  'flex items-center gap-1.5 border-r border-bg/20 px-3 py-2 font-mono text-10 uppercase tracking-[0.14em] transition-colors last:border-r-0 hover:bg-bg/10 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent';

function Entry({ icon: Icon, label, href, title, iconOnly = false }: { icon: LucideIcon; label: string; href?: string; title: string; iconOnly?: boolean }) {
  const inner = (
    <>
      <Icon size={14} aria-hidden="true" />
      <span className={iconOnly ? 'sr-only' : 'whitespace-nowrap'}>{label}</span>
    </>
  );
  // A plain anchor, not next/link: the designer is a full navigation and its chunk is not prefetched onto a public page.
  return href ? (
    <a href={href} className={ENTRY} title={title}>
      {inner}
    </a>
  ) : (
    <button type="button" className={ENTRY} title={title} disabled>
      {inner}
    </button>
  );
}

export function DeveloperToolbar() {
  const { isLoaded, user } = useUser();
  const pathname = usePathname() ?? '';
  const admin = isLoaded && isAdmin(user);
  const [pages, setPages] = useState<PageLite[] | null>(null);
  // The pages of the application, once, for an administrator only: which page this address is.
  useEffect(() => {
    if (!admin) return;
    let live = true;
    fetch('/api/admin/design/pages', { cache: 'no-store' })
      .then(r => (r.ok ? (r.json() as Promise<{ pages?: PageLite[] }>) : null))
      .then(body => {
        if (live) setPages(body?.pages ?? []);
      })
      .catch(() => {
        if (live) setPages([]);
      });
    return () => {
      live = false;
    };
  }, [admin]);
  if (!admin) return null;

  const preview = pathname.match(/^\/preview\/([0-9a-f]{8})[0-9a-f-]*$/);
  const page = pages?.find(p => p.path === pathname) ?? pages?.find(p => p.path.includes('[') && matches(p.path, pathname));
  return (
    <div
      role="region"
      aria-label="Developer toolbar"
      className="fixed bottom-3 left-1/2 z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-stretch overflow-x-auto rounded border border-text/40 bg-text text-bg shadow-lg print:hidden"
    >
      <Entry icon={House} label="Home" href="/admin/designer?ws=builder" title="App Builder home" />
      <Entry icon={SquarePen} label="App 100" href="/admin/designer?ws=shared&sc=appdef" title="Application Definition" />
      {page?.id ? (
        <Entry icon={FilePen} label={`Page ${page.id.slice(0, 8)}`} href={`/admin/designer?ws=builder&page=${page.id}`} title={`Edit ${page.name} in the designer`} />
      ) : (
        <Entry
          icon={FilePen}
          label={preview ? `Preview ${preview[1]}` : 'Page'}
          title={preview ? 'A revision preview: open the designer from its page' : pages === null ? 'Reading the pages…' : 'Not a page of the application'}
        />
      )}
      <Entry icon={Timer} label="Session" title="Session: no slot yet; Clerk holds the session" />
      <Entry icon={Bug} label="Debug" title="Debug arrives with P1.9" />
      <Entry icon={SquareMousePointer} label="Quick Edit" title="Quick Edit arrives with P1.7" />
      <Entry icon={PaintRoller} label="Customize" title="Customize (Theme Roller) arrives with P1.8" />
      <Entry icon={Info} label="Info" title="Info arrives with P1.7" iconOnly />
      <Entry icon={Settings} label="Options" title="Developer Toolbar Options arrive with P1.7" iconOnly />
    </div>
  );
}
