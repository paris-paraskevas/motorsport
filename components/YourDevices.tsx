'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Smartphone, Loader2 } from 'lucide-react';
import { getCurrentPushEndpoint, unsubscribeFromPush } from '@/lib/pushClient';

interface Device {
  endpoint: string;
  label: string | null;
  createdAt: number;
}

// The signed-in user's push devices (Settings → Notifications). Lists every
// browser/device that enabled push, marks the one you're on, and offers a
// per-device Test + Remove. Test/Remove are keyed on the endpoint and
// ownership-checked server-side. Renders nothing until there's ≥1 device.
export function YourDevices() {
  const { isLoaded, isSignedIn } = useAuth();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/push/devices', { cache: 'no-store' });
      const data = res.ok ? await res.json().catch(() => null) : null;
      setDevices(Array.isArray(data?.devices) ? (data.devices as Device[]) : []);
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    // Async closure so the loads (which setState) run in a callback, not
    // synchronously in the effect body (react-hooks/set-state-in-effect).
    void (async () => {
      await load();
      setCurrent(await getCurrentPushEndpoint());
    })();
  }, [isLoaded, isSignedIn, load]);

  if (!isLoaded || !isSignedIn || !devices || devices.length === 0) return null;

  const test = async (endpoint: string) => {
    setBusy(endpoint);
    setNote(null);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      const data = await res.json().catch(() => null);
      setNote(res.ok ? `Test sent (${data?.sent ?? 0} delivered).` : data?.error || 'Test failed.');
    } catch {
      setNote('Test failed.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (endpoint: string) => {
    setBusy(endpoint);
    setNote(null);
    try {
      // The device you're on: fully unsubscribe (browser + server) so the
      // Enable toggle above stays truthful. Other devices: drop the server row
      // (their browser sub self-prunes on the next 404/410 push send).
      if (endpoint === current) {
        await unsubscribeFromPush();
        setCurrent(await getCurrentPushEndpoint());
      } else {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
      await load();
    } catch {
      setNote('Could not remove that device.');
    } finally {
      setBusy(null);
    }
  };

  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="border-t border-border py-5">
      <div className="mb-1.5 flex items-center gap-2">
        <Smartphone size={20} className="text-text-muted" />
        <h2 className="text-text text-base font-semibold">Your devices</h2>
      </div>
      <p className="mb-4 text-text-faint text-xs leading-relaxed">
        Every browser or device where you&apos;ve enabled notifications. Send a test to one, or remove any you no
        longer use.
      </p>
      <ul className="flex flex-col gap-2">
        {devices.map(d => (
          <li key={d.endpoint} className="flex items-center gap-3 border border-border px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm text-text">{d.label || 'Unnamed device'}</span>
                {d.endpoint === current && (
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-brand">
                    This device
                  </span>
                )}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
                Added {fmt(d.createdAt)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => test(d.endpoint)}
              disabled={busy !== null}
              className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-text disabled:opacity-40"
            >
              {busy === d.endpoint && <Loader2 size={12} className="animate-spin" aria-hidden />}
              Test
            </button>
            <button
              type="button"
              onClick={() => remove(d.endpoint)}
              disabled={busy !== null}
              className="shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint transition-colors hover:text-red-400 disabled:opacity-40"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {note && <div className="mt-3 text-xs text-text-muted">{note}</div>}
    </div>
  );
}
