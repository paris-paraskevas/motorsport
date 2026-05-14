'use client';
import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

type Status =
  | 'unsupported'
  | 'no-vapid'
  | 'idle'
  | 'denied'
  | 'subscribed'
  | 'working';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export function EnableNotifications() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setStatus('no-vapid');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        setStatus(existing ? 'subscribed' : 'idle');
      } catch {
        setStatus('idle');
      }
    })();
  }, []);

  const enable = async () => {
    setStatus('working');
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'idle');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `server error (${res.status})`);
      }
      setStatus('subscribed');
      setMessage('Notifications enabled — you\'ll get a ping ~30 min before sessions.');
    } catch (err) {
      setStatus('idle');
      setMessage(err instanceof Error ? err.message : 'Failed to enable notifications.');
    }
  };

  const disable = async () => {
    setStatus('working');
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('idle');
      setMessage('Notifications disabled.');
    } catch (err) {
      setStatus('idle');
      setMessage(err instanceof Error ? err.message : 'Failed to disable.');
    }
  };

  const sendTest = async () => {
    setMessage(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setMessage(`Test sent (${data?.sent ?? 0} delivered).`);
      } else {
        throw new Error(data?.error || `error (${res.status})`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Test failed.');
    }
  };

  return (
    <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-5 md:p-6 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="shrink-0 mt-0.5">
          {status === 'subscribed' ? (
            <BellRing size={20} className="text-emerald-400" />
          ) : status === 'denied' ? (
            <BellOff size={20} className="text-zinc-500" />
          ) : (
            <Bell size={20} className="text-zinc-400" />
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-zinc-50 text-base font-semibold">Session notifications</h2>
          <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
            A push to this device about 30 minutes before any session in a followed series.
          </p>
        </div>
      </div>

      {status === 'unsupported' && (
        <div className="text-zinc-500 text-sm">
          Push notifications aren&apos;t supported on this browser.
        </div>
      )}

      {status === 'no-vapid' && (
        <div className="text-amber-400 text-sm">
          Server isn&apos;t configured for push yet. (Missing VAPID env vars.)
        </div>
      )}

      {status === 'denied' && (
        <div className="text-amber-400 text-sm">
          Notifications are blocked in browser settings. Allow them for this site to enable.
        </div>
      )}

      {(status === 'idle' || status === 'working') && (
        <button
          type="button"
          onClick={enable}
          disabled={status === 'working'}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100 bg-zinc-100/10 hover:bg-zinc-100/20 disabled:opacity-50 border border-zinc-700 rounded-full px-4 py-2 transition-colors"
        >
          <Bell size={14} />
          {status === 'working' ? 'Enabling…' : 'Enable notifications'}
        </button>
      )}

      {status === 'subscribed' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={sendTest}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 transition-colors"
          >
            Send test
          </button>
          <button
            type="button"
            onClick={disable}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300 rounded-full px-3 py-1.5 transition-colors"
          >
            Turn off
          </button>
        </div>
      )}

      {message && (
        <div className="mt-3 text-xs text-zinc-400">{message}</div>
      )}
    </div>
  );
}
