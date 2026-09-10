'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Bug, FilePen, House, Info, PaintRoller, Settings, SquareMousePointer, SquarePen, Timer, type LucideIcon } from 'lucide-react';
import { LEVEL_NAMES, keyOfLevel, levelFromKey, levelFromParam, type DebugLevel, type DebugReport, type OnLevel } from '@/lib/design/debug';
import { noteNavigation } from '@/lib/design/debug-client';

// The runtime Developer Toolbar (APEX: the Developer Toolbar at the foot of a
// running page, UX map line 108; the operator's screenshots of 2026-09-10; R5).
// Mounted once in the app layout and drawn only for an administrator, after
// hydration, so the HTML readers get is the same cached render as before and a
// public page carries nothing of it. APEX's nine entries in APEX's order: Home,
// App, Page, Session, Debug, Quick Edit, Customize, Info, Options. Home, App,
// Page and Debug (P1.9) are live; an entry a later slot builds is disabled and
// says which.

// The panel arrives only when View Debug asks for it: a public page's chunk carries the bar, not the report.
const DebugPanel = dynamic(() => import('./DebugPanel').then(m => m.DebugPanel), { ssr: false });

interface PageLite {
  id: string | null;
  path: string;
  name: string;
}

/** A registry pattern (`/series/[slug]`) against a literal path: the rule of
 *  lib/design/page-document's patternMatches, kept here so that module (the
 *  parser and the catalogue) stays out of every page's public chunk; the test
 *  pins the two together. */
