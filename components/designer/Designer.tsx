'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ConsoleModeToggle } from '@/components/designer/ConsoleMode';
import { SITE_URL } from '@/lib/site';
import type { EditableList, ListSummary, NavListKey } from '@/lib/design/lists';
import type { EditableText } from '@/lib/design/text';
import type { ChromeText } from '@/lib/design/text-defaults';
import type { EditableBuildOption } from '@/lib/design/build-options';
import type { EditableSetting } from '@/lib/design/settings';
import { APPLICATION_SETTING_KEYS, COMPONENT_SETTING_KEYS, DEFAULT_SETTINGS } from '@/lib/design/setting-defaults';
import { SHIPPED_REGION_DEFAULTS, type RegionDefaults } from './page-designer-model';
import type { EditableAuthzScheme } from '@/lib/design/authz';
import type { EditableTheme } from '@/lib/design/themes';
import type { EditableAppearance } from '@/lib/design/appearance';
import type { EditableShortcut } from '@/lib/design/shortcuts';
import type { EditableAsset } from '@/lib/design/assets';
import type { EditableSearchHint } from '@/lib/design/search-hints';
import type { EditableApplication } from '@/lib/design/application';
import type { PageRow } from '@/lib/design/pages';
import type { PageDetail } from '@/lib/design/page-revisions';
import { CATALOGUE, LIST_COPY, type CatalogueItem } from './catalogue';
import { SharedRail } from './Rails';
import { PagesList, type PageFilter } from './PagesList';
import { PageDesigner } from './PageDesigner';
import { ListEditor } from './ListEditor';
import { ListsEditor } from './ListsEditor';
import { TextEditor } from './TextEditor';
import { BuildOptionsEditor } from './BuildOptionsEditor';
import { SettingsEditor, type SeriesOption } from './SettingsEditor';
import { AuthzEditor } from './AuthzEditor';
import { ThemesEditor } from './ThemesEditor';
import { AppearanceEditor } from './AppearanceEditor';
import { TemplatesEditor } from './TemplatesEditor';
import { ShortcutsEditor } from './ShortcutsEditor';
import { AssetsEditor } from './AssetsEditor';
import { SearchHintsEditor } from './SearchHintsEditor';
import { ApplicationDefinitionEditor } from './ApplicationDefinitionEditor';
import { ComputationsView } from './ComputationsView';
import { DataWorkspace } from './DataWorkspace';
import { DESIGNER_TAB } from '@/components/page/DeveloperToolbar';

// Paddock Developer: the designer's shell in the prototype's shape (2026-09-07,
// v2.4): the workspace header, the crumbs bar, and for Shared Components a
// 300-pixel catalogue beside the editor. The App Builder follows the
// prototype's home (the pages report, full width) and its Page Designer (the
// three panes under the toolbar, full width, PageDesigner.tsx); it has no rail
// (the operator, 2026-09-09: "the app builder takes precedent"). Full viewport
// over the console; the arrow at the top left goes back.
//
// Phase 2 opened the four navigation lists (step 2), Text Messages (step 3),
// Build Options (step 4), Application Settings (step 5), Authorization Schemes
// (step 6) and Themes (step 7). Everything else in the catalogue is listed with
// the phase that brings it: the operator sees the whole shape, and nothing
// pretends to be editable before it is. App Builder and Data are the next
// workspaces.
//
// This file is loaded as a browser-only chunk (DesignerLoader.tsx), so the
// editor never enters the Worker bundle.

type Loaded =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; list: EditableList };

const LIST_KEYS: NavListKey[] = ['doors', 'bar', 'footer-site', 'footer-legal'];
const ROLE_OF: Record<NavListKey, 'menu' | 'bar' | 'footer'> = {
  doors: 'menu',
  bar: 'bar',
  'footer-site': 'footer',
  'footer-legal': 'footer',
};

type LoadedText =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; messages: EditableText[] };

async function fetchList(key: NavListKey): Promise<Loaded> {
  try {
    const res = await fetch(`/api/admin/design/lists/${key}`, { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The list could not be loaded (HTTP ${res.status}).` };
    return { state: 'ready', list: (await res.json()) as EditableList };
  } catch {
    return { state: 'error', message: 'The list could not be loaded: network error.' };
  }
}

type LoadedIndex =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; lists: ListSummary[] };

/** Every list with its entry count: the Lists page and the Page Designer's picker. */
async function fetchListIndex(): Promise<LoadedIndex> {
  try {
    const res = await fetch('/api/admin/design/lists', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The lists could not be loaded (HTTP ${res.status}).` };
    const d = (await res.json()) as { lists: ListSummary[] };
    return { state: 'ready', lists: d.lists };
  } catch {
    return { state: 'error', message: 'The lists could not be loaded: network error.' };
  }
}

async function fetchText(): Promise<LoadedText> {
  try {
    const res = await fetch('/api/admin/design/text', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The messages could not be loaded (HTTP ${res.status}).` };
    const d = (await res.json()) as { messages: EditableText[] };
    return { state: 'ready', messages: d.messages };
  } catch {
    return { state: 'error', message: 'The messages could not be loaded: network error.' };
  }
}

type LoadedBuild =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; options: EditableBuildOption[] };

async function fetchBuildOptions(): Promise<LoadedBuild> {
  try {
    const res = await fetch('/api/admin/design/build-options', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The build options could not be loaded (HTTP ${res.status}).` };
    const d = (await res.json()) as { options: EditableBuildOption[] };
    return { state: 'ready', options: d.options };
  } catch {
    return { state: 'error', message: 'The build options could not be loaded: network error.' };
  }
}

type LoadedSettings =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; settings: EditableSetting[] };

