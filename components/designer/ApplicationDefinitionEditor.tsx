'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { APP_VERSION } from '@/lib/version';
import {
  DESCRIPTION_MAX,
  MAINTENANCE_NOTICE,
  NAME_MAX,
  TAGLINE_MAX,
  WORDMARK_MAX,
  parseDefinition,
  type ApplicationDefinition,
} from '@/lib/design/application-defaults';
import type { EditableApplication } from '@/lib/design/application';
import { FIELD, PBTN, Pills, PropertyPane, Ro, TEXTAREA, YesNo } from './PropertyPane';

// Shared Components → Application Definition (APEX's Application Definition,
// in the Property Editor's form): the facts of application 100, Paddock. Name,
// alias, version, home page and description under Definition; Availability
// with what Maintenance does; the header's and footer's properties (wordmark,
// date chip, install button); the tagline and the favicon stored for later
// steps and saying so. One conditional save on the row's stamp through
// PUT /api/admin/design/application; a moved stamp comes back as a conflict
// with Reload.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40';

export function ApplicationDefinitionEditor({
  loaded,
  readOnly,
  onSaved,
}: {
  loaded: EditableApplication;
  readOnly: boolean;
  onSaved: (next: EditableApplication) => void;
}) {
  const [draft, setDraft] = useState<ApplicationDefinition>(loaded.definition);
  const [seen, setSeen] = useState(loaded.updatedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState<EditableApplication | null>(null);
  if (loaded.updatedAt !== seen) {
    // A new row (after a save or a reload) replaces the draft: adjusted during render.
    setSeen(loaded.updatedAt);
    setDraft(loaded.definition);
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(loaded.definition);
  const problems = parseDefinition({ ...draft, name: draft.name }).problems;
  const problem = !draft.name.trim() ? 'the application needs a name' : (problems[0] ?? null);
  const set = (fn: (d: ApplicationDefinition) => ApplicationDefinition) => setDraft(d => fn(d));

  async function save() {
    if (busy || readOnly || problem || !dirty) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/design/application', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ definition: { ...draft, name: draft.name.trim() }, updatedAt: loaded.updatedAt }),
      });
      if (res.status === 409) {
        const d = (await res.json().catch(() => ({}))) as { current?: EditableApplication | null };
        if (d.current) setConflict(d.current);
        else setError('The definition was saved again after you loaded it. Reload the page.');
        return;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `failed (${res.status})`);
        return;
      }
      const d = (await res.json()) as { definition: ApplicationDefinition; updatedAt: string };
      setSaved(true);
      onSaved({ definition: d.definition, updatedAt: d.updatedAt });
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const groups = [
    {
      title: 'Definition',
      props: [
        {
          label: 'Name',
          common: true,
          htmlFor: 'appdef-name',
          control: <input id="appdef-name" type="text" value={draft.name} maxLength={NAME_MAX} disabled={readOnly} aria-label="Application name" className={FIELD} onChange={e => set(d => ({ ...d, name: e.target.value }))} />,
          note: 'The title suffix on every page and the footer’s copyright line.',
          help: 'How the application is called: the browser-tab suffix and the copyright line. The wordmark below is what the header shows.',
        },
        { label: 'Application Alias', common: true, control: <Ro dim>{draft.alias}</Ro>, note: 'The code’s; used in exports and keys.', help: 'A stable handle for the application in exports and keys. It is code.' },
        { label: 'Version', common: true, control: <Ro>v{APP_VERSION}</Ro>, note: 'The release running now; every push to main bumps it.', help: 'The version is the release, recorded in the changelog on every push. The designer cannot change it.' },
        { label: 'Home Page', common: true, control: <Ro dim>{draft.homePath}</Ro>, note: 'The page the address / serves. The code’s.' },
        {
          label: 'Description',
          htmlFor: 'appdef-description',
          control: <textarea id="appdef-description" value={draft.description ?? ''} maxLength={DESCRIPTION_MAX} disabled={readOnly} aria-label="Application description" className={TEXTAREA} onChange={e => set(d => ({ ...d, description: e.target.value || null }))} />,
          note: 'Notes for the two of you. Never rendered.',
        },
      ],
    },
    {
      title: 'Availability',
      props: [
        {
          label: 'Status',
          common: true,
          control: (
            <Pills
              label="Availability"
              items={[
                { key: 'available', label: 'Available' },
                { key: 'maintenance', label: 'Maintenance' },
              ]}
              current={draft.availability}
              disabled={readOnly}
              onPick={a => set(d => ({ ...d, availability: a }))}
            />
          ),
          note: draft.availability === 'maintenance' ? `Every page shows: “${MAINTENANCE_NOTICE}” Nothing is locked.` : 'Maintenance shows a notice on every page; nothing is locked, by design.',
          help: 'Available serves the site as usual. Maintenance adds a notice under the header on every page; readers keep browsing.',
        },
        { label: 'Unavailable Message', control: <Ro dim>Arrives with a later step; the notice above is the shipped sentence.</Ro> },
      ],
    },
    {
      title: 'Properties',
      props: [
        {
          label: 'Wordmark',
          common: true,
          htmlFor: 'appdef-wordmark',
          control: <input id="appdef-wordmark" type="text" value={draft.wordmark ?? ''} maxLength={WORDMARK_MAX} disabled={readOnly} placeholder="Paddock•Tracker" aria-label="Wordmark" className={FIELD} onChange={e => set(d => ({ ...d, wordmark: e.target.value || null }))} />,
          note: 'The header and the footer. Empty keeps the shipped Paddock•Tracker with its brand dot.',
          help: 'The words in the header’s top left and the footer’s last line. Phones show the first word.',
        },
        {
          label: 'Date Chip',
          common: true,
          control: <YesNo label="Date chip in the header" value={draft.dateChip} disabled={readOnly} onPick={v => set(d => ({ ...d, dateChip: v }))} />,
          note: 'The date at the top right of every page.',
        },
        {
          label: 'Install Prompt',
          common: true,
          control: <YesNo label="Install as an app in the footer" value={draft.installPrompt} disabled={readOnly} onPick={v => set(d => ({ ...d, installPrompt: v }))} />,
          note: 'The Install as an app button in the footer, the site’s only install path.',
        },
        {
          label: 'Tagline',
          htmlFor: 'appdef-tagline',
          control: <input id="appdef-tagline" type="text" value={draft.tagline ?? ''} maxLength={TAGLINE_MAX} disabled={readOnly} aria-label="Tagline" className={FIELD} onChange={e => set(d => ({ ...d, tagline: e.target.value || null }))} />,
          note: 'Stored; read by a later step. The footer’s one-line blurb is a Text Message.',
        },
        { label: 'Favicon', control: <Ro dim>Arrives with a later step: one of your photos as the tab icon.</Ro> },
      ],
    },
  ];

  return (
    <div className="grid max-w-[720px] gap-3">
      <div>
        <h2 className="m-0 mb-1 text-20 font-bold text-text">Application Definition</h2>
        <p className="m-0 max-w-[70ch] text-13 text-text-muted">
          The facts of application 100, Paddock: its name, availability and the shell’s properties. The site reads them within a minute of a save.
        </p>
      </div>
      {conflict && (
        <div className="max-w-[70ch] border border-border-strong bg-surface px-3 py-2 text-12 text-text">
          <p className="m-0">The definition was saved again after you loaded it. Reload to see what is stored now; your unsaved changes are dropped.</p>
          <div className="mt-2 flex gap-3">
            <button type="button" className={PBTN} onClick={() => { onSaved(conflict); setConflict(null); }}>
              Reload
            </button>
          </div>
        </div>
      )}
      <div className="border border-border-strong">
        <PropertyPane
          head={{ kind: 'Application', name: `100: ${draft.name.trim() || 'Paddock'}` }}
          groups={groups}
          footer={
            !readOnly ? (
              <div className="flex items-center gap-3 border-t border-border px-3 py-2">
                <button type="button" className={TB} disabled={busy || !dirty || Boolean(problem)} onClick={() => void save()}>
                  {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                  Save definition
                </button>
                <span className={`font-mono text-9 uppercase tracking-[0.1em] ${error || problem ? 'text-negative' : 'text-text-faint'}`}>
                  {error ?? problem ?? (dirty ? 'unsaved changes' : saved ? 'saved' : 'stored')}
                </span>
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