export function matchesPattern(pattern: string, path: string): boolean {
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

// Debug (P1.9; APEX: the toolbar's Debug menu, UX map line 110). The level this
// tab keeps (APEX: the chosen mode persists while the tab stays open), or the
// address's `?debug=YES|LEVELn` for this visit; read in the browser only, so no
// cached page changes.
const DEBUG_KEY = 'pd-debug';
function readLevel(): DebugLevel {
  if (typeof window === 'undefined') return 0;
  const fromAddress = levelFromParam(new URLSearchParams(window.location.search).get('debug'));
  if (fromAddress) return fromAddress;
  try {
    return levelFromKey(window.sessionStorage.getItem(DEBUG_KEY));
  } catch {
    return 0;
  }
}
function storeLevel(level: DebugLevel): void {
  try {
    const key = keyOfLevel(level);
    if (key) window.sessionStorage.setItem(DEBUG_KEY, key);
    else window.sessionStorage.removeItem(DEBUG_KEY);
  } catch {
    /* no storage: the level lives for the page's life */
  }
}

const ENTRY =
  'flex items-center gap-1.5 border-r border-bg/20 px-3 py-2 font-mono text-10 uppercase tracking-[0.14em] transition-colors last:border-r-0 hover:bg-bg/10 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent aria-pressed:text-brand';
const MENU_ITEM =
  'block w-full px-3 py-1.5 text-left font-mono text-10 uppercase tracking-[0.12em] hover:bg-bg/10 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent aria-checked:text-brand';

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

function MenuItem({ label, onPick, disabled = false, checked }: { label: string; onPick: () => void; disabled?: boolean; checked?: boolean }) {
  return (
    <li role="none">
      <button type="button" role={checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={checked} disabled={disabled} className={MENU_ITEM} onClick={onPick}>
        {label}
      </button>
    </li>
  );
}

interface Trace {
  n: number;
  level: DebugLevel;
  path: string;
  report: DebugReport | null;
}

export function DeveloperToolbar() {
  const { isLoaded, user } = useUser();
  const pathname = usePathname() ?? '';
  // Clerk's publicMetadata.role, the source lib/threads.ts isAdmin() reads, checked inline as AppShell does: that module reaches the service-role database client and stays out of the public chunk.
  const admin = isLoaded && user?.publicMetadata?.role === 'admin';
  const [pages, setPages] = useState<PageLite[] | null>(null);
  const [level, setLevel] = useState<DebugLevel>(readLevel);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState(false);
  const [traceN, setTraceN] = useState(0);
  const [trace, setTrace] = useState<Trace | null>(null);
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
  // A new address in the same tab: the browser log starts over with the page.
  useEffect(() => {
    noteNavigation(pathname);
  }, [pathname]);
  // The trace: with debug on, the admin route runs this page's pipeline for the
  // visitor at the level (APEX: debug mode turns on for the requests that
  // follow); Refresh runs it again. The cached page readers get is untouched.
  useEffect(() => {
    if (!admin || level === 0) return;
    let live = true;
    const preview = pathname.match(/^\/preview\/([0-9a-f-]{36})$/);
    const q = preview ? `rev=${preview[1]}` : `path=${encodeURIComponent(pathname)}`;
    fetch(`/api/admin/design/debug?${q}&level=${keyOfLevel(level)}`, { cache: 'no-store' })
      .then(r => (r.ok ? (r.json() as Promise<DebugReport>) : null))
      .then(report => {
        if (live) setTrace({ n: traceN, level, path: pathname, report });
      })
      .catch(() => {
        if (live) setTrace({ n: traceN, level, path: pathname, report: null });
      });
    return () => {
      live = false;
    };
  }, [admin, level, pathname, traceN]);
  if (!admin) return null;

  const fresh = trace !== null && trace.n === traceN && trace.level === level && trace.path === pathname;
  const tracing = level > 0 && !fresh;
  const pick = (l: DebugLevel) => {
    setLevel(l);
    storeLevel(l);
    setMenu(false);
    if (l === 0) setPanel(false);
  };
  const preview = pathname.match(/^\/preview\/([0-9a-f]{8})[0-9a-f-]*$/);
  const page = pages?.find(p => p.path === pathname) ?? pages?.find(p => p.path.includes('[') && matchesPattern(p.path, pathname));
  return (
    <>
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
        <button
          type="button"
          className={ENTRY}
          aria-pressed={level > 0}
          aria-haspopup="menu"
          aria-expanded={menu}
          title={level > 0 ? `Debug: ${LEVEL_NAMES[level as OnLevel]}` : 'Debug'}
          onClick={() => setMenu(m => !m)}
        >
          <Bug size={14} aria-hidden="true" />
          <span className="whitespace-nowrap">Debug</span>
        </button>
        <Entry icon={SquareMousePointer} label="Quick Edit" title="Quick Edit arrives with P1.7" />
        <Entry icon={PaintRoller} label="Customize" title="Customize (Theme Roller) arrives with P1.8" />
        <Entry icon={Info} label="Info" title="Info arrives with P1.7" iconOnly />
        <Entry icon={Settings} label="Options" title="Developer Toolbar Options arrive with P1.7" iconOnly />
      </div>
      {menu && (
        // APEX: the Debug menu, UX map line 110: Enable Debug, No Debug, Info (default), App Trace, Full Trace, View Debug.
        // Outside the bar, which scrolls sideways on a narrow screen and would clip it; above the bar's middle, where Debug sits.
        <ul role="menu" aria-label="Debug" className="fixed bottom-16 left-1/2 z-50 grid min-w-44 -translate-x-1/2 list-none gap-0 border border-bg/30 bg-text p-1 text-bg shadow-lg">
          <MenuItem label="Enable Debug" disabled={level > 0} onPick={() => pick(4)} />
          <MenuItem label="No Debug" disabled={level === 0} onPick={() => pick(0)} />
          <li role="separator" className="my-1 border-t border-bg/20" />
          <MenuItem label="Info (default)" checked={level === 4} onPick={() => pick(4)} />
          <MenuItem label="App Trace" checked={level === 6} onPick={() => pick(6)} />
          <MenuItem label="Full Trace" checked={level === 9} onPick={() => pick(9)} />
          <li role="separator" className="my-1 border-t border-bg/20" />
          <MenuItem
            label="View Debug"
            disabled={level === 0}
            onPick={() => {
              setPanel(true);
              setMenu(false);
            }}
          />
        </ul>
      )}
      {panel && level > 0 && <DebugPanel report={fresh ? trace.report : null} loading={tracing} onRefresh={() => setTraceN(n => n + 1)} onClose={() => setPanel(false)} />}
    </>
  );
}