async function fetchSettings(): Promise<LoadedSettings> {
  try {
    const res = await fetch('/api/admin/design/settings', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The settings could not be loaded (HTTP ${res.status}).` };
    const d = (await res.json()) as { settings: EditableSetting[] };
    return { state: 'ready', settings: d.settings };
  } catch {
    return { state: 'error', message: 'The settings could not be loaded: network error.' };
  }
}

type LoadedAuthz =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; schemes: EditableAuthzScheme[] };

async function fetchAuthz(): Promise<LoadedAuthz> {
  try {
    const res = await fetch('/api/admin/design/authz', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The schemes could not be loaded (HTTP ${res.status}).` };
    const d = (await res.json()) as { schemes: EditableAuthzScheme[] };
    return { state: 'ready', schemes: d.schemes };
  } catch {
    return { state: 'error', message: 'The schemes could not be loaded: network error.' };
  }
}

type LoadedThemes =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; themes: EditableTheme[] };

async function fetchThemes(): Promise<LoadedThemes> {
  try {
    const res = await fetch('/api/admin/design/themes', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The themes could not be loaded (HTTP ${res.status}).` };
    const d = (await res.json()) as { themes: EditableTheme[] };
    return { state: 'ready', themes: d.themes };
  } catch {
    return { state: 'error', message: 'The themes could not be loaded: network error.' };
  }
}

type LoadedAppearance =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; loaded: EditableAppearance };

async function fetchAppearance(): Promise<LoadedAppearance> {
  try {
    const res = await fetch('/api/admin/design/appearance', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The appearance could not be loaded (HTTP ${res.status}).` };
    return { state: 'ready', loaded: (await res.json()) as EditableAppearance };
  } catch {
    return { state: 'error', message: 'The appearance could not be loaded: network error.' };
  }
}

type LoadedShortcuts =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; shortcuts: EditableShortcut[] };

async function fetchShortcuts(): Promise<LoadedShortcuts> {
  try {
    const res = await fetch('/api/admin/design/shortcuts', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The shortcuts could not be loaded (HTTP ${res.status}).` };
    const d = (await res.json()) as { shortcuts: EditableShortcut[] };
    return { state: 'ready', shortcuts: d.shortcuts };
  } catch {
    return { state: 'error', message: 'The shortcuts could not be loaded: network error.' };
  }
}

type LoadedAssets =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; assets: EditableAsset[]; mediaConfigured: boolean };

async function fetchAssets(): Promise<LoadedAssets> {
  try {
    const res = await fetch('/api/admin/design/assets', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The assets could not be loaded (HTTP ${res.status}).` };
    const d = (await res.json()) as { assets: EditableAsset[]; mediaConfigured: boolean };
    return { state: 'ready', assets: d.assets, mediaConfigured: d.mediaConfigured };
  } catch {
    return { state: 'error', message: 'The assets could not be loaded: network error.' };
  }
}

type LoadedSearchHints =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; hints: EditableSearchHint[] };

async function fetchSearchHints(): Promise<LoadedSearchHints> {
  try {
    const res = await fetch('/api/admin/design/search-hints', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The search hints could not be loaded (HTTP ${res.status}).` };
    const d = (await res.json()) as { hints: EditableSearchHint[] };
    return { state: 'ready', hints: d.hints };
  } catch {
    return { state: 'error', message: 'The search hints could not be loaded: network error.' };
  }
}

type LoadedApplication =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; loaded: EditableApplication };

async function fetchApplication(): Promise<LoadedApplication> {
  try {
    const res = await fetch('/api/admin/design/application', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The application definition could not be loaded (HTTP ${res.status}).` };
    return { state: 'ready', loaded: (await res.json()) as EditableApplication };
  } catch {
    return { state: 'error', message: 'The application definition could not be loaded: network error.' };
  }
}

type LoadedPages =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; pages: PageRow[] };

