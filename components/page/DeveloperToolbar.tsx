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
// Page, Debug (P1.9), Quick Edit, Info and Options (P1.7) are live; an entry a
// later slot builds is disabled and says which. Not drawn below the large
// breakpoint, and every link into the designer opens the one developer tab
// (the operator's asks of 2026-09-15).

// The panel, Quick Edit and the timing dialog arrive only when asked for: a public page's chunk carries the bar, not the report.
const DebugPanel = dynamic(() => import('./DebugPanel').then(m => m.DebugPanel), { ssr: false });
const QuickEdit = dynamic(() => import('./QuickEdit').then(m => m.QuickEdit), { ssr: false });
const PageTiming = dynamic(() => import('./PageTiming').then(m => m.PageTiming), { ssr: false });

/** The ONE developer tab (the operator, 2026-09-15: "the one tab i have for
 *  developing the app, not open another, same as when i save and run"): the
 *  designer names its own window so, and every link from the toolbar into the
 *  designer targets it, the way Save and Run targets its one running tab. A
 *  named target is found among the tabs familiar with this one (its opener and
 *  that opener's children), which is how the running tab Save and Run opened
 *  reaches the designer tab every time. */
export const DESIGNER_TAB = 'paddock-designer';

// Developer Toolbar Options (APEX: the gear at the far right: Auto Hide, Show
// Icons Only, Display Position), kept per browser under OPTIONS_KEY and read the
// way the Debug level is: the bar renders only once Clerk has said who the
// visitor is, so the first client render never differs from the server's nothing.
export const POSITIONS = ['top', 'left', 'bottom', 'right'] as const;
export type Position = (typeof POSITIONS)[number];
export interface ToolbarOptions {
  autoHide: boolean;
  iconsOnly: boolean;
  position: Position;
}
const OPTIONS_KEY = 'pd-toolbar';
const DEFAULT_OPTIONS: ToolbarOptions = { autoHide: false, iconsOnly: false, position: 'bottom' };
function readOptions(): ToolbarOptions {
  if (typeof window === 'undefined') return DEFAULT_OPTIONS;
  try {
    const raw = window.localStorage.getItem(OPTIONS_KEY);
    if (!raw) return DEFAULT_OPTIONS;
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      autoHide: o.autoHide === true,
      iconsOnly: o.iconsOnly === true,
      position: (POSITIONS as readonly string[]).includes(String(o.position)) ? (o.position as Position) : 'bottom',
    };
  } catch {
    return DEFAULT_OPTIONS;
  }
}
function storeOptions(o: ToolbarOptions): void {
  try {
    window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(o));
  } catch {
    /* no storage: the options live for the page's life */
  }
}
/** Where the bar sits, and how its menus anchor to it, per Display Position. */
const BAR_AT: Record<Position, string> = {
  bottom: 'bottom-3 left-1/2 -translate-x-1/2 flex-row max-w-[calc(100vw-24px)] overflow-x-auto',
  top: 'top-3 left-1/2 -translate-x-1/2 flex-row max-w-[calc(100vw-24px)] overflow-x-auto',
  left: 'left-3 top-1/2 -translate-y-1/2 flex-col max-h-[calc(100vh-24px)] overflow-y-auto [&>*]:border-r-0 [&>*]:border-b [&>*:last-child]:border-b-0',
  right: 'right-3 top-1/2 -translate-y-1/2 flex-col max-h-[calc(100vh-24px)] overflow-y-auto [&>*]:border-r-0 [&>*]:border-b [&>*:last-child]:border-b-0',
};
const MENU_AT: Record<Position, string> = {
  bottom: 'bottom-16 left-1/2 -translate-x-1/2',
  top: 'top-16 left-1/2 -translate-x-1/2',
  left: 'left-16 top-1/2 -translate-y-1/2',
  right: 'right-16 top-1/2 -translate-y-1/2',
};
/** Auto Hide: the bar slides to a thin handle at its edge until hovered or focused. */
const HIDE_AT: Record<Position, string> = {
  bottom: 'not-hover:not-focus-within:translate-y-[calc(100%-10px)] not-hover:not-focus-within:opacity-60',
  top: 'not-hover:not-focus-within:-translate-y-[calc(100%-10px)] not-hover:not-focus-within:opacity-60',
  left: 'not-hover:not-focus-within:-translate-x-[calc(100%-10px)] not-hover:not-focus-within:opacity-60',
  right: 'not-hover:not-focus-within:translate-x-[calc(100%-10px)] not-hover:not-focus-within:opacity-60',
};
const POSITION_LABELS: Record<Position, string> = { top: 'Top', left: 'Left', bottom: 'Bottom', right: 'Right' };

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

