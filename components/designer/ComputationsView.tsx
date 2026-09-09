'use client';

import { ArrowUpRight } from 'lucide-react';

// Application Computations (APEX: Application Computations, values set at a
// point of the request), the Phase 3 entry. Paddock computes its values in the
// code, from inputs the Shared Components hold, so this is a read-only account
// of what is computed, when, from which entry and how often it is re-read: the
// operator changes the inputs in the entries linked here, never a computation.
// Every row states what the code does today (lib/design/*); a new loader gets a
// row here in the same PR.

const PBTN =
  'inline-flex items-center gap-1 border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text';

export interface Computation {
  /** The point in the request, in APEX's words where they fit. */
  point: string;
  what: string;
  /** The catalogue key of the entry holding the inputs, or null when the input is the visitor's. */
  from: string | null;
  fromLabel: string;
  /** How often the value is re-read. */
  often: string;
}

/** The points the site computes at, in order, with what each one yields. */
export const COMPUTATIONS: readonly Computation[] = [
  { point: 'Before header', what: 'Which page this route is: its name, browser-tab title, whether search engines may index it, who may see it', from: null, fromLabel: 'App Builder · the page’s attributes', often: 'Once a minute per process; a save clears its own process at once' },
  { point: 'Before header', what: 'Whether the visitor may see the page or a region: the session against the scheme asked for', from: 'authz', fromLabel: 'Authorization Schemes', often: 'Every request that asks; a public page never reads the session' },
  { point: 'Before header', what: 'The regions around a page the code serves: the newest published revision', from: null, fromLabel: 'App Builder · Publish', often: 'Every request; a publish revalidates the page' },
  { point: 'On load', what: 'The application’s name, wordmark, date chip, install button and maintenance notice', from: 'appdef', fromLabel: 'Application Definition', often: 'Once a minute per process' },
  { point: 'On load', what: 'The navigation menu, the phone bar and the two footer columns', from: 'lists', fromLabel: 'Lists', often: 'Once a minute per process; a save clears its own process at once' },
  { point: 'On load', what: 'The fixed strings the chrome shows: the skip link, the search hint, the footer', from: 'textmsgs', fromLabel: 'Text Messages', often: 'Once a minute per process' },
  { point: 'On load', what: 'Faces, sizes, leading, density, corners and motion', from: 'appearance', fromLabel: 'Appearance', often: 'Once a minute per process' },
  { point: 'On load', what: 'The theme in force: the visitor’s stored choice, else the default', from: 'themes', fromLabel: 'Themes', often: 'In the browser before the first paint; the set of themes once a minute per process' },
  { point: 'On load', what: 'The home page’s lead series, featured series, wire headline count and further reading, and which What’s New notice shows', from: 'settings', fromLabel: 'Application Settings', often: 'Once a minute per process' },
  { point: 'On load', what: 'Whether Ghost lap 3D and Weather are switched on', from: 'build', fromLabel: 'Build Options', often: 'Once a minute per process' },
  { point: 'On load', what: 'The questions the search box suggests', from: 'searchhints', fromLabel: 'Search Hints', often: 'Once a minute per process; the box rotates them every minute' },
  { point: 'On render', what: 'The house-style fragments inside Static Content', from: 'shortcuts', fromLabel: 'Shortcuts', often: 'Once a minute per process' },
  { point: 'On render', what: 'A page made in the designer: its live revision, photos and lists', from: null, fromLabel: 'App Builder · Publish', often: 'Cached for five minutes and re-rendered at once on a publish' },
  { point: 'In the designer', what: 'What a new region starts with', from: 'compsettings', fromLabel: 'Component Settings', often: 'When the designer opens' },
];

export function ComputationsView({ onOpen }: { onOpen: (key: string) => void }) {
  return (
    <div>
      <h2 className="m-0 mb-1 text-20 font-bold text-text">Application Computations</h2>
      <p className="m-0 mb-4 max-w-[70ch] text-13 text-text-muted">
        What the application works out on its own, and when. The code computes each value at the point named, from inputs the
        entries here hold; you change the inputs, never a computation. Read-only.
      </p>
      <div className="border border-border-strong bg-surface">
        <table className="w-full border-collapse text-12">
          <thead>
            <tr className="text-left text-text-faint">
              <th className="w-36 px-2.5 py-2 font-semibold">Point</th>
              <th className="px-2.5 py-2 font-semibold">What is computed</th>
              <th className="w-56 px-2.5 py-2 font-semibold">From</th>
              <th className="w-72 px-2.5 py-2 font-semibold">How often</th>
            </tr>
          </thead>
          <tbody>
            {COMPUTATIONS.map((c, i) => (
              <tr key={i} className="border-t border-border align-top">
                <td className="px-2.5 py-2 font-mono text-10 uppercase tracking-[0.12em] text-text-faint">{c.point}</td>
                <td className="px-2.5 py-2 text-text">{c.what}</td>
                <td className="px-2.5 py-2">
                  {c.from ? (
                    <button type="button" className={PBTN} onClick={() => onOpen(c.from!)}>
                      {c.fromLabel} <ArrowUpRight size={10} />
                    </button>
                  ) : (
                    <span className="text-text-muted">{c.fromLabel}</span>
                  )}
                </td>
                <td className="px-2.5 py-2 text-text-muted">{c.often}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-[70ch] text-11 text-text-faint">
        “Once a minute per process” is the designer’s standing rule for values the site reads at render: each process keeps what it read for a minute, so a save shows within a minute everywhere and at once where it was made.
      </p>
    </div>
  );
}