async function fetchPages(): Promise<LoadedPages> {
  try {
    const res = await fetch('/api/admin/design/pages', { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The pages could not be loaded (HTTP ${res.status}).` };
    const d = (await res.json()) as { pages: PageRow[] };
    return { state: 'ready', pages: d.pages };
  } catch {
    return { state: 'error', message: 'The pages could not be loaded: network error.' };
  }
}

type LoadedDetail =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; detail: PageDetail };

async function fetchDetail(id: string): Promise<LoadedDetail> {
  try {
    const res = await fetch(`/api/admin/design/pages/${id}`, { cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: `The page could not be loaded (HTTP ${res.status}).` };
    return { state: 'ready', detail: (await res.json()) as PageDetail };
  } catch {
    return { state: 'error', message: 'The page could not be loaded: network error.' };
  }
}

/** The three workspaces: Data (Phase 4) reads the outside services. The App Builder lists the
 *  pages (Phase 3 step 1) and opens one (step 2); Shared Components holds the
 *  catalogue and its editors. */
export type Workspace = 'builder' | 'shared' | 'data';

export function Designer({
  readOnly,
  who,
  initialSelected = null,
  initialLists,
  initialListIndex,
  initialText,
  initialBuildOptions,
  initialSettings,
  initialAuthz,
  initialThemes,
  initialAppearance,
  initialShortcuts,
  initialAssets,
  mediaConfigured = false,
  initialSearchHints,
  initialApplication,
  initialPages,
  initialWorkspace = 'shared',
  initialPageId = null,
  initialDetail = null,
  initialRegion = null,
  series = [],
}: {
  readOnly: boolean;
  who: string;
  /** A catalogue key to open on, from `?sc=` on the page. Unknown keys open the overview. */
  initialSelected?: string | null;
  /** The pages the server already loaded; fetched when absent. */
  initialPages?: PageRow[] | null;
  /** The workspace to open on, from `?ws=` on the page. */
  initialWorkspace?: Workspace;
  /** A page to open in the App Builder, from `?page=` on the page. */
  initialPageId?: string | null;
  /** That page's detail when the server already loaded it; fetched when absent. */
  initialDetail?: PageDetail | null;
  /** A region of that page to open on, from `?region=` (P1.7: Quick Edit lands on the region). */
  initialRegion?: string | null;
  /** Lists the server already loaded, so opening needs no round trip; any list
   *  missing here is fetched. */
  initialLists?: Partial<Record<NavListKey, EditableList>>;
  /** Every list with its entry count, as the server loaded it; fetched when absent. */
  initialListIndex?: ListSummary[] | null;
  /** The text messages the server already loaded; fetched when absent. */
  initialText?: EditableText[] | null;
  /** The build options the server already loaded; fetched when absent. */
  initialBuildOptions?: EditableBuildOption[] | null;
  /** The application settings the server already loaded; fetched when absent. */
  initialSettings?: EditableSetting[] | null;
  /** The authorization schemes the server already loaded; fetched when absent. */
  initialAuthz?: EditableAuthzScheme[] | null;
  /** The themes the server already loaded; fetched when absent. */
  initialThemes?: EditableTheme[] | null;
  /** The appearance the server already loaded; fetched when absent. */
  initialAppearance?: EditableAppearance | null;
  /** The shortcuts the server already loaded; fetched when absent. */
  initialShortcuts?: EditableShortcut[] | null;
  /** The assets the server already loaded; fetched when absent. */
  initialAssets?: EditableAsset[] | null;
  /** Whether this Worker has the media binding (uploads and photos need it). */
  mediaConfigured?: boolean;
  /** The search hints the server already loaded; fetched when absent. */
  initialSearchHints?: EditableSearchHint[] | null;
  /** The application definition the server already loaded; fetched when absent. */
  initialApplication?: EditableApplication | null;
  /** The championships the settings editor offers in its series controls. */
  series?: SeriesOption[];
}) {
  const [text, setText] = useState<LoadedText>(() =>
    initialText ? { state: 'ready', messages: initialText } : { state: 'loading' },
  );
  const [build, setBuild] = useState<LoadedBuild>(() =>
    initialBuildOptions ? { state: 'ready', options: initialBuildOptions } : { state: 'loading' },
  );
  const [settings, setSettings] = useState<LoadedSettings>(() =>
    initialSettings ? { state: 'ready', settings: initialSettings } : { state: 'loading' },
  );
  const [authz, setAuthz] = useState<LoadedAuthz>(() =>
    initialAuthz ? { state: 'ready', schemes: initialAuthz } : { state: 'loading' },
  );
  const [themes, setThemes] = useState<LoadedThemes>(() =>
    initialThemes ? { state: 'ready', themes: initialThemes } : { state: 'loading' },
  );
  const [appearance, setAppearance] = useState<LoadedAppearance>(() =>
    initialAppearance ? { state: 'ready', loaded: initialAppearance } : { state: 'loading' },
  );
  const [shortcuts, setShortcuts] = useState<LoadedShortcuts>(() =>
    initialShortcuts ? { state: 'ready', shortcuts: initialShortcuts } : { state: 'loading' },
  );
  const [assets, setAssets] = useState<LoadedAssets>(() =>
    initialAssets ? { state: 'ready', assets: initialAssets, mediaConfigured } : { state: 'loading' },
  );
  const [pages, setPages] = useState<LoadedPages>(() =>
    initialPages ? { state: 'ready', pages: initialPages } : { state: 'loading' },
  );
  const [searchHints, setSearchHints] = useState<LoadedSearchHints>(() =>
    initialSearchHints ? { state: 'ready', hints: initialSearchHints } : { state: 'loading' },
  );
  const [application, setApplication] = useState<LoadedApplication>(() =>
    initialApplication ? { state: 'ready', loaded: initialApplication } : { state: 'loading' },
  );
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [catalogueQuery, setCatalogueQuery] = useState('');
  const [openPage, setOpenPage] = useState<string | null>(initialPageId);
  /** The region the address named (P1.7), for the page it was opened with alone. */
  const [regionOnce, setRegionOnce] = useState<string | null>(initialRegion);
  /** The pages list's filter when the designer returns to it (Create › Page Group… › show, P1.10). */
  const [pagesFilter, setPagesFilter] = useState<PageFilter>('all');
  const [detail, setDetail] = useState<LoadedDetail>(() =>
    initialDetail ? { state: 'ready', detail: initialDetail } : { state: 'loading' },
  );
  const [selected, setSelected] = useState<string | null>(() =>
    initialSelected && CATALOGUE.some(g => g.items.some(i => i.key === initialSelected)) ? initialSelected : null,
  );
  const [lists, setLists] = useState<Partial<Record<NavListKey, Loaded>>>(() =>
    Object.fromEntries(
      LIST_KEYS.map(k => {
        const given = initialLists?.[k];
        return [k, given ? { state: 'ready', list: given } : { state: 'loading' }];
      }),
    ),
  );
  const [listIndex, setListIndex] = useState<LoadedIndex>(() =>
    initialListIndex ? { state: 'ready', lists: initialListIndex } : { state: 'loading' },
  );

  // All four lists on open: the overview shows their counts, and the footer
  // preview needs the column that is not being edited. Only the ones the server
  // did not hand over are fetched.
  useEffect(() => {
    let cancelled = false;
    for (const key of LIST_KEYS) {
      if (initialLists?.[key]) continue;
      void fetchList(key).then(loaded => {
        if (!cancelled) setLists(s => ({ ...s, [key]: loaded }));
      });
    }
    if (!initialListIndex) {
      void fetchListIndex().then(loaded => {
        if (!cancelled) setListIndex(loaded);
      });
    }
    if (!initialText) {
      void fetchText().then(loaded => {
        if (!cancelled) setText(loaded);
      });
    }
    if (!initialBuildOptions) {
      void fetchBuildOptions().then(loaded => {
        if (!cancelled) setBuild(loaded);
      });
    }
    if (!initialSettings) {
      void fetchSettings().then(loaded => {
        if (!cancelled) setSettings(loaded);
      });
    }
    if (!initialAuthz) {
      void fetchAuthz().then(loaded => {
        if (!cancelled) setAuthz(loaded);
      });
    }
    if (!initialThemes) {
      void fetchThemes().then(loaded => {
        if (!cancelled) setThemes(loaded);
      });
    }
    if (!initialAppearance) {
      void fetchAppearance().then(loaded => {
        if (!cancelled) setAppearance(loaded);
      });
    }
    if (!initialShortcuts) {
      void fetchShortcuts().then(loaded => {
        if (!cancelled) setShortcuts(loaded);
      });
    }
    if (!initialAssets) {
      void fetchAssets().then(loaded => {
        if (!cancelled) setAssets(loaded);
      });
    }
    if (!initialPages) {
      void fetchPages().then(loaded => {
        if (!cancelled) setPages(loaded);
      });
    }
    if (!initialSearchHints) {
      void fetchSearchHints().then(loaded => {
        if (!cancelled) setSearchHints(loaded);
      });
    }
    if (!initialApplication) {
      void fetchApplication().then(loaded => {
        if (!cancelled) setApplication(loaded);
      });
    }
    if (initialPageId && !initialDetail) {
      void fetchDetail(initialPageId).then(loaded => {
        if (!cancelled) setDetail(loaded);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [initialLists, initialListIndex, initialText, initialBuildOptions, initialSettings, initialAuthz, initialThemes, initialAppearance, initialShortcuts, initialAssets, initialPages, initialSearchHints, initialApplication, initialPageId, initialDetail]);

  // The selection lives in the URL too (`?sc=`), written with the browser's own
  // replaceState, which Next's router integrates: a refresh reopens the same
  // editor, and the back arrow still goes straight to the console because
  // nothing was pushed. Null returns to the overview.
  const select = (key: string | null) => {
    setSelected(key);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (key) url.searchParams.set('sc', key);
    else url.searchParams.delete('sc');
    window.history.replaceState(null, '', url);
  };
  // The workspace lives in the URL the same way (`?ws=builder`); Shared
  // Components is the default and carries no parameter.
  const selectWorkspace = (ws: Workspace) => {
    setWorkspace(ws);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (ws === 'builder' || ws === 'data') {
      url.searchParams.set('ws', ws);
      if (ws === 'data') url.searchParams.delete('page');
    } else {
      url.searchParams.delete('ws');
      url.searchParams.delete('page');
    }
    window.history.replaceState(null, '', url);
  };
  // An open page lives in the URL too (`?page=<id>`), fetched when opened. A
  // region named on the address (`?region=`, P1.7) belongs to the page that was
  // opened with it and leaves the address with any page change.
  const openPageDetail = (id: string | null) => {
    setOpenPage(id);
    // The address's region is spent with the page it came with: a page opened later starts on the page (the reviewer's gap).
    setRegionOnce(null);
    if (id) {
      setDetail({ state: 'loading' });
      void fetchDetail(id).then(loaded => setDetail(loaded));
    }
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('page', id);
    else url.searchParams.delete('page');
    url.searchParams.delete('region');
    window.history.replaceState(null, '', url);
  };
  // This tab is the ONE developer tab (P1.7; the operator, 2026-09-15): named so
  // that the toolbar's links from a running page find it, the way Save and Run's
  // running tab is found by its name.
  useEffect(() => {
    window.name = DESIGNER_TAB;
  }, []);

  const item: CatalogueItem | undefined = selected
    ? CATALOGUE.flatMap(g => g.items).find(i => i.key === selected)
    : undefined;
  const listKey = item?.listKey;

  const count = (key: NavListKey): number | null => {
    const l = lists[key];
    return l && l.state === 'ready' ? l.list.entries.length : null;
  };
  const textCount = text.state === 'ready' ? text.messages.length : null;
  const buildCount = build.state === 'ready' ? build.options.length : null;
  const settingsCount = settings.state === 'ready' ? settings.settings.length : null;
  const authzCount = authz.state === 'ready' ? authz.schemes.length : null;
  const themesCount = themes.state === 'ready' ? themes.themes.length : null;
  const shortcutsCount = shortcuts.state === 'ready' ? shortcuts.shortcuts.length : null;
  const assetsCount = assets.state === 'ready' ? assets.assets.length : null;
  const searchHintsCount = searchHints.state === 'ready' ? searchHints.hints.length : null;
  // The footer preview shows the strings as they are stored right now, and the
  // lists' authorization select offers the schemes as they are stored right now.
  const chromeText: ChromeText | undefined =
    text.state === 'ready'
      ? (Object.fromEntries(text.messages.map(m => [m.key, m.text])) as ChromeText)
      : undefined;
  const schemes = authz.state === 'ready' ? authz.schemes : undefined;
  const badge = (it: CatalogueItem): number | null =>
    it.listKey
      ? count(it.listKey)
      : it.editor === 'text'
        ? textCount
        : it.editor === 'build'
          ? buildCount
          : it.editor === 'settings'
            ? settingsCount
            : it.editor === 'authz'
              ? authzCount
              : it.editor === 'themes'
                ? themesCount
                : it.editor === 'shortcuts'
                  ? shortcutsCount
                  : it.editor === 'assets'
                    ? assetsCount
                    : it.editor === 'searchhints'
                      ? searchHintsCount
                      : null;
  const stored = (key: NavListKey) => {
    const l = lists[key];
    return l && l.state === 'ready' ? l.list.entries : [];
  };
  // The Page Designer's List region picks from every list: the index when it
  // has arrived, the shell's four until then.
  const pdLists =
    listIndex.state === 'ready'
      ? listIndex.lists.map(l => ({ key: l.key, label: l.label }))
      : LIST_KEYS.map(k => ({ key: k, label: LIST_COPY[k].title }));
  const listCounts =
    listIndex.state === 'ready'
      ? Object.fromEntries(listIndex.lists.map(l => [l.key, l.entries]))
      : Object.fromEntries(LIST_KEYS.map(k => [k, count(k) ?? 0]));
  // What a new region starts with: Component Settings as stored, the shipped
  // values until they have loaded or when a row is missing.
  const regionDefaults: RegionDefaults = (() => {
    if (settings.state !== 'ready') return SHIPPED_REGION_DEFAULTS;
    const v = <K extends keyof typeof DEFAULT_SETTINGS>(key: K): (typeof DEFAULT_SETTINGS)[K] =>
      (settings.settings.find(s => s.key === key)?.value as (typeof DEFAULT_SETTINGS)[K] | undefined) ?? DEFAULT_SETTINGS[key];
    return { imageShowCaption: v('region.image.show_caption'), listStyle: v('region.list.style'), buttonLabel: v('region.button.label') };
  })();
  /** A shell list saved in its own entry: the index's count and stamp follow. */
  const indexFollows = (list: EditableList) =>
    setListIndex(s => (s.state === 'ready' ? { state: 'ready', lists: s.lists.map(l => (l.key === list.key ? { ...l, updatedAt: list.updatedAt, entries: list.entries.length } : l)) } : s));
  const themeDefault = themes.state === 'ready' ? (themes.themes.find(t => t.isDefault)?.label ?? 'Paper') : 'Paper';
  const openDetail = openPage && detail.state === 'ready' ? detail.detail : null;

  return (
    <div className="fixed inset-0 z-40 grid grid-rows-[40px_30px_minmax(0,1fr)] bg-bg text-12-5 text-text">
      <header className="flex items-center gap-1 border-b border-border-strong bg-surface pl-2 pr-3">
        {/* The designer is the whole admin area (the console was retired on
            2026-09-09), so the arrow leaves for the site. Absolute, because on
            the admin-only dev. subdomain a relative "/" is the designer again. */}
        <Link
          href={`${SITE_URL}/`}
          title="Back to the site"
          aria-label="Back to the site"
          className="grid h-[30px] w-[30px] place-items-center border border-transparent text-text-muted hover:border-border-strong hover:bg-surface-elevated hover:text-text"
        >
          <ArrowLeft size={14} />
        </Link>
        <span className="mr-4 whitespace-nowrap font-mono text-12 font-semibold uppercase tracking-[0.12em] text-text">
          Paddock<span className="text-brand">•</span>
          <span className="font-normal text-text-muted">Developer</span>
        </span>
        <nav aria-label="Workspaces" className="flex self-stretch">
          <WorkspaceTab label="App Builder" active={workspace === 'builder'} onClick={() => selectWorkspace('builder')} />
          <WorkspaceTab label="Shared Components" active={workspace === 'shared'} onClick={() => selectWorkspace('shared')} />
          <WorkspaceTab label="Data" active={workspace === 'data'} onClick={() => selectWorkspace('data')} />
        </nav>
        <span className="flex-1" />
        <span className="whitespace-nowrap font-mono text-10 tracking-[0.04em] text-text-faint">{who}</span>
        <ConsoleModeToggle />
      </header>

      <div className="flex h-[30px] items-center gap-2 border-b border-border bg-surface-elevated px-3.5 text-11 text-text-faint">
        {workspace === 'data' ? (
          <>
            <span className="font-medium text-text-muted">Data</span>
            <span>›</span>
            <span>What the outside world reports about paddock-tracker.com</span>
          </>
        ) : workspace === 'builder' ? (
          <>
            <button type="button" onClick={() => openPageDetail(null)} title="Back to all pages" className="font-medium text-text-muted hover:text-text">
              App Builder
            </button>
            <span>›</span>
            <span>Application 100 · Paddock</span>
            {openPage && (
              <>
                <span>›</span>
                <span>Page Designer</span>
                <span>›</span>
                <span>{openDetail ? `Page ${openDetail.page.id ? openDetail.page.id.slice(0, 8) : ''}: ${openDetail.page.name}` : '…'}</span>
              </>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => select(null)}
              title="Back to the overview"
              className="font-medium text-text-muted hover:text-text"
            >
              Shared Components
            </button>
            <span>›</span>
            <span>Application 100 · Paddock</span>
            {item && (
              <>
                <span>›</span>
                <span>{item.label}</span>
              </>
            )}
          </>
        )}
      </div>

      {workspace === 'builder' && openPage ? (
        <div className="min-h-0 min-w-0">
          {detail.state === 'loading' && <p className="px-6 pt-[18px] font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading the page…</p>}
          {detail.state === 'error' && <p className="px-6 pt-[18px] text-12 text-negative">{detail.message}</p>}
          {detail.state === 'ready' && (
            <PageDesigner
              detail={detail.detail}
              pages={pages.state === 'ready' ? pages.pages : [detail.detail.page]}
              readOnly={readOnly}
              lists={pdLists}
              listCounts={listCounts}
              regionDefaults={regionDefaults}
              assets={assets.state === 'ready' ? assets.assets : []}
              schemes={schemes}
              buildOptions={build.state === 'ready' ? build.options : undefined}
              templates={appearance.state === 'ready' ? appearance.loaded.appearance.templates : undefined}
              initialRegion={openPage === initialPageId ? regionOnce : null}
              shortcuts={shortcuts.state === 'ready' ? shortcuts.shortcuts : []}
              themeDefault={themeDefault}
              onSaved={next => {
                setDetail({ state: 'ready', detail: next });
                setPages(s => (s.state === 'ready' ? { state: 'ready', pages: s.pages.map(p => (p.id && p.id === next.page.id ? next.page : p)) } : s));
              }}
              onOpenPage={id => openPageDetail(id)}
              onBack={filter => {
                // One return at a time: the plain back arrow shows every page again (the reviewer's gap).
                setPagesFilter(filter ?? 'all');
                openPageDetail(null);
              }}
              onWorkspace={(ws, sc) => {
                if (sc) select(sc);
                selectWorkspace(ws);
              }}
              onCreated={page => {
                setPages(s => (s.state === 'ready' ? { state: 'ready', pages: [...s.pages, page] } : s));
                if (page.id) openPageDetail(page.id);
              }}
              onDeleted={id => {
                setPages(s => (s.state === 'ready' ? { state: 'ready', pages: s.pages.filter(p => p.id !== id) } : s));
                openPageDetail(null);
              }}
            />
          )}
        </div>
      ) : (
      <div className={`grid min-h-0 ${workspace === 'shared' ? 'grid-cols-[300px_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        {workspace === 'shared' && (
          <nav aria-label="Shared components" className="overflow-auto border-r border-border-strong bg-surface pb-5">
            <SharedRail query={catalogueQuery} onQuery={setCatalogueQuery} selected={selected} onSelect={select} badge={badge} />
          </nav>
        )}

      {workspace === 'builder' ? (
        <main className="min-w-0 overflow-auto px-6 pb-8 pt-[18px]">
          {readOnly && (
            <p className="mb-4 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text-muted">
              Design edits are made on production. This copy of the site is read-only: browse and preview here, save on
              paddock-tracker.com.
            </p>
          )}
          {pages.state === 'loading' && (
            <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Pages…</p>
          )}
          {pages.state === 'error' && <p className="text-12 text-negative">{pages.message}</p>}
          {pages.state === 'ready' && (
            <PagesList
              pages={pages.pages}
              initialFilter={pagesFilter}
              readOnly={readOnly}
              onOpen={id => openPageDetail(id)}
              onCreated={page => {
                setPages(s => (s.state === 'ready' ? { state: 'ready', pages: [...s.pages, page] } : s));
                if (page.id) openPageDetail(page.id);
              }}
              onOpenShared={sc => {
                select(sc);
                selectWorkspace('shared');
              }}
            />
          )}
        </main>
      ) : workspace === 'data' ? (
        <main className="min-w-0 overflow-auto px-6 pb-8 pt-[18px]">
          <DataWorkspace />
        </main>
      ) : (
        <main className="min-w-0 overflow-auto px-6 pb-8 pt-[18px]">
          {readOnly && (
            <p className="mb-4 max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text-muted">
              Design edits are made on production. This copy of the site is read-only: browse and preview here, save on
              paddock-tracker.com.
            </p>
          )}

          {!item && (
            <>
              <h2 className="m-0 mb-1 text-20 font-bold text-text">Shared Components</h2>
              <p className="m-0 mb-4 max-w-[70ch] text-13 text-text-muted">
                Everything the pages share. The header, the footer and the phone bar are lists here; security, themes and
                the data the regions read follow in later steps. Edit once, every page follows.
              </p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {CATALOGUE.map(group => (
                  <div key={group.group} className="grid content-start gap-1.5 border border-border-strong bg-surface p-3.5">
                    <h4 className="m-0 mb-1 text-13 font-bold text-text">{group.group}</h4>
                    {group.items.map(it => (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => select(it.key)}
                        className={`py-0.5 text-left text-12 ${it.listKey || it.editor ? 'text-edit hover:underline' : 'text-text-faint'}`}
                      >
                        {it.label}
                        {badge(it) !== null && (
                          <span className="ml-1.5 font-mono text-10 text-text-faint">{badge(it)}</span>
                        )}
                        {it.later && <span className="ml-1.5 font-mono text-9 text-text-faint">{it.later}</span>}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {item && !listKey && !item.editor && (
            <>
              <h2 className="m-0 mb-1 text-20 font-bold text-text">{item.label}</h2>
              <p className="m-0 max-w-[70ch] text-13 text-text-muted">
                Not editable yet: {item.later}. The field guide names the table it needs; it arrives with the phase that
                creates it.
              </p>
            </>
          )}

          {item?.editor === 'text' && (() => {
            if (text.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Text Messages…</p>;
            }
            if (text.state === 'error') return <p className="text-12 text-negative">{text.message}</p>;
            return (
              <TextEditor
                messages={text.messages}
                readOnly={readOnly}
                onSaved={messages => setText({ state: 'ready', messages })}
              />
            );
          })()}

          {item?.editor === 'build' && (() => {
            if (build.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Build Options…</p>;
            }
            if (build.state === 'error') return <p className="text-12 text-negative">{build.message}</p>;
            return (
              <BuildOptionsEditor
                options={build.options}
                readOnly={readOnly}
                onSaved={options => setBuild({ state: 'ready', options })}
              />
            );
          })()}

          {item?.editor === 'settings' && (() => {
            if (settings.state === 'loading') {
              return (
                <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Application Settings…</p>
              );
            }
            if (settings.state === 'error') return <p className="text-12 text-negative">{settings.message}</p>;
            return (
              <SettingsEditor
                settings={settings.settings}
                keys={APPLICATION_SETTING_KEYS}
                series={series}
                readOnly={readOnly}
                onSaved={next => setSettings({ state: 'ready', settings: next })}
              />
            );
          })()}

          {item?.editor === 'compsettings' && (() => {
            if (settings.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Component Settings…</p>;
            }
            if (settings.state === 'error') return <p className="text-12 text-negative">{settings.message}</p>;
            return (
              <SettingsEditor
                settings={settings.settings}
                keys={COMPONENT_SETTING_KEYS}
                title="Component Settings"
                intro="What a region of each kind starts with when it is placed on a page: the Page Designer reads these when it creates one. A region keeps its own values from then on, so changing a default changes no existing page."
                series={series}
                readOnly={readOnly}
                onSaved={next => setSettings({ state: 'ready', settings: next })}
              />
            );
          })()}

          {item?.editor === 'authz' && (() => {
            if (authz.state === 'loading') {
              return (
                <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Authorization Schemes…</p>
              );
            }
            if (authz.state === 'error') return <p className="text-12 text-negative">{authz.message}</p>;
            return (
              <AuthzEditor
                schemes={authz.schemes}
                readOnly={readOnly}
                onSaved={next => setAuthz({ state: 'ready', schemes: next })}
              />
            );
          })()}

          {item?.editor === 'themes' && (() => {
            if (themes.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Themes…</p>;
            }
            if (themes.state === 'error') return <p className="text-12 text-negative">{themes.message}</p>;
            return (
              <ThemesEditor
                themes={themes.themes}
                readOnly={readOnly}
                onSaved={next => setThemes({ state: 'ready', themes: next })}
              />
            );
          })()}

          {item?.editor === 'shortcuts' && (() => {
            if (shortcuts.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Shortcuts…</p>;
            }
            if (shortcuts.state === 'error') return <p className="text-12 text-negative">{shortcuts.message}</p>;
            return (
              <ShortcutsEditor
                shortcuts={shortcuts.shortcuts}
                readOnly={readOnly}
                onSaved={next => setShortcuts({ state: 'ready', shortcuts: next })}
              />
            );
          })()}

          {item?.editor === 'assets' && (() => {
            if (assets.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Assets…</p>;
            }
            if (assets.state === 'error') return <p className="text-12 text-negative">{assets.message}</p>;
            return (
              <AssetsEditor
                assets={assets.assets}
                mediaConfigured={assets.mediaConfigured}
                readOnly={readOnly}
                onSaved={next => setAssets(s => ({ state: 'ready', assets: next, mediaConfigured: s.state === 'ready' ? s.mediaConfigured : mediaConfigured }))}
              />
            );
          })()}

          {item?.editor === 'searchhints' && (() => {
            if (searchHints.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Search Hints…</p>;
            }
            if (searchHints.state === 'error') return <p className="text-12 text-negative">{searchHints.message}</p>;
            return (
              <SearchHintsEditor
                hints={searchHints.hints}
                readOnly={readOnly}
                onSaved={next => setSearchHints({ state: 'ready', hints: next })}
              />
            );
          })()}

          {item?.editor === 'lists' && (() => {
            if (listIndex.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Lists…</p>;
            }
            if (listIndex.state === 'error') return <p className="text-12 text-negative">{listIndex.message}</p>;
            return (
              <ListsEditor
                lists={listIndex.lists}
                readOnly={readOnly}
                schemes={schemes}
                onOpenShell={key => select(key)}
                onChanged={next => setListIndex({ state: 'ready', lists: next })}
              />
            );
          })()}

          {item?.editor === 'computations' && <ComputationsView onOpen={key => select(key)} />}

          {item?.editor === 'appdef' && (() => {
            if (application.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading the Application Definition…</p>;
            }
            if (application.state === 'error') return <p className="text-12 text-negative">{application.message}</p>;
            return (
              <ApplicationDefinitionEditor
                loaded={application.loaded}
                readOnly={readOnly}
                onSaved={next => setApplication({ state: 'ready', loaded: next })}
              />
            );
          })()}

          {item?.editor === 'appearance' && (() => {
            if (appearance.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Appearance…</p>;
            }
            if (appearance.state === 'error') return <p className="text-12 text-negative">{appearance.message}</p>;
            return (
              <AppearanceEditor
                loaded={appearance.loaded}
                readOnly={readOnly}
                onSaved={next => setAppearance({ state: 'ready', loaded: next })}
              />
            );
          })()}

          {/* Templates (P1.2) ride the Appearance document: the same state, the same stamp. */}
          {item?.editor === 'templates' && (() => {
            if (appearance.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading Templates…</p>;
            }
            if (appearance.state === 'error') return <p className="text-12 text-negative">{appearance.message}</p>;
            return (
              <TemplatesEditor
                loaded={appearance.loaded}
                readOnly={readOnly}
                onSaved={next => setAppearance({ state: 'ready', loaded: next })}
              />
            );
          })()}

          {item && listKey && (() => {
            const loaded = lists[listKey];
            if (!loaded || loaded.state === 'loading') {
              return <p className="font-mono text-11 uppercase tracking-[0.16em] text-text-faint">Loading {item.label}…</p>;
            }
            if (loaded.state === 'error') {
              return <p className="text-12 text-negative">{loaded.message}</p>;
            }
            const other: NavListKey | null =
              listKey === 'footer-site' ? 'footer-legal' : listKey === 'footer-legal' ? 'footer-site' : null;
            return (
              <ListEditor
                key={listKey}
                listKey={listKey}
                role={ROLE_OF[listKey]}
                list={loaded.list}
                title={LIST_COPY[listKey].title}
                sub={LIST_COPY[listKey].sub}
                readOnly={readOnly}
                otherFooter={other ? stored(other) : undefined}
                text={chromeText}
                schemes={schemes}
                onSaved={list => {
                  setLists(s => ({ ...s, [listKey]: { state: 'ready', list } }));
                  indexFollows(list);
                }}
              />
            );
          })()}
        </main>
      )}
      </div>
      )}
    </div>
  );
}

/** A workspace tab: clickable when it has an `onClick`, otherwise a placeholder
 *  that names the phase bringing it. */
function WorkspaceTab({
  label,
  active = false,
  later,
  onClick,
}: {
  label: string;
  active?: boolean;
  later?: string;
  onClick?: () => void;
}) {
  const live = Boolean(onClick);
  return (
    <button
      type="button"
      disabled={!live}
      aria-current={active ? 'page' : undefined}
      title={later ? `${label}: ${later}` : label}
      onClick={onClick}
      className={`relative h-[40px] whitespace-nowrap px-3 text-12 font-medium ${
        active
          ? 'text-text shadow-[inset_0_-2px_0_var(--edit)]'
          : live
            ? 'text-text-muted hover:text-text'
            : 'cursor-default text-text-faint'
      }`}
    >
      {label}
      {later && <span className="ml-1.5 font-mono text-9 text-text-faint">{later}</span>}
    </button>
  );
}