function Entry({ icon: Icon, label, href, target, title, iconOnly = false }: { icon: LucideIcon; label: string; href?: string; target?: string; title: string; iconOnly?: boolean }) {
  const inner = (
    <>
      <Icon size={14} aria-hidden="true" />
      <span className={iconOnly ? 'sr-only' : 'whitespace-nowrap'}>{label}</span>
    </>
  );
  // A plain anchor, not next/link: the designer is a full navigation and its chunk is not prefetched onto a public page.
  // No noopener: the named target is reused only by an opener that keeps the name (as Save and Run's running tab).
  return href ? (
    <a href={href} target={target} className={ENTRY} title={title}>
      {inner}
    </a>
  ) : (
    <button type="button" className={ENTRY} title={title} disabled>
      {inner}
    </button>
  );
}

/** A menu entry: plain, or checkable as a radio (one of a set) or a checkbox (on or off). */
function MenuItem({ label, onPick, disabled = false, checked, kind = 'radio' }: { label: string; onPick: () => void; disabled?: boolean; checked?: boolean; kind?: 'radio' | 'checkbox' }) {
  return (
    <li role="none">
      <button
        type="button"
        role={checked === undefined ? 'menuitem' : kind === 'checkbox' ? 'menuitemcheckbox' : 'menuitemradio'}
        aria-checked={checked}
        disabled={disabled}
        className={MENU_ITEM}
        onClick={onPick}
      >
        {label}
      </button>
    </li>
  );
}

