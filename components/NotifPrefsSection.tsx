'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Bell } from 'lucide-react';

interface SessionTypePrefs {
  practice: boolean;
  qualifying: boolean;
  race: boolean;
}

interface QuietHours {
  enabled: boolean;
  start: number;
  end: number;
  tz: string;
}

interface NotifPrefs {
  sessions: boolean;
  news: boolean;
  raceWeek: boolean;
  betting: boolean;
  blog: boolean;
  sound: boolean;
  sessionTypes: SessionTypePrefs;
  quietHours?: QuietHours;
}

const SESSION_TYPE_ROWS: Array<{ key: keyof SessionTypePrefs; label: string }> = [
  { key: 'practice', label: 'Practice' },
  { key: 'qualifying', label: 'Qualifying' },
  { key: 'race', label: 'Races' },
];

const ROWS: Array<{
  key: Exclude<keyof NotifPrefs, 'sessionTypes' | 'quietHours'>;
  label: string;
  description: string;
}> = [
  {
    key: 'sessions',
    label: 'Session reminders',
    description: 'Pushes ~30 and ~10 minutes before sessions, plus race results when they land.',
  },
  {
    key: 'news',
    label: 'News articles',
    description: 'Alert when a new top story drops from a followed series.',
  },
  {
    key: 'raceWeek',
    label: 'Race week summary',
    description: 'Monday morning recap of races coming up this week.',
  },
  {
    key: 'betting',
    label: 'Prediction reminders',
    description: 'A nudge the day before predictions lock, plus a note when results settle.',
  },
  {
    key: 'blog',
    label: 'Blog posts',
    description: 'Alert when a new post is published (followed series only when a post is tagged).',
  },
  {
    key: 'sound',
    label: 'Play notification sound',
    description: 'Turn off to receive notifications silently (badge + banner only).',
  },
];

