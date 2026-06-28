// One unified event stream for a session. race_control + overtakes + pit +
// team_radio collapse into a single chronological Moment list that renders as
// the Race Story timeline AND (Phase 3) seeds push notifications — `severity`
// is the shared signal for both colour-coding and notification-worthiness.
// Pure + synchronous so it's unit-testable.

import type {
  OF1Overtake,
  OF1Pit,
  OF1RaceControl,
  OF1TeamRadio,
} from './types';

export type MomentKind =
  | 'flag'
  | 'safety-car'
  | 'penalty'
  | 'investigation'
  | 'overtake'
  | 'pit'
  | 'radio'
  | 'drs'
  | 'other';

export type MomentSeverity = 'info' | 'notice' | 'alert';

export interface Moment {
  id: string; // stable across re-fetches
  kind: MomentKind;
  at: string; // ISO
  lap?: number | null;
  driverNumber?: number | null;
  title: string; // short label
  detail?: string; // the raw message / extra context
  severity: MomentSeverity;
  audioUrl?: string; // team radio mp3
}

export interface MomentSources {
  raceControl?: OF1RaceControl[];
  overtakes?: OF1Overtake[];
  pit?: OF1Pit[];
  radio?: OF1TeamRadio[];
}

function classifyRaceControl(rc: OF1RaceControl): {
  kind: MomentKind;
  severity: MomentSeverity;
  title: string;
} {
  const msg = (rc.message || '').toUpperCase();
  const flag = (rc.flag || '').toUpperCase();
  const cat = (rc.category || '').toLowerCase();

  if (flag === 'RED') return { kind: 'flag', severity: 'alert', title: 'Red flag' };
  if (cat === 'safetycar' || msg.includes('SAFETY CAR') || msg.includes('VIRTUAL SAFETY')) {
    const vsc = msg.includes('VIRTUAL');
    const ending = msg.includes('ENDING') || msg.includes('IN THIS LAP');
    return {
      kind: 'safety-car',
      severity: ending ? 'notice' : 'alert',
      title: vsc ? 'Virtual Safety Car' : 'Safety Car',
    };
  }
  if (msg.includes('PENALTY')) return { kind: 'penalty', severity: 'alert', title: 'Penalty' };
  if (msg.includes('INVESTIGATION') || msg.includes('NOTED')) {
    return { kind: 'investigation', severity: 'notice', title: 'Stewards' };
  }
  if (flag === 'DOUBLE YELLOW') return { kind: 'flag', severity: 'notice', title: 'Double yellow' };
  if (flag === 'YELLOW') return { kind: 'flag', severity: 'notice', title: 'Yellow flag' };
  if (flag === 'BLUE') return { kind: 'flag', severity: 'info', title: 'Blue flag' };
  if (flag === 'GREEN' || flag === 'CLEAR') return { kind: 'flag', severity: 'info', title: 'Track clear' };
  if (flag === 'CHEQUERED') return { kind: 'flag', severity: 'info', title: 'Chequered flag' };
  if (cat === 'drs') {
    return { kind: 'drs', severity: 'info', title: msg.includes('ENABLED') ? 'DRS enabled' : 'DRS' };
  }
  return { kind: 'other', severity: 'info', title: rc.category || 'Race control' };
}

/** Merge all event sources into one chronological, de-dupable Moment list. */
export function buildMoments(sources: MomentSources): Moment[] {
  const moments: Moment[] = [];

  for (const rc of sources.raceControl ?? []) {
    const c = classifyRaceControl(rc);
    moments.push({
      id: `rc:${rc.date}:${rc.driver_number ?? ''}:${c.kind}`,
      kind: c.kind,
      at: rc.date,
      lap: rc.lap_number,
      driverNumber: rc.driver_number,
      title: c.title,
      detail: rc.message,
      severity: c.severity,
    });
  }

  for (const o of sources.overtakes ?? []) {
    moments.push({
      id: `ot:${o.date}:${o.overtaking_driver_number}`,
      kind: 'overtake',
      at: o.date,
      driverNumber: o.overtaking_driver_number,
      title: `Overtake for P${o.position}`,
      detail: `#${o.overtaking_driver_number} passed #${o.overtaken_driver_number}`,
      severity: 'info',
    });
  }

  for (const p of sources.pit ?? []) {
    const dur = p.stop_duration ?? p.pit_duration ?? null;
    moments.push({
      id: `pit:${p.date}:${p.driver_number}`,
      kind: 'pit',
      at: p.date,
      lap: p.lap_number,
      driverNumber: p.driver_number,
      title: 'Pit stop',
      detail: dur != null ? `${dur.toFixed(1)}s stop` : undefined,
      severity: 'info',
    });
  }

  for (const r of sources.radio ?? []) {
    moments.push({
      id: `radio:${r.date}:${r.driver_number}`,
      kind: 'radio',
      at: r.date,
      driverNumber: r.driver_number,
      title: 'Team radio',
      severity: 'notice',
      audioUrl: r.recording_url,
    });
  }

  return moments.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
