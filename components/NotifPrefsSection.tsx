'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Bell } from 'lucide-react';

interface SessionTypePrefs {
  practice: boolean;
  qualifying: boolean;
  race: boolean;
}

interface NotifPrefs {
  sessions: boolean;
  news: boolean;
  raceWeek: boolean;
  betting: boolean;
  blog: boolean;
  sound: boolean;
  sessionTypes: SessionTypePrefs;
}

const SESSION_TYPE_ROWS: Array<{ key: keyof SessionTypePrefs; label: string }> = [
  { key: 'practice', label: 'Practice' },
  { key: 'qualifying', label: 'Qualifying' },
  { key: 'race', label: 'Races' },
];

const ROWS: Array<{ key: keyof NotifPrefs; label: string; description: string }> = [
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

  const toggle = (key: Exclude<keyof NotifPrefs, 'sessionTypes'>) => {
    if (!prefs) return;
    const next: NotifPrefs = { ...prefs, [key]: !prefs[key] };
    void save(next, { [key]: next[key] });
  };

  const toggleSessionType = (key: keyof SessionTypePrefs) => {
    if (!prefs) return;
    const sessionTypes = { ...prefs.sessionTypes, [key]: !prefs.sessionTypes[key] };
    void save({ ...prefs, sessionTypes }, { sessionTypes: { [key]: sessionTypes[key] } });
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
        </div>
      )}
        </>
      )}
    </div>
  );
}