export function NotifPrefsSection() {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) return; // signed-out: the prefs API would 401
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/notif-prefs');
        if (!res.ok) {
          if (!cancelled) setError(`load failed (${res.status})`);
          return;
        }
        const data = (await res.json()) as { prefs: NotifPrefs };
        if (!cancelled) setPrefs(data.prefs);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'load failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  // Shared optimistic-save plumbing: apply `next` locally, PUT `patch`, revert
  // on failure. Used by both the kind toggles and the session-type toggles.
  const save = async (next: NotifPrefs, patch: object) => {
    if (!prefs) return;
    setPrefs(next); // optimistic
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/user/notif-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs: patch }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `save failed (${res.status})`);
      }
    } catch (err) {
      // revert
      setPrefs(prefs);
      setError(err instanceof Error ? err.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: Exclude<keyof NotifPrefs, 'sessionTypes' | 'quietHours'>) => {
    if (!prefs) return;
    const next: NotifPrefs = { ...prefs, [key]: !prefs[key] };
    void save(next, { [key]: next[key] });
  };

  const toggleSessionType = (key: keyof SessionTypePrefs) => {
    if (!prefs) return;
    const sessionTypes = { ...prefs.sessionTypes, [key]: !prefs.sessionTypes[key] };
    void save({ ...prefs, sessionTypes }, { sessionTypes: { [key]: sessionTypes[key] } });
  };

  // Quiet hours. The user's timezone is captured from the browser (the server
  // cron evaluates the window in it) — re-captured on every change so a moved
  // device stays correct. Defaults to a 22:00→07:00 overnight window on enable.
  const browserTz = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  };
  const toggleQuiet = () => {
    if (!prefs) return;
    const cur = prefs.quietHours;
    const quietHours: QuietHours = cur
      ? { ...cur, enabled: !cur.enabled, tz: browserTz() }
      : { enabled: true, start: 22, end: 7, tz: browserTz() };
    void save({ ...prefs, quietHours }, { quietHours });
  };
  const setQuietWindow = (start: number, end: number) => {
    if (!prefs?.quietHours) return;
    const quietHours: QuietHours = { ...prefs.quietHours, start, end, tz: browserTz() };
    void save({ ...prefs, quietHours }, { quietHours });
  };

  return (
    <div className="border-t border-border py-5">
      <div className="mb-1.5 flex items-center gap-2">
        <Bell size={18} className="text-text-muted" />
        <h2 className="text-text text-base font-semibold">What gets notified</h2>
      </div>
      <p className="mb-4 text-text-faint text-xs leading-relaxed">
        Choose which alerts you receive. Push must be enabled on this device for any of these to fire.
      </p>
      {isLoaded && !isSignedIn ? (
        <p className="text-text-faint text-sm">Sign in to choose what gets notified.</p>
      ) : (
        <>
      {!prefs && !error && <div className="text-text-faint text-sm">Loading…</div>}

      {error && <div className="text-amber-400 text-sm mb-3">{error}</div>}

      {prefs && (
        <div className="space-y-2">
          {ROWS.map(row => (
            <div key={row.key}>
              <label className="flex items-start gap-3 p-3 border border-border bg-surface/40 cursor-pointer hover:bg-surface transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-text text-sm font-medium">{row.label}</div>
                  <p className="text-xs text-text-faint mt-0.5 leading-relaxed">
                    {row.description}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs[row.key]}
                  onChange={() => toggle(row.key)}
                  disabled={saving}
                  className="w-5 h-5 rounded accent-brand cursor-pointer disabled:cursor-not-allowed mt-0.5 shrink-0"
                />
              </label>
              {row.key === 'sessions' && prefs.sessions && (
                <div className="mt-1 ml-3 border-l border-border pl-3 py-2 flex flex-wrap gap-x-5 gap-y-1.5">
                  {SESSION_TYPE_ROWS.map(st => (
                    <label
                      key={st.key}
                      className="inline-flex items-center gap-2 cursor-pointer text-xs text-text-muted hover:text-text transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={prefs.sessionTypes[st.key]}
                        onChange={() => toggleSessionType(st.key)}
                        disabled={saving}
                        className="w-4 h-4 rounded accent-brand cursor-pointer disabled:cursor-not-allowed"
                      />
                      {st.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Quiet hours — pause ALL push during a nightly window, evaluated in
              the user's own timezone (captured from the browser on enable). */}
          <div>
            <label className="flex items-start gap-3 p-3 border border-border bg-surface/40 cursor-pointer hover:bg-surface transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-text text-sm font-medium">Quiet hours</div>
                <p className="text-xs text-text-faint mt-0.5 leading-relaxed">
                  Pause all notifications overnight (your local time).
                </p>
              </div>
              <input
                type="checkbox"
                checked={!!prefs.quietHours?.enabled}
                onChange={toggleQuiet}
                disabled={saving}
                className="w-5 h-5 rounded accent-brand cursor-pointer disabled:cursor-not-allowed mt-0.5 shrink-0"
              />
            </label>
            {prefs.quietHours?.enabled && (
              <div className="mt-1 ml-3 border-l border-border pl-3 py-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <span>From</span>
                <HourSelect
                  value={prefs.quietHours.start}
                  disabled={saving}
                  onChange={h => setQuietWindow(h, prefs.quietHours!.end)}
                />
                <span>to</span>
                <HourSelect
                  value={prefs.quietHours.end}
                  disabled={saving}
                  onChange={h => setQuietWindow(prefs.quietHours!.start, h)}
                />
                <span className="text-text-faint">· {prefs.quietHours.tz}</span>
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

// 0–23 hour picker for the quiet-hours window, rendered "HH:00".
function HourSelect({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (h: number) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      disabled={disabled}
      aria-label="Hour"
      className="rounded border border-border bg-surface px-2 py-1 text-text tabular-nums disabled:cursor-not-allowed"
    >
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h}>
          {String(h).padStart(2, '0')}:00
        </option>
      ))}
    </select>
  );
}
