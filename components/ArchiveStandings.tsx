import type { ReactNode } from 'react';

/** Renders the classification tables inside an archived season's `standings`
 *  payload.
 *
 *  Every series fetcher returns its own shape, but they converge on
 *  `{ drivers: Row[], … }` where a Row is `{position, points}` plus one of
 *  `driverName` / `coDriverName` / `name`. Rather than sniff every array in the
 *  object — DTM's payload also carries `driverRoundBreakdown`, which is not a
 *  classification — this renders an explicit ALLOW-LIST of keys in a fixed
 *  order. An unknown key is ignored rather than guessed at. */
const TABLES: { key: string; label: string }[] = [
  { key: 'drivers', label: 'Drivers' },
  { key: 'coDrivers', label: 'Co-drivers' },
  { key: 'teams', label: 'Teams' },
  { key: 'constructors', label: 'Constructors' },
  { key: 'manufacturers', label: 'Manufacturers' },
];

interface Row {
  position?: number;
  points?: number;
  wins?: number;
  driverName?: string;
  coDriverName?: string;
  name?: string;
  team?: string;
}

const nameOf = (r: Row) => r.driverName ?? r.coDriverName ?? r.name ?? '';

function isClassification(v: unknown): v is Row[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    typeof (v[0] as Row)?.position === 'number' &&
    typeof (v[0] as Row)?.points === 'number' &&
    nameOf(v[0] as Row) !== ''
  );
}

export function ArchiveStandings({ standings }: { standings: unknown }): ReactNode {
  if (!standings || typeof standings !== 'object') return null;
  const source = standings as Record<string, unknown>;
  const tables = TABLES.filter(t => isClassification(source[t.key]));
  if (tables.length === 0) return null;

  return (
    <section aria-label="Final classifications" className="mt-10">
      <h2 className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-faint">
        Final classifications
      </h2>
      <div className="mt-3 grid gap-8 md:grid-cols-2">
        {tables.map(({ key, label }) => {
          const rows = source[key] as Row[];
          const anyWins = rows.some(r => typeof r.wins === 'number');
          return (
            <div key={key}>
              <h3 className="font-serif text-base font-semibold text-text">{label}</h3>
              <table className="mt-2 w-full text-13">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-10 uppercase tracking-[0.12em] text-text-faint">
                    <th scope="col" className="w-8 py-1.5 font-semibold">Pos</th>
                    <th scope="col" className="py-1.5 font-semibold">Name</th>
                    <th scope="col" className="w-14 py-1.5 text-right font-semibold">Pts</th>
                    {anyWins && (
                      <th scope="col" className="w-12 py-1.5 text-right font-semibold">Wins</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={`${r.position}-${nameOf(r)}`} className="border-b border-border/60">
                      <td className="py-1.5 font-mono text-text-faint">{r.position}</td>
                      <td className="py-1.5 text-text">
                        {nameOf(r)}
                        {r.team ? <span className="text-text-faint"> · {r.team}</span> : null}
                      </td>
                      <td className="py-1.5 text-right font-mono text-text">{r.points}</td>
                      {anyWins && (
                        <td className="py-1.5 text-right font-mono text-text-faint">
                          {typeof r.wins === 'number' ? r.wins : ''}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </section>
  );
}
