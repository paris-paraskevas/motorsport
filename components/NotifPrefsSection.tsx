'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Bell } from 'lucide-react';
import { Accordion } from './Accordion';

interface NotifPrefs {
  sessions: boolean;
  news: boolean;
  raceWeek: boolean;
  sound: boolean;
}

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

  const toggle = async (key: keyof NotifPrefs) => {
    if (!prefs) return;
    const next: NotifPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimistic
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/user/notif-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs: { [key]: next[key] } }),
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

  return (
    <Accordion
      title="What gets notified"
      subtitle="Choose which alerts you receive. Push must be enabled on this device for any of these to fire."
      icon={<Bell size={18} className="text-text-muted" />}
    >
      {isLoaded && !isSignedIn ? (
        <p className="text-text-faint text-sm">Sign in to choose what gets notified.</p>
      ) : (
        <>
      {!prefs && !error && <div className="text-text-faint text-sm">Loading…</div>}

      {error && <div className="text-amber-400 text-sm mb-3">{error}</div>}

      {prefs && (
        <div className="space-y-2">
          {ROWS.map(row => (
            <label
              key={row.key}
              className="flex items-start gap-3 p-3 border border-border bg-surface/40 cursor-pointer hover:bg-surface transition-colors"
            >
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
          ))}
        </div>
      )}
        </>
      )}
    </Accordion>
  );
}
