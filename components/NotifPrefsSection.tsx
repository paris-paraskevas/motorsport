'use client';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

interface NotifPrefs {
  sessions: boolean;
  news: boolean;
  raceWeek: boolean;
}

const ROWS: Array<{ key: keyof NotifPrefs; label: string; description: string }> = [
  {
    key: 'sessions',
    label: 'Session reminders',
    description: 'A push ~30 minutes before any session in a followed series.',
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
];

export function NotifPrefsSection() {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
  }, []);

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
    <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-5 md:p-6 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <Bell size={18} className="text-zinc-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-zinc-50 text-base font-semibold">What gets notified</h2>
          <p className="text-zinc-500 text-xs mt-1">
            Choose which alerts you receive. Push must be enabled on this device for any of these to fire.
          </p>
        </div>
      </div>

      {!prefs && !error && (
        <div className="text-zinc-500 text-sm">Loading…</div>
      )}

      {error && <div className="text-amber-400 text-sm mb-3">{error}</div>}

      {prefs && (
        <div className="space-y-2">
          {ROWS.map(row => (
            <label
              key={row.key}
              className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800/70 bg-zinc-900/40 cursor-pointer hover:bg-zinc-900/70 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-zinc-100 text-sm font-medium">{row.label}</div>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  {row.description}
                </p>
              </div>
              <input
                type="checkbox"
                checked={prefs[row.key]}
                onChange={() => toggle(row.key)}
                disabled={saving}
                className="w-5 h-5 rounded accent-zinc-300 cursor-pointer disabled:cursor-not-allowed mt-0.5 shrink-0"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
