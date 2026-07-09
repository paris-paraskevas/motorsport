import type { PushPayload } from './push';
import type { NotifyKind } from './notify-ledger';
import { sessionTypeAllowed, type SessionTypePrefs } from './userPrefs';

// A session the notify cron is considering. Shared with app/api/cron/notify —
// kept here (not in the route) so the route file exports only its handler +
// config, which Next 16's route-type validator requires.
export interface CandidateSession {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  seriesSlug: string;
  seriesName: string;
  seriesColor: string;
}

export interface QueuedNotification {
  kind: NotifyKind;
  session: CandidateSession;
  payload: PushPayload;
}

// Which queued notifications a signed-in subscriber is eligible for. `sessions`
// is the umbrella toggle for the notify cron (pre-session reminders,
// results-ready, F1 analysis); the per-session-type filter applies only to the
// pre-session kinds; then followed-series + per-series mute. Pure → unit-tested.
export interface NotifyGate {
  sessionsOn: boolean;
  sessionTypes: SessionTypePrefs | undefined;
  followed: string[] | null;
  muted: Set<string>;
}

export function eligibleForNotify(gate: NotifyGate, item: QueuedNotification): boolean {
  if (!gate.sessionsOn) return false;
  if (
    (item.kind === 't30' || item.kind === 't10') &&
    !sessionTypeAllowed(gate.sessionTypes, item.session.title)
  ) {
    return false;
  }
  if (gate.followed !== null && !gate.followed.includes(item.session.seriesSlug)) return false;
  if (gate.muted.has(item.session.seriesSlug)) return false;
  return true;
}

// Fold ≥2 eligible notifications for one subscriber into a single summary push,
// so a busy 15-min tick lands as one buzz, not six (operator 2026-07-09). The
// digest shares a stable tag so a later digest replaces rather than stacks, and
// deep-links to /app; the lead line + colour come from the soonest item.
export function coalescedPayload(items: QueuedNotification[], silent: boolean): PushPayload {
  const lead = items[0];
  return {
    title: `Paddock · ${items.length} updates`,
    body: `${lead.payload.title} + ${items.length - 1} more`,
    url: '/app',
    tag: 'paddock-digest',
    color: lead.session.seriesColor,
    ...(silent ? { silent: true } : {}),
  };
}
