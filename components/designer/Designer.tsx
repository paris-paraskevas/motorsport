'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ConsoleModeToggle } from '@/components/admin/ConsoleMode';
import type { EditableList, NavListKey } from '@/lib/design/lists';
import type { EditableText } from '@/lib/design/text';
import type { ChromeText } from '@/lib/design/text-defaults';
import type { EditableBuildOption } from '@/lib/design/build-options';
import type { EditableSetting } from '@/lib/design/settings';
import type { EditableAuthzScheme } from '@/lib/design/authz';
import type { EditableTheme } from '@/lib/design/themes';
import type { EditableAppearance } from '@/lib/design/appearance';
import { CATALOGUE, LIST_COPY, type CatalogueItem } from './catalogue';
import { ListEditor } from './ListEditor';
import { TextEditor } from './TextEditor';
import { BuildOptionsEditor } from './BuildOptionsEditor';
import { SettingsEditor, type SeriesOption } from './SettingsEditor';
import { AuthzEditor } from './AuthzEditor';
import { ThemesEditor } from './ThemesEditor';
import { AppearanceEditor } from './AppearanceEditor';

// Paddock Developer: the designer's shell in the prototype's shape (2026-09-07,
// v2.4): the workspace header, the crumbs bar, and for Shared Components a
// 300-pixel catalogue beside the editor. Full viewport over the console, so the
// rail never competes with the panes; the arrow at the top left goes back.
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

export function Designer({
  readOnly,
  who,
  initialSelected = null,
  initialLists,
  initialText,
  initialBuildOptions,
  initialSettings,
  initialAuthz,
  initialThemes,
  initialAppearance,
  series = [],
}: {
  readOnly: boolean;
  who: string;
  /** A catalogue key to open on, from `?sc=` on the page. Unknown keys open the overview. */
  initialSelected?: string | null;
  /** Lists the server already loaded, so opening needs no round trip; any list
   *  missing here is fetched. */
  initialLists?: Partial<Record<NavListKey, EditableList>>;
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
    return () => {
      cancelled = true;
    };
  }, [initialLists, initialText, initialBuildOptions, initialSettings, initialAuthz, initialThemes, initialAppearance]);

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
                : null;
  const stored = (key: NavListKey) => {
    const l = lists[key];
    return l && l.state === 'ready' ? l.list.entries : [];
  };

  return (
    <div className="fixed inset-0 z-40 grid grid-rows-[40px_30px_minmax(0,1fr)] bg-bg text-12-5 text-text">
      <header className="flex items-center gap-1 border-b border-border-strong bg-surface pl-2 pr-3">
        <Link
          href="/admin"
          title="Back to the console"
          aria-label="Back to the console"
          className="grid h-[30px] w-[30px] place-items-center border border-transparent text-text-muted hover:border-border-strong hover:bg-surface-elevated hover:text-text"
        >
          <ArrowLeft size={14} />
        </Link>
        <span className="mr-4 whitespace-nowrap font-mono text-12 font-semibold uppercase tracking-[0.12em] text-text">
          Paddock<span className="text-brand">•</span>
          <span className="font-normal text-text-muted">Developer</span>
        </span>
        <nav aria-label="Workspaces" className="flex self-stretch">
          <WorkspaceTab label="App Builder" later="Phase 3" />
          <WorkspaceTab label="Shared Components" active />
          <WorkspaceTab label="Data" later="later" />
        </nav>
        <span className="flex-1" />
        <span className="whitespace-nowrap font-mono text-10 tracking-[0.04em] text-text-faint">{who}</span>
        <ConsoleModeToggle />
      </header>

      <div className="flex h-[30px] items-center gap-2 border-b border-border bg-surface-elevated px-3.5 text-11 text-text-faint">
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
      </div>

      <div className="grid min-h-0 grid-cols-[300px_minmax(0,1fr)]">
        <nav aria-label="Shared components" className="overflow-auto border-r border-border-strong bg-surface pb-5 pt-2">
          {CATALOGUE.map(group => (
            <div key={group.group}>
              <div className="px-3.5 pb-1 pt-3 text-12 font-semibold text-text-muted">{group.group}</div>
              {group.items.map(it => {
                const active = selected === it.key;
                const n = badge(it);
                const live = Boolean(it.listKey || it.editor);
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => select(it.key)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full items-center gap-2.5 py-[7px] pl-[22px] pr-3.5 text-left text-12 ${
                      active
                        ? 'bg-edit-dim text-text shadow-[inset_2px_0_0_var(--edit)]'
                        : live
                          ? 'text-text-muted hover:bg-surface-elevated hover:text-text'
                          : 'text-text-faint hover:bg-surface-elevated hover:text-text-muted'
                    }`}
                  >
                    <span>{it.label}</span>
                    {it.later && <span className="ml-auto font-mono text-9 text-text-faint">{it.later}</span>}
                    {n !== null && <span className="ml-auto font-mono text-9 text-text-faint">{n}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

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
                onSaved={list => setLists(s => ({ ...s, [listKey]: { state: 'ready', list } }))}
              />
            );
          })()}
        </main>
      </div>
    </div>
  );
}

function WorkspaceTab({ label, active = false, later }: { label: string; active?: boolean; later?: string }) {
  return (
    <button
      type="button"
      disabled={!active}
      title={later ? `${label}: ${later}` : label}
      className={`relative h-[40px] whitespace-nowrap px-3 text-12 font-medium ${
        active ? 'text-text shadow-[inset_0_-2px_0_var(--edit)]' : 'cursor-default text-text-faint'
      }`}
    >
      {label}
      {later && <span className="ml-1.5 font-mono text-9 text-text-faint">{later}</span>}
    </button>
  );
}