type OpenMenu = 'debug' | 'quick' | 'info' | 'options' | null;

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
  const [menu, setMenu] = useState<OpenMenu>(null);
  const [panel, setPanel] = useState(false);
  const [traceN, setTraceN] = useState(0);
  const [trace, setTrace] = useState<Trace | null>(null);
  // P1.7: Quick Edit's mode (a moment, never stored), the Info overlays, the Options.
  const [mode, setMode] = useState<'jump' | 'live' | null>(null);
  const [columns, setColumns] = useState(false);
  const [timing, setTiming] = useState(false);
  const [options, setOptions] = useState<ToolbarOptions>(readOptions);
  // A pick applies and closes the menu, as every menu here does.
  const setOption = (patch: Partial<ToolbarOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    storeOptions(next);
    setMenu(null);
  };
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
    setMenu(null);
    if (l === 0) setPanel(false);
  };
  const toggleMenu = (which: Exclude<OpenMenu, null>) => setMenu(m => (m === which ? null : which));
  const toggleMode = (which: 'jump' | 'live') => {
    setMode(m => (m === which ? null : which));
    setMenu(null);
  };
  const preview = pathname.match(/^\/preview\/([0-9a-f]{8})[0-9a-f-]*$/);
  const page = pages?.find(p => p.path === pathname) ?? pages?.find(p => p.path.includes('[') && matchesPattern(p.path, pathname));
  const pos = options.position;
  const MENU = `fixed z-50 grid min-w-44 list-none gap-0 border border-bg/30 bg-text p-1 text-bg shadow-lg ${MENU_AT[pos]}`;
  const noPage = !page?.id;
  const noPageTitle = preview ? 'A revision preview: open the designer from its page' : pages === null ? 'Reading the pages…' : 'Not a page of the application';
  // One root for everything the toolbar draws (the bar, its menus, the panel,
  // the overlays): out of the layout below the large breakpoint (the operator,
  // 2026-09-15: "the bar shouldnt show on mobile for me"), and `contents` above
  // it so the root itself takes no space.
  return (
    <div className="max-lg:hidden lg:contents" data-developer-toolbar="">
      <div
        role="region"
        aria-label="Developer toolbar"
        data-position={pos}
        data-autohide={options.autoHide ? 'true' : undefined}
        className={`fixed z-40 flex items-stretch rounded border border-text/40 bg-text text-bg shadow-lg transition-[transform,opacity] duration-(--duration-fast) print:hidden ${BAR_AT[pos]} ${options.autoHide ? HIDE_AT[pos] : ''}`}
      >
        <Entry icon={House} label="Home" href="/admin/designer?ws=builder" target={DESIGNER_TAB} title="App Builder home" iconOnly={options.iconsOnly} />
        <Entry icon={SquarePen} label="App 100" href="/admin/designer?ws=shared&sc=appdef" target={DESIGNER_TAB} title="Application Definition" iconOnly={options.iconsOnly} />
        {page?.id ? (
          <Entry
            icon={FilePen}
            label={`Page ${page.id.slice(0, 8)}`}
            href={`/admin/designer?ws=builder&page=${page.id}`}
            target={DESIGNER_TAB}
            title={`Edit ${page.name} in the designer`}
            iconOnly={options.iconsOnly}
          />
        ) : (
          <Entry icon={FilePen} label={preview ? `Preview ${preview[1]}` : 'Page'} title={noPageTitle} iconOnly={options.iconsOnly} />
        )}
        <Entry icon={Timer} label="Session" title="Session: no slot yet; Clerk holds the session" iconOnly={options.iconsOnly} />
        <button
          type="button"
          className={ENTRY}
          aria-pressed={level > 0}
          aria-haspopup="menu"
          aria-expanded={menu === 'debug'}
          title={level > 0 ? `Debug: ${LEVEL_NAMES[level as OnLevel]}` : 'Debug'}
          onClick={() => toggleMenu('debug')}
        >
          <Bug size={14} aria-hidden="true" />
          <span className={options.iconsOnly ? 'sr-only' : 'whitespace-nowrap'}>Debug</span>
        </button>
        <button
          type="button"
          className={ENTRY}
          aria-pressed={mode !== null}
          aria-haspopup="menu"
          aria-expanded={menu === 'quick'}
          disabled={noPage}
          title={noPage ? noPageTitle : mode === 'jump' ? 'Quick Edit Mode is on' : mode === 'live' ? 'Edit Live Template Options is on' : 'Quick Edit'}
          onClick={() => toggleMenu('quick')}
        >
          <SquareMousePointer size={14} aria-hidden="true" />
          <span className={options.iconsOnly ? 'sr-only' : 'whitespace-nowrap'}>Quick Edit</span>
        </button>
        <Entry icon={PaintRoller} label="Customize" title="Customize (Theme Roller) arrives with P1.8" iconOnly={options.iconsOnly} />
        <button type="button" className={ENTRY} aria-haspopup="menu" aria-expanded={menu === 'info'} aria-pressed={columns} title="Info" onClick={() => toggleMenu('info')}>
          <Info size={14} aria-hidden="true" />
          <span className="sr-only">Info</span>
        </button>
        <button type="button" className={ENTRY} aria-haspopup="menu" aria-expanded={menu === 'options'} title="Developer Toolbar Options" onClick={() => toggleMenu('options')}>
          <Settings size={14} aria-hidden="true" />
          <span className="sr-only">Options</span>
        </button>
      </div>
      {menu === 'debug' && (
        // APEX: the Debug menu, UX map line 110: Enable Debug, No Debug, Info (default), App Trace, Full Trace, View Debug.
        // Outside the bar, which scrolls sideways on a narrow screen and would clip it; anchored to the bar's edge.
        <ul role="menu" aria-label="Debug" className={MENU}>
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
              setMenu(null);
            }}
          />
        </ul>
      )}
      {menu === 'quick' && (
        // APEX: the Quick Edit menu: Quick Edit Mode, Edit Live Template Options. Each turns on and off (the operator: hideable).
        <ul role="menu" aria-label="Quick Edit" className={MENU}>
          <MenuItem label="Quick Edit Mode" kind="checkbox" checked={mode === 'jump'} onPick={() => toggleMode('jump')} />
          <MenuItem label="Edit Live Template Options" kind="checkbox" checked={mode === 'live'} onPick={() => toggleMode('live')} />
        </ul>
      )}
      {menu === 'info' && (
        // APEX: the Info menu: Show Layout Columns / Hide Layout Columns, Show Page Timing (Show Landmarks and Show Headings wait for a dated line).
        <ul role="menu" aria-label="Info" className={MENU}>
          <MenuItem
            label={columns ? 'Hide Layout Columns' : 'Show Layout Columns'}
            kind="checkbox"
            checked={columns}
            onPick={() => {
              setColumns(c => !c);
              setMenu(null);
            }}
          />
          <MenuItem
            label="Show Page Timing"
            onPick={() => {
              setTiming(true);
              setMenu(null);
            }}
          />
        </ul>
      )}
      {menu === 'options' && (
        // APEX: Developer Toolbar Options: Auto Hide, Show Icons Only, Display Position (Top, Left, Bottom, Right).
        <ul role="menu" aria-label="Developer Toolbar Options" className={MENU}>
          <MenuItem label="Auto Hide" kind="checkbox" checked={options.autoHide} onPick={() => setOption({ autoHide: !options.autoHide })} />
          <MenuItem label="Show Icons Only" kind="checkbox" checked={options.iconsOnly} onPick={() => setOption({ iconsOnly: !options.iconsOnly })} />
          <li role="separator" className="my-1 border-t border-bg/20" />
          <li role="none" className="px-3 pb-0.5 pt-1 font-mono text-9 uppercase tracking-[0.12em] text-bg/60">
            Display Position
          </li>
          {POSITIONS.map(p => (
            <MenuItem key={p} label={POSITION_LABELS[p]} checked={pos === p} onPick={() => setOption({ position: p })} />
          ))}
        </ul>
      )}
      {panel && level > 0 && <DebugPanel report={fresh ? trace.report : null} loading={tracing} onRefresh={() => setTraceN(n => n + 1)} onClose={() => setPanel(false)} />}
      {columns && (
        // APEX: Show Layout Columns draws the grid over the page. The site's twelve columns inside the standard width's paddings (PAGE_WIDE, lib/site.ts), the rows' gap.
        <div aria-hidden="true" data-layout-columns="" className="pointer-events-none fixed inset-0 z-30 px-4 md:px-6 lg:px-8">
          <div className="grid h-full grid-cols-12 gap-6">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} data-layout-column="" className="border-x border-brand/40 bg-brand/10" />
            ))}
          </div>
        </div>
      )}
      {mode && page?.id && <QuickEdit mode={mode} pageId={page.id} designerTab={DESIGNER_TAB} onExit={() => setMode(null)} />}
      {timing && <PageTiming onClose={() => setTiming(false)} />}
    </div>
  );
}
