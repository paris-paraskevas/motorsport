import type {
  Series,
  DriverStanding,
  ConstructorStanding,
  StandingsOverridesFile,
} from '@/lib/types';
import { fetchF1Standings } from '@/lib/standings/f1';
import { fetchF2Standings } from '@/lib/standings/f2';
import { fetchF3Standings } from '@/lib/standings/f3';
import { fetchIndyCarStandings } from '@/lib/standings/indycar';
import { fetchFormulaEStandings } from '@/lib/standings/formula-e';
import { fetchMotoGPStandings } from '@/lib/standings/motogp';
import { fetchNascarCupStandings } from '@/lib/standings/nascar-cup';
import { fetchWsbkStandings } from '@/lib/standings/wsbk';
import { fetchDTMStandings } from '@/lib/standings/dtm';
import { fetchWRCStandings } from '@/lib/standings/wrc';
import { fetchGtWorldStandings } from '@/lib/standings/gt-world';
import {
  fetchImsaStandings,
  IMSA_CLASSES,
  IMSA_MANUFACTURER_CLASSES,
} from '@/lib/standings/imsa';
import {
  fetchWecStandings,
  WEC_CLASSES,
  WEC_MANUFACTURER_CLASSES,
  WEC_TEAM_CLASSES,
} from '@/lib/standings/wec';
import { loadStandingsOverrides } from '@/lib/series-content';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

const SOURCE_URL = 'https://github.com/jolpica/jolpica-f1';
const FORMULA_E_SOURCE_URL =
  'https://en.wikipedia.org/wiki/2025%E2%80%9326_Formula_E_World_Championship';
const NASCAR_SOURCE_URL = 'https://en.wikipedia.org/wiki/2026_NASCAR_Cup_Series';

function applyDriverOverrides(
  drivers: DriverStanding[],
  overrides: StandingsOverridesFile['drivers'],
): DriverStanding[] {
  if (!overrides || overrides.length === 0) return drivers;
  const patched = drivers.map(d => {
    const o = overrides.find(x => x.driverName === d.driverName);
    if (!o) return d;
    return {
      ...d,
      position: o.position ?? d.position,
      points: o.points ?? d.points,
      wins: o.wins ?? d.wins,
    };
  });
  return patched.sort((a, b) => a.position - b.position);
}

function applyConstructorOverrides(
  constructors: ConstructorStanding[],
  overrides: StandingsOverridesFile['constructors'],
): ConstructorStanding[] {
  if (!overrides || overrides.length === 0) return constructors;
  const patched = constructors.map(c => {
    const o = overrides.find(x => x.name === c.name);
    if (!o) return c;
    return {
      ...c,
      position: o.position ?? c.position,
      points: o.points ?? c.points,
      wins: o.wins ?? c.wins,
    };
  });
  return patched.sort((a, b) => a.position - b.position);
}

function officialSiteLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host;
  } catch {
    return 'official site';
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-border bg-surface/40 p-6 text-center">
      <div className="text-text-muted text-sm">{message}</div>
    </div>
  );
}

function DriversTable({
  drivers,
  heading = 'Drivers',
}: {
  drivers: DriverStanding[];
  heading?: string;
}) {
  return (
    <section className="border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        {heading}
      </h2>
      <ul className="divide-y divide-border/60">
        {drivers.map(d => (
          <li
            key={`${d.position}-${d.driverName}`}
            className="flex items-baseline gap-3 py-2"
          >
            <span
              className={`w-6 text-sm font-mono tabular-nums text-right ${
                d.position === 1 ? 'text-brand font-bold' : 'text-text-faint'
              }`}
            >
              {d.position}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-text text-sm font-medium truncate">
                  {d.driverName}
                </span>
                {d.driverCode ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint border border-border px-1.5 py-0.5">
                    {d.driverCode}
                  </span>
                ) : null}
              </div>
              {d.team ? (
                <div className="text-text-muted text-xs truncate">{d.team}</div>
              ) : null}
            </div>
            <span className="text-text text-sm font-mono font-semibold tabular-nums text-right w-14">
              {d.points}
            </span>
            <span className="text-text-faint text-[11px] font-mono tabular-nums text-right w-8">
              {d.wins != null ? `${d.wins}W` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConstructorsTable({
  constructors,
  heading = 'Constructors',
}: {
  constructors: ConstructorStanding[];
  heading?: string;
}) {
  return (
    <section className="border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        {heading}
      </h2>
      <ul className="divide-y divide-border/60">
        {constructors.map(c => (
          <li key={`${c.position}-${c.name}`} className="flex items-baseline gap-3 py-2">
            <span
              className={`w-6 text-sm font-mono tabular-nums text-right ${
                c.position === 1 ? 'text-brand font-bold' : 'text-text-faint'
              }`}
            >
              {c.position}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-text text-sm font-medium truncate">{c.name}</span>
            </div>
            <span className="text-text text-sm font-mono font-semibold tabular-nums text-right w-14">
              {c.points}
            </span>
            <span className="text-text-faint text-[11px] font-mono tabular-nums text-right w-8">
              {c.wins != null ? `${c.wins}W` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="text-center">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-faint hover:text-text-muted text-xs transition-colors duration-(--duration-fast)"
      >
        Source: {label} →
      </a>
    </div>
  );
}

function LinkOutCard({
  officialStandingsUrl,
  officialSite,
}: {
  officialStandingsUrl: string;
  officialSite?: string;
}) {
  const label = officialSite
    ? officialSiteLabel(officialSite)
    : officialSiteLabel(officialStandingsUrl);
  return (
    <div className="border border-border bg-surface/40 p-6 text-center">
      <p className="text-text-muted text-sm mb-4">
        Live standings are available on the official site.
      </p>
      <a
        href={officialStandingsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-border-strong hover:bg-surface text-text text-sm font-medium transition-colors duration-(--duration-fast)"
      >
        {label} standings <span aria-hidden>→</span>
      </a>
    </div>
  );
}

export async function StandingsTab({ series }: { series: Series }) {
  if (series.meta.slug === 'f1') {
    const [data, overrides] = await Promise.all([
      fetchF1Standings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    const constructors = applyConstructorOverrides(
      data.constructors,
      overrides?.constructors,
    );
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} />
        <ConstructorsTable constructors={constructors} />
        <SourceLink href={SOURCE_URL} label="jolpi.ca (Ergast mirror)" />
      </div>
    );
  }

  if (series.meta.slug === 'f2') {
    const [data, overrides] = await Promise.all([
      fetchF2Standings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    const constructors = applyConstructorOverrides(
      data.constructors,
      overrides?.constructors,
    );
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} />
        <ConstructorsTable constructors={constructors} />
        <SourceLink
          href="https://www.fiaformula2.com/Standings/Driver"
          label="fiaformula2.com"
        />
      </div>
    );
  }

  if (series.meta.slug === 'f3') {
    const [data, overrides] = await Promise.all([
      fetchF3Standings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    const constructors = applyConstructorOverrides(
      data.constructors,
      overrides?.constructors,
    );
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} />
        <ConstructorsTable constructors={constructors} />
        <SourceLink
          href="https://www.fiaformula3.com/Standings/Driver"
          label="fiaformula3.com"
        />
      </div>
    );
  }

  if (series.meta.slug === 'indycar') {
    const [data, overrides] = await Promise.all([
      fetchIndyCarStandings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} />
        <SourceLink href="https://www.indycar.com/Standings" label="indycar.com" />
      </div>
    );
  }

  if (series.meta.slug === 'formula-e') {
    const [data, overrides] = await Promise.all([
      fetchFormulaEStandings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    const constructors = applyConstructorOverrides(
      data.constructors,
      overrides?.constructors,
    );
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} />
        <ConstructorsTable constructors={constructors} />
        <SourceLink
          href={FORMULA_E_SOURCE_URL}
          label="en.wikipedia.org (2025–26 Formula E)"
        />
      </div>
    );
  }

  if (series.meta.slug === 'nascar-cup') {
    const [data, overrides] = await Promise.all([
      fetchNascarCupStandings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    const constructors = applyConstructorOverrides(
      data.constructors,
      overrides?.constructors,
    );
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} />
        <ConstructorsTable constructors={constructors} />
        <SourceLink href={NASCAR_SOURCE_URL} label="Wikipedia (2026 NASCAR Cup Series)" />
      </div>
    );
  }

  if (series.meta.slug === 'wrc') {
    const [data, overrides] = await Promise.all([
      fetchWRCStandings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    // WRC co-drivers share the championship structure with drivers (same row
    // shape: position / name / total). Map to DriverStanding so the existing
    // DriversTable renders them — empty `team` on each is honest (Wikipedia's
    // co-drivers' table doesn't carry the team name in the row).
    const coDriversAsDrivers: DriverStanding[] = data.coDrivers.map(cd => ({
      position: cd.position,
      driverName: cd.coDriverName,
      team: cd.team,
      points: cd.points,
    }));
    const manufacturers = applyConstructorOverrides(
      data.manufacturers,
      overrides?.constructors,
    );
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} heading="Drivers" />
        <DriversTable drivers={coDriversAsDrivers} heading="Co-Drivers" />
        <ConstructorsTable constructors={manufacturers} heading="Manufacturers" />
        <SourceLink
          href="https://en.wikipedia.org/wiki/2026_World_Rally_Championship"
          label="en.wikipedia.org (2026 WRC)"
        />
      </div>
    );
  }

  if (series.meta.slug === 'gt-world') {
    const [data, overrides] = await Promise.all([
      fetchGtWorldStandings(series.meta.season),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    // Three championships × {drivers, teams} = 6 tables. Render Overall first
    // because it's the marquee championship (decides the headline title), then
    // Sprint Cup + Endurance Cup as the two sub-championships. Each gets its
    // own pair of tables with explicit headings so a reader scanning the page
    // never has to wonder which championship they're looking at.
    const overallDrivers = applyDriverOverrides(data.overall.drivers, overrides?.drivers);
    const overallTeams = applyConstructorOverrides(data.overall.teams, overrides?.constructors);
    const sprintDrivers = applyDriverOverrides(data.sprint.drivers, overrides?.drivers);
    const sprintTeams = applyConstructorOverrides(data.sprint.teams, overrides?.constructors);
    const enduranceDrivers = applyDriverOverrides(data.endurance.drivers, overrides?.drivers);
    const enduranceTeams = applyConstructorOverrides(data.endurance.teams, overrides?.constructors);
    return (
      <div className="space-y-4">
        {overallDrivers.length > 0 ? (
          <DriversTable drivers={overallDrivers} heading="Overall — Drivers" />
        ) : null}
        {overallTeams.length > 0 ? (
          <ConstructorsTable constructors={overallTeams} heading="Overall — Teams" />
        ) : null}
        {sprintDrivers.length > 0 ? (
          <DriversTable drivers={sprintDrivers} heading="Sprint Cup — Drivers" />
        ) : null}
        {sprintTeams.length > 0 ? (
          <ConstructorsTable constructors={sprintTeams} heading="Sprint Cup — Teams" />
        ) : null}
        {enduranceDrivers.length > 0 ? (
          <DriversTable drivers={enduranceDrivers} heading="Endurance Cup — Drivers" />
        ) : null}
        {enduranceTeams.length > 0 ? (
          <ConstructorsTable constructors={enduranceTeams} heading="Endurance Cup — Teams" />
        ) : null}
        <SourceLink
          href="https://www.gt-world-challenge-europe.com/standings"
          label="gt-world-challenge-europe.com"
        />
      </div>
    );
  }

  if (series.meta.slug === 'imsa') {
    const [data, overrides] = await Promise.all([
      fetchImsaStandings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    // Class-first grouping: GTP → LMP2 → GTD Pro → GTD. Each class shows
    // Drivers + Teams + (where applicable) Manufacturers. LMP2 has no
    // manufacturers' championship (privateer-only — all cars are the spec
    // Oreca 07/Gibson). Maps IMSA's shape to DriverStanding/ConstructorStanding
    // inline so the existing renderers handle it.
    return (
      <div className="space-y-4">
        {IMSA_CLASSES.flatMap(cls => {
          const driverRows = data.drivers[cls] ?? [];
          const teamRows = data.teams[cls] ?? [];
          const mfrRows = data.manufacturers[cls] ?? [];
          const driversAsStandard: DriverStanding[] = driverRows.map(d => ({
            position: d.position,
            driverName: d.driverName,
            team: '',
            points: d.points,
          }));
          const teamsAsConstructors: ConstructorStanding[] = teamRows.map(t => ({
            position: t.position,
            name: t.team,
            points: t.points,
          }));
          const mfrsAsConstructors: ConstructorStanding[] = mfrRows.map(m => ({
            position: m.position,
            name: m.manufacturer,
            points: m.points,
          }));
          const driverOverrides = applyDriverOverrides(driversAsStandard, overrides?.drivers);
          const teamOverrides = applyConstructorOverrides(teamsAsConstructors, overrides?.constructors);
          const mfrOverrides = applyConstructorOverrides(mfrsAsConstructors, overrides?.constructors);
          const hasMfr = IMSA_MANUFACTURER_CLASSES.includes(cls);
          return [
            driverOverrides.length > 0 ? (
              <DriversTable
                key={`${cls}-d`}
                drivers={driverOverrides}
                heading={`${cls} — Drivers`}
              />
            ) : null,
            teamOverrides.length > 0 ? (
              <ConstructorsTable
                key={`${cls}-t`}
                constructors={teamOverrides}
                heading={`${cls} — Teams`}
              />
            ) : null,
            hasMfr && mfrOverrides.length > 0 ? (
              <ConstructorsTable
                key={`${cls}-m`}
                constructors={mfrOverrides}
                heading={`${cls} — Manufacturers`}
              />
            ) : null,
          ];
        })}
        <SourceLink
          href="https://en.wikipedia.org/wiki/2026_IMSA_SportsCar_Championship"
          label="en.wikipedia.org (2026 IMSA)"
        />
      </div>
    );
  }

  if (series.meta.slug === 'wec') {
    const [data, overrides] = await Promise.all([
      fetchWecStandings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    // Class-first grouping: Hypercar → LMGT3. Each class shows the
    // championships that exist for it — Hypercar awards Drivers +
    // Manufacturers (no Teams, manufacturer === team at this level); LMGT3
    // awards Drivers + Teams (no Manufacturers, pro-am class doesn't get a
    // manufacturers' title). Same shape as IMSA's class-first dispatch.
    return (
      <div className="space-y-4">
        {WEC_CLASSES.flatMap(cls => {
          const driverRows = data.drivers[cls] ?? [];
          const teamRows = data.teams[cls] ?? [];
          const mfrRows = data.manufacturers[cls] ?? [];
          const driversAsStandard: DriverStanding[] = driverRows.map(d => ({
            position: d.position,
            driverName: d.driverName,
            team: d.team,
            points: d.points,
          }));
          const teamsAsConstructors: ConstructorStanding[] = teamRows.map(t => ({
            position: t.position,
            name: t.team,
            points: t.points,
          }));
          const mfrsAsConstructors: ConstructorStanding[] = mfrRows.map(m => ({
            position: m.position,
            name: m.manufacturer,
            points: m.points,
          }));
          const driverOverrides = applyDriverOverrides(driversAsStandard, overrides?.drivers);
          const teamOverrides = applyConstructorOverrides(teamsAsConstructors, overrides?.constructors);
          const mfrOverrides = applyConstructorOverrides(mfrsAsConstructors, overrides?.constructors);
          const hasMfr = WEC_MANUFACTURER_CLASSES.includes(cls);
          const hasTeams = WEC_TEAM_CLASSES.includes(cls);
          return [
            driverOverrides.length > 0 ? (
              <DriversTable
                key={`${cls}-d`}
                drivers={driverOverrides}
                heading={`${cls} — Drivers`}
              />
            ) : null,
            hasTeams && teamOverrides.length > 0 ? (
              <ConstructorsTable
                key={`${cls}-t`}
                constructors={teamOverrides}
                heading={`${cls} — Teams`}
              />
            ) : null,
            hasMfr && mfrOverrides.length > 0 ? (
              <ConstructorsTable
                key={`${cls}-m`}
                constructors={mfrOverrides}
                heading={`${cls} — Manufacturers`}
              />
            ) : null,
          ];
        })}
        <SourceLink
          href="https://www.fiawec.com/en/page/manufacturers-classification"
          label="fiawec.com"
        />
      </div>
    );
  }

  if (series.meta.slug === 'motogp') {
    const [data, overrides] = await Promise.all([
      fetchMotoGPStandings(series.meta.season),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} />
        <SourceLink
          href="https://www.motogp.com/en/world-standing"
          label="motogp.com"
        />
      </div>
    );
  }

  if (series.meta.slug === 'wsbk') {
    const [data, overrides] = await Promise.all([
      fetchWsbkStandings(series.meta.season),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    const constructors = applyConstructorOverrides(
      data.constructors,
      overrides?.constructors,
    );
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} />
        <ConstructorsTable constructors={constructors} />
        <SourceLink href="https://www.worldsbk.com/en/standings" label="worldsbk.com" />
      </div>
    );
  }

  if (series.meta.slug === 'dtm') {
    const [data, overrides] = await Promise.all([
      fetchDTMStandings(),
      loadStandingsOverrides(series.meta.slug),
    ]);
    if (!data) {
      return (
        <EmptyState message="Standings are temporarily unavailable. Check back shortly." />
      );
    }
    const drivers = applyDriverOverrides(data.drivers, overrides?.drivers);
    const teams = applyConstructorOverrides(data.teams, overrides?.constructors);
    return (
      <div className="space-y-4">
        <DriversTable drivers={drivers} heading="Drivers" />
        {teams.length > 0 ? (
          <ConstructorsTable constructors={teams} heading="Teams" />
        ) : null}
        {/* Manufacturers table dropped (validation 2026-06-11): upstream
            motorsport.com's Constructor endpoint itself returns 4 of 8
            brands with wrong totals — verified by fetching it directly; our
            parse was faithful to junk. Reinstate only with a better source
            (chart-vs-standings discipline applies to standings too). */}
        <SourceLink
          href="https://www.motorsport.com/dtm/standings/2026/"
          label="motorsport.com (DTM 2026)"
        />
      </div>
    );
  }

  if (!series.meta.officialStandingsUrl) {
    return <PlaceholderTab tabLabel="Standings" />;
  }

  return (
    <LinkOutCard
      officialStandingsUrl={series.meta.officialStandingsUrl}
      officialSite={series.meta.officialSite}
    />
  );
}
